import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const output = resolve('.sites-runtime/tests/operator-plan-route.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/operator/plan/route.ts'], outfile: output, bundle: true,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'isolated-operator-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$|^@\/lib\/operator-auth$|^@\/lib\/operator-owner-access$|^@\/lib\/ai-gateway$|^@\/lib\/telephony$|^@\/db\/database$|^@\/app\/api\/health\/route$/ }, args => ({ path: args.path, namespace: 'operator-test-runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'operator-test-runtime' }, args => ({ contents: ({
      'cloudflare:workers': 'export const env = globalThis.__relayOperatorTest.env;',
      '@/lib/operator-auth': 'export async function getOperatorUser(){return globalThis.__relayOperatorTest.auth;} ',
      '@/lib/operator-owner-access': 'export function operatorOwnerAccess(){return globalThis.__relayOperatorTest.ownerAccess;} ',
      '@/lib/ai-gateway': 'export async function aiResponse(request){globalThis.__relayOperatorTest.aiRequest=request;return {output:[{content:[{type:"output_text",text:JSON.stringify(globalThis.__relayOperatorTest.plan)}]}]};}',
      '@/lib/telephony': 'export function bindings(){return globalThis.__relayOperatorTest.env;}',
      '@/db/database': 'export function database(){return globalThis.__relayOperatorTest.db;}',
      '@/app/api/health/route': 'export async function GET(){return Response.json(globalThis.__relayOperatorTest.health);}',
    })[args.path] }));
  } }],
});

test('owner plans use sanitized Relay status, active tasks, and memory as context', async () => {
  globalThis.__relayOperatorTest = {
    auth: { user: { userId: 'owner-1', email: 'owner@example.test' } },
    ownerAccess: { ok: true },
    env: { OPENAI_OWNER_MODEL: 'test-model' },
    health: {
      readyForPilot: false,
      configurationReady: true,
      configurationWarnings: ['Backup restore drill is missing'],
      pilotBlockers: [{ id: 'backup:restore', label: 'Backup restore drill', nextAction: 'Run a restore drill.' }],
      pilotWarnings: [], operations: { failedJobs: 0 }, nextSafeAction: 'Run a restore drill.',
      secrets: { TWILIO_AUTH_TOKEN: 'must-not-be-sent-to-model' },
    },
    plan: { summary: 'Verify the restore drill', steps: ['Restore a recent backup in a safe environment'], nextAction: 'Record the successful restore test.', approvalRequired: false, approvalReason: '' },
    queries: [],
  };
  globalThis.__relayOperatorTest.db = {
    prepare(sql) { return { bind(...values) { return { all: async () => {
      globalThis.__relayOperatorTest.queries.push({ sql, values });
      return { results: sql.includes('operator_tasks')
        ? [{ title: 'Complete pilot readiness', status: 'blocked', approval: 'not_required', next_action: 'Verify backups' }]
        : [{ kind: 'decision', title: 'Pilot safety', content: 'Do not route customer traffic before verification.', updated: '2026-10-19T00:00:00.000Z' }] };
    } }; } }; },
  };

  const route = await import(pathToFileURL(output).href);
  const request = (origin = 'https://relay.test') => new Request('https://relay.test/api/operator/plan', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Improve Relay readiness', objective: 'Make the pilot safer.' }),
  });

  const response = await route.POST(request());
  assert.equal(response.status, 200);
  const userInput = JSON.parse(globalThis.__relayOperatorTest.aiRequest.input[1].content);
  assert.equal(userInput.relayContext.health.readyForPilot, false);
  assert.equal(userInput.relayContext.health.pilotBlockers[0].id, 'backup:restore');
  assert.equal(userInput.relayContext.tasks[0].title, 'Complete pilot readiness');
  assert.equal(userInput.relayContext.memory[0].title, 'Pilot safety');
  assert.equal(JSON.stringify(userInput).includes('must-not-be-sent-to-model'), false);
  assert.match(globalThis.__relayOperatorTest.aiRequest.input[0].content, /Do not invent integrations, incidents, or completed work/);
  assert.deepEqual(globalThis.__relayOperatorTest.queries.map(query => query.values), [['owner-1'], ['owner-1']]);
});

test('owner planning fails closed and rejects cross-origin requests', async () => {
  globalThis.__relayOperatorTest.auth = { user: { userId: 'other', email: 'other@example.test' } };
  globalThis.__relayOperatorTest.ownerAccess = { ok: false, status: 403, error: 'Owner access required.' };
  const route = await import(pathToFileURL(output).href);
  const request = (origin) => new Request('https://relay.test/api/operator/plan', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Improve Relay', objective: 'Plan a useful improvement.' }),
  });
  assert.equal((await route.POST(request('https://relay.test'))).status, 403);
  globalThis.__relayOperatorTest.ownerAccess = { ok: true };
  assert.equal((await route.POST(request('https://foreign.test'))).status, 403);
});
