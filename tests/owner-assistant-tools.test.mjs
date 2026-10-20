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
    b.onResolve({ filter: /^cloudflare:workers$|^@\/app\/chatgpt-auth$|^@\/db\/database$|^@\/app\/api\/health\/route$/ }, args => ({ path: args.path, namespace: 'owner-assistant-test' }));
    b.onLoad({ filter: /.*/, namespace: 'owner-assistant-test' }, args => ({ contents: ({
      'cloudflare:workers': 'export const env = globalThis.ownerAssistantTest.env;',
      '@/app/chatgpt-auth': 'export async function getChatGPTUser(){return globalThis.ownerAssistantTest.user;}',
      '@/db/database': 'export function database(){return globalThis.ownerAssistantTest.db;}',
      '@/app/api/health/route': 'export async function GET(){return Response.json({});}',
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
  assert.equal(response.status, 200);
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
