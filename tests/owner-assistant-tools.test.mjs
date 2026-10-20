import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const output = resolve('.sites-runtime/tests/owner-assistant-tools.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/operator/assistant/route.ts'], outfile: output, bundle: true,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'owner-assistant-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$|^@\/app\/chatgpt-auth$|^@\/db\/database$|^@\/app\/api\/health\/route$|^@\/lib\/reliability$/ }, args => ({ path: args.path, namespace: 'owner-assistant-test' }));
    b.onLoad({ filter: /.*/, namespace: 'owner-assistant-test' }, args => ({ contents: ({
      'cloudflare:workers': 'export const env = new Proxy({}, {get(_target,key){return globalThis.ownerAssistantTest.env[key];}});',
      '@/app/chatgpt-auth': 'export async function getChatGPTUser(){return globalThis.ownerAssistantTest.user;}',
      '@/db/database': 'export function database(){return globalThis.ownerAssistantTest.db;}',
      '@/app/api/health/route': 'export async function GET(){return Response.json({});}',
      '@/lib/reliability': 'export async function recordAudit(_db,input){globalThis.ownerAssistantTest.audit.push(input);}',
    })[args.path] }));
  } }],
});

test('Owner AI can retrieve a task by ID while restricting the query to the signed-in owner', async () => {
  const taskId = 'op_123e4567-e89b-12d3-a456-426614174000';
  const task = { id: taskId, title: 'Run verification', objective: 'Check the Relay changes', status: 'queued', approval: 'not_required', next_action: 'Run checks', result: '', created: '2026-10-01T00:00:00.000Z', updated: '2026-10-01T00:00:00.000Z' };
  const calls = [];
  const runtime = globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key' },
    query: null,
    db: { prepare(sql) { return { bind(...values) { runtime.query = { sql, values }; return { first: async () => task }; } }; } },
  };
  const route = await import(pathToFileURL(output).href);
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    if (calls.length === 1) return Response.json({ output: [{ type: 'function_call', name: 'get_operator_task', arguments: JSON.stringify({ taskId }), call_id: 'task-call' }] });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'The task is queued for verification.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Tell me the details of this task.' }] }),
  }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(runtime.query.values, ['owner-123', taskId]);
  assert.match(runtime.query.sql, /WHERE owner=\? AND id=\?/);
  assert.equal(calls.length, 2);
  const toolOutput = calls[1].input.find(item => item.type === 'function_call_output' && item.call_id === 'task-call');
  assert.deepEqual(JSON.parse(toolOutput.output), { task });
  const result = await response.json();
  assert.deepEqual(result.toolsUsed, ['get_operator_task']);
});

test('Owner AI rejects malformed task IDs before querying task storage', async () => {
  let queryCount = 0;
  const runtime = globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key' },
    db: { prepare() { queryCount += 1; throw new Error('Unexpected database query'); } },
  };
  const route = await import(pathToFileURL(output).href);
  let calls = 0;
  globalThis.fetch = async (_url, init) => {
    calls += 1;
    if (calls === 1) return Response.json({ output: [{ type: 'function_call', name: 'get_operator_task', arguments: JSON.stringify({ taskId: 'someone-elses-task' }), call_id: 'invalid-task-call' }] });
    const request = JSON.parse(init.body);
    const toolOutput = request.input.find(item => item.type === 'function_call_output' && item.call_id === 'invalid-task-call');
    assert.deepEqual(JSON.parse(toolOutput.output), { error: 'Provide one valid operator task ID from the task list.' });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'That task ID is invalid.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Read task data.' }] }),
  }));
  assert.equal(response.status, 200);
  assert.equal(queryCount, 0);
});

test('Owner AI returns a task update for confirmation and does not write it', async () => {
  const taskId = 'op_123e4567-e89b-12d3-a456-426614174000';
  const task = { id: taskId, title: 'Run verification', objective: 'Check Relay changes', status: 'queued', approval: 'not_required', next_action: '', result: '', created: '2026-10-01T00:00:00.000Z', updated: '2026-10-01T00:00:00.000Z' };
  const calls = [];
  const writes = [];
  const runtime = globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key' },
    queries: [],
    db: {
      prepare(sql) {
        return {
          bind(...values) {
            runtime.queries.push({ sql, values });
            return {
              first: async () => task,
              run: async () => { writes.push(sql); return { meta: { changes: 1 } }; },
            };
          },
        };
      },
    },
  };
  const route = await import(pathToFileURL(output).href);
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    if (calls.length === 1) return Response.json({ output: [{ type: 'function_call', name: 'propose_operator_task_update', arguments: JSON.stringify({ taskId, status: 'in_progress', nextAction: 'Run the Relay verification checks.' }), call_id: 'update-call' }] });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'I prepared the status update for your confirmation.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Start the verification task.' }] }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.deepEqual(result.taskUpdateProposal, { taskId, status: 'in_progress', nextAction: 'Run the Relay verification checks.', title: 'Run verification', currentStatus: 'queued' });
  assert.deepEqual(result.toolsUsed, ['propose_operator_task_update']);
  assert.equal(runtime.queries.length, 1);
  assert.deepEqual(runtime.queries[0].values, ['owner-123', taskId]);
  assert.equal(writes.length, 0, 'the assistant only prepares a proposal');
  const toolOutput = calls[1].input.find(item => item.type === 'function_call_output' && item.call_id === 'update-call');
  assert.deepEqual(JSON.parse(toolOutput.output), { proposal: result.taskUpdateProposal, requiresOwnerConfirmation: true, changesSaved: false });
});

