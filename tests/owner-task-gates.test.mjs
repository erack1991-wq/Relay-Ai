import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const output = resolve('.sites-runtime/tests/owner-task-gates.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({ entryPoints: ['app/api/operator/tasks/route.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'owner-task-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$|^@\/app\/chatgpt-auth$|^@\/lib\/telephony$|^@\/db\/database$|^@\/lib\/reliability$/ }, args => ({ path: args.path, namespace: 'owner-task-test' }));
    b.onLoad({ filter: /.*/, namespace: 'owner-task-test' }, args => ({ contents: ({
      'cloudflare:workers': 'export const env = globalThis.ownerTaskTest.env;',
      '@/app/chatgpt-auth': 'export async function getChatGPTUser(){return globalThis.ownerTaskTest.user;}',
      '@/lib/telephony': 'export function bindings(){return globalThis.ownerTaskTest.env;}',
      '@/db/database': 'export function database(){return globalThis.ownerTaskTest.db;}',
      '@/lib/reliability': 'export async function recordAudit(){}',
    })[args.path] }));
  } }],
});

test('reconciled task API preserves owner checks, pending decisions and saved plans', async () => {
  const runtime = globalThis.ownerTaskTest = {
    user: { userId: 'owner-id', email: 'owner@example.test' },
    env: { RELAY_OWNER_EMAIL: 'owner@example.test', OWNER_AI_ALLOWED_EMAILS: 'owner@example.test,other@example.test' },
    existing: { id: 'task-1', status: 'queued', approval: 'pending_owner' },
    inserts: [], batches: [],
  };
  runtime.db = {
    prepare(sql) { return { bind(...values) { return {
      first: async () => runtime.existing,
      run: async () => { runtime.inserts.push({ sql, values }); return { meta: { changes: 1 } }; },
      sql, values,
    }; } }; },
    batch: async statements => { runtime.batches.push(statements); return [{ meta: { changes: 1 } }, { meta: { changes: 1 } }]; },
  };
  const route = await import(pathToFileURL(output).href);
  const request = (method, body) => new Request('https://relay.test/api/operator/tasks', { method, headers: { Origin: 'https://relay.test', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  runtime.user.email = 'other@example.test';
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', status: 'in_progress' }))).status, 403, 'main owner restriction still applies even to an AI-allowlisted account');
  runtime.user.email = 'owner@example.test';
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', status: 'in_progress' }))).status, 409);
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', status: 'completed' }))).status, 409);
  assert.equal(runtime.batches.length, 0);
  const rejected = await route.PATCH(request('PATCH', { id: 'task-1', approval: 'rejected' }));
  assert.equal((await rejected.json()).status, 'cancelled');
  assert.equal(runtime.batches[0].length, 2, 'decision and audit remain in one database batch');
  assert.equal(runtime.batches[0][0].values[0], 'cancelled');
  runtime.existing.approval = 'rejected'; runtime.existing.status = 'cancelled';
  assert.equal((await route.PATCH(request('PATCH', { id: 'task-1', approval: 'approved', status: 'in_progress' }))).status, 409);
  assert.equal((await route.POST(request('POST', { title: 'Test goal', objective: 'Test objective', approval: 'approved' }))).status, 400);
  const created = await route.POST(request('POST', { title: 'Test goal', objective: 'Test objective', approval: 'pending_owner', result: '{"steps":["Review"]}' }));
  assert.equal(created.status, 201);
  assert.equal(runtime.inserts[0].values[7], '{"steps":["Review"]}', 'main plan result field is retained');
});
