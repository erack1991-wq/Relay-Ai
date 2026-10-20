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
    b.onResolve({ filter: /^cloudflare:workers$|^@\/app\/chatgpt-auth$|^@\/lib\/ai-gateway$/ }, args => ({ path: args.path, namespace: 'operator-test-runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'operator-test-runtime' }, args => ({ contents: args.path === 'cloudflare:workers'
      ? 'export const env = globalThis.__relayOperatorTest.env;'
      : args.path === '@/app/chatgpt-auth'
        ? 'export async function getChatGPTUser(){return globalThis.__relayOperatorTest.user;}'
        : 'export async function aiResponse(request){globalThis.__relayOperatorTest.aiRequest=request;return {output:[{content:[{type:"output_text",text:JSON.stringify(globalThis.__relayOperatorTest.plan)}]}]};}' }));
  } }]
});

test('Owner AI planning is owner-only, fails closed, and only returns a saved plan', async () => {
  globalThis.__relayOperatorTest = {
    user: null,
    env: {},
    plan: { summary: 'Review capacity', steps: ['Inspect schedule'], nextAction: 'Check open slots', approvalRequired: true, approvalReason: 'Confirm before contacting customers' },
  };
  const routeModule = await import(pathToFileURL(output).href);
  const request = (origin = 'http://relay.test') => new Request('http://relay.test/api/operator/plan', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Improve bookings', objective: 'Find a safe way to fill next week.' }),
  });

  assert.equal((await routeModule.POST(request())).status, 401);
  globalThis.__relayOperatorTest.user = { userId: 'visitor', email: 'visitor@example.test' };
  assert.equal((await routeModule.POST(request())).status, 503);
  globalThis.__relayOperatorTest.env.RELAY_OWNER_EMAIL = 'owner@example.test';
  assert.equal((await routeModule.POST(request())).status, 403);

  globalThis.__relayOperatorTest.user = { userId: 'owner', email: 'owner@example.test' };
  assert.equal((await routeModule.POST(request('http://foreign.test'))).status, 403);
  const result = await routeModule.POST(request());
  assert.equal(result.status, 200);
  assert.equal((await result.json()).plan.approvalRequired, true);
  assert.equal(globalThis.__relayOperatorTest.aiRequest.store, undefined);
  assert.equal(globalThis.__relayOperatorTest.aiRequest.input[1].content.includes('Find a safe way to fill next week.'), true);
});