test('Owner AI will not propose starting a task that is still pending approval', async () => {
  const taskId = 'op_123e4567-e89b-12d3-a456-426614174000';
  const task = { id: taskId, title: 'Approval-gated task', status: 'queued', approval: 'pending_owner' };
  const calls = [];
  const runtime = globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key' },
    db: {
      prepare(_sql) {
        return {
          bind(..._values) {
            return { first: async () => task };
          },
        };
      },
    },
  };
  const route = await import(pathToFileURL(output).href);
  globalThis.fetch = async (_url, init) => {
    const request = JSON.parse(init.body);
    calls.push(request);
    if (calls.length === 1) return Response.json({ output: [{ type: 'function_call', name: 'propose_operator_task_update', arguments: JSON.stringify({ taskId, status: 'in_progress' }), call_id: 'pending-update-call' }] });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'The task needs your approval first.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Start the task.' }] }),
  }));
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.taskUpdateProposal, null);
  assert.deepEqual(result.toolsUsed, []);
  const toolOutput = calls[1].input.find(item => item.type === 'function_call_output' && item.call_id === 'pending-update-call');
  assert.deepEqual(JSON.parse(toolOutput.output), { error: 'This task must receive your approval in Operator before it can start.' });
});

test('Owner AI dispatches only the fixed quality workflow on main and audits the action', async () => {
  const calls = [];
  const githubRequests = [];
  const runtime = globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key', OWNER_AI_GITHUB_ACTIONS_TOKEN: 'ghs_private_test', OWNER_AI_GITHUB_REPO: 'erack1991-wq/Relay-Ai' },
    db: {}, audit: [],
  };
  const route = await import(pathToFileURL(output).href);
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('api.github.com')) {
      githubRequests.push({ url: String(url), init });
      return new Response(null, { status: 204 });
    }
    const request = JSON.parse(init.body);
    calls.push(request);
    if (calls.length === 1) {
      assert.equal(request.tools.some(tool => tool.name === 'run_relay_quality_checks'), true);
      return Response.json({ output: [{ type: 'function_call', name: 'run_relay_quality_checks', arguments: '{}', call_id: 'quality-call' }] });
    }
    const toolOutput = request.input.find(item => item.type === 'function_call_output' && item.call_id === 'quality-call');
    assert.deepEqual(JSON.parse(toolOutput.output), {
      dispatched: true,
      repository: 'erack1991-wq/Relay-Ai',
      workflow: 'Relay quality',
      ref: 'main',
      url: 'https://github.com/erack1991-wq/Relay-Ai/actions/workflows/relay-quality.yml',
      deploys: false,
      auditRecorded: true,
    });
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'Quality checks started on main. No deployment was started.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Run Relay quality checks.' }] }),
  }));
  assert.equal(response.status, 200, await response.clone().text());
  assert.deepEqual(JSON.parse(githubRequests[0].init.body), { ref: 'main' });
  assert.match(githubRequests[0].url, /\/actions\/workflows\/relay-quality\.yml\/dispatches$/);
  assert.equal(githubRequests[0].init.headers.Authorization, 'Bearer ghs_private_test');
  assert.deepEqual(runtime.audit[0], { id: runtime.audit[0].id, actor: 'owner-123', action: 'operator.quality_checks_dispatched', target: 'erack1991-wq/Relay-Ai', metadata: { workflow: 'relay-quality.yml', ref: 'main' } });
  assert.deepEqual((await response.json()).toolsUsed, ['run_relay_quality_checks']);
});

test('Owner AI does not call GitHub when the quality dispatch token is missing', async () => {
  const calls = [];
  let githubCalls = 0;
  globalThis.ownerAssistantTest = {
    user: { userId: 'owner-123', email: 'owner@example.test' },
    env: { OWNER_AI_ALLOWED_EMAILS: 'owner@example.test', OPENAI_API_KEY: 'test-key' },
    db: {}, audit: [],
  };
  const route = await import(pathToFileURL(output).href);
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).includes('api.github.com')) { githubCalls += 1; throw new Error('GitHub should not be called'); }
    const request = JSON.parse(init.body);
    calls.push(request);
    if (calls.length === 1) return Response.json({ output: [{ type: 'function_call', name: 'run_relay_quality_checks', arguments: '{}', call_id: 'quality-call' }] });
    const toolOutput = request.input.find(item => item.type === 'function_call_output' && item.call_id === 'quality-call');
    assert.match(JSON.parse(toolOutput.output).error, /OWNER_AI_GITHUB_ACTIONS_TOKEN/);
    return Response.json({ output: [{ type: 'message', content: [{ type: 'output_text', text: 'The token needs configuration first.' }] }] });
  };
  const response = await route.POST(new Request('https://relay.test/api/operator/assistant', {
    method: 'POST', headers: { origin: 'https://relay.test', 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content: 'Run quality checks.' }] }),
  }));
  assert.equal(response.status, 200);
  assert.equal(githubCalls, 0);
  assert.deepEqual((await response.json()).toolsUsed, ['run_relay_quality_checks']);
});
