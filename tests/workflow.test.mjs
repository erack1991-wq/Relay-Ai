import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Compile the actual route, substituting only identity and the runtime binding.
// Uses a disposable local D1 instance, never the user's saved workspace.
const output = resolve('.sites-runtime/tests/route.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/workspace/route.ts'], outfile: output, bundle: true,
  platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'isolated-test-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$|^@\/app\/chatgpt-auth$/ }, args => ({ path: args.path, namespace: 'test-runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'test-runtime' }, args => ({ contents: args.path === 'cloudflare:workers'
      ? 'export const env = globalThis.__relayTest.env;'
      : 'export async function getChatGPTUser(){return globalThis.__relayTest.user;}' }));
  } }]
});

test('Relay customer-to-booking workflow and access boundaries', async t => {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch(){return new Response("test")} }', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(n => n.endsWith('.sql')).sort()) {
    const sql = await readFile(resolve('drizzle', file), 'utf8');
    for (const statement of sql.split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(statement).run();
  }
  globalThis.__relayTest = { env: { DB: db }, user: { userId: 'owner-a', email: 'a@example.test' } };
  const api = await import(pathToFileURL(output).href);
  async function get(w) { const r = await api.GET(new Request('http://relay.test/api/workspace' + (w ? '?workspace=' + w : ''))); return { status: r.status, body: await r.json() }; }
  async function post(body, origin = 'http://relay.test') { const r = await api.POST(new Request('http://relay.test/api/workspace', { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })); return { status: r.status, body: await r.json() }; }
  const a = (await post({ action: 'create_workspace', name: 'Test HVAC', sample: true })).body.id;
  const b = (await post({ action: 'create_workspace', name: 'Another business' })).body.id;
  const initial = (await get(a)).body;
  const maya = initial.customers.find(c => c.name === 'Maya Chen');
  const quote = initial.items.find(i => i.kind === 'quote');

  await t.test('unknown identity, foreign origins, and malformed bodies are rejected', async () => {
    globalThis.__relayTest.user = null;
    assert.equal((await get(a)).status, 401);
    globalThis.__relayTest.user = { userId: 'owner-a' };
    assert.equal((await post({ action: 'run_autopilot', workspace: a }, 'http://foreign.test')).status, 403);
    assert.equal((await post(null)).status, 400);
  });
  await t.test('another owner cannot read or mutate the workspace', async () => {
    globalThis.__relayTest.user = { userId: 'owner-b' };
    assert.equal((await get(a)).status, 404);
    assert.equal((await post({ action: 'run_autopilot', workspace: a })).status, 404);
    assert.equal((await get()).body.workspaces.length, 0);
    globalThis.__relayTest.user = { userId: 'owner-a' };
  });
  await t.test('customer IDs cannot cross workspace boundaries', async () => {
    assert.equal((await post({ action: 'simulate_call', workspace: b, customer: maya.id, message: 'Hello', missed: true })).status, 404);
    assert.equal((await get(b)).body.customers.length, 0);
    assert.equal((await post({ action: 'create_customer', workspace: a, name: 'Duplicate', phone: maya.phone })).status, 409);
  });
  await t.test('missed call creates a saved message and follow-up trigger', async () => {
    const result = await post({ action: 'simulate_call', workspace: a, customer: maya.id, message: 'Please call about my furnace.', missed: true });
    assert.equal(result.status, 200);
    const state = (await get(a)).body;
    assert.equal(state.items.length, initial.items.length + 1);
    assert.equal(state.messages.length, initial.messages.length + 1);
  });
  await t.test('autopilot is repeatable without duplicate drafts', async () => {
    assert.equal((await post({ action: 'run_autopilot', workspace: a })).body.generated, 6);
    assert.equal((await post({ action: 'run_autopilot', workspace: a })).body.generated, 0);
    assert.equal((await get(a)).body.tasks.length, 6);
  });
  let delivered;
  await t.test('review delivery is persisted once, including concurrent requests', async () => {
    delivered = (await get(a)).body.tasks.find(t => t.source === quote.id);
    const body = { action: 'review_task', workspace: a, id: delivered.id, message: delivered.body };
    const responses = await Promise.all([post(body), post(body)]);
    assert.ok(responses.some(r => r.status === 200));
    assert.equal((await get(a)).body.messages.filter(m => m.id === delivered.id).length, 1);
    assert.equal((await post(body)).status, 409);
  });
  await t.test('STOP blocks both manual and pending follow-up delivery', async () => {
    assert.equal((await post({ action: 'simulate_sms', workspace: a, customer: maya.id, message: 'STOP', inbound: true })).status, 200);
    assert.equal((await post({ action: 'simulate_sms', workspace: a, customer: maya.id, message: 'Hello' })).status, 409);
    const draft = (await get(a)).body.tasks.find(t => t.customer === maya.id && t.status === 'draft');
    assert.equal((await post({ action: 'review_task', workspace: a, id: draft.id, message: draft.body })).status, 409);
    assert.equal((await get(a)).body.customers.find(c => c.id === maya.id).opted_out, 1);
  });
  let bookingId, slot;
  await t.test('booking is linked to its opportunity and canonical UTC conflicts are blocked', async () => {
    const dt = new Date(Date.now() + 30 * 86400000); dt.setUTCHours(16, 0, 0, 0); slot = dt.toISOString();
    const result = await post({ action: 'book', workspace: a, customer: quote.customer, source: quote.id, title: 'Replacement estimate visit', start: slot });
    assert.equal(result.status, 201); bookingId = result.body.id;
    const state = (await get(a)).body;
    assert.equal(state.items.find(i => i.id === quote.id).status, 'booked');
    assert.equal(state.bookings.find(b => b.id === bookingId).source, quote.id);
    const equivalent = slot.replace('.000Z', 'Z');
    assert.equal((await post({ action: 'book', workspace: a, customer: maya.id, title: 'Clashing appointment', start: equivalent })).status, 409);
    assert.equal((await post({ action: 'book', workspace: a, customer: maya.id, source: quote.id, title: 'Wrong customer', start: new Date(dt.getTime()+3600000).toISOString() })).status, 409);
  });
  await t.test('cancellation keeps history, reopens source, and releases the time', async () => {
    assert.equal((await post({ action: 'cancel_booking', workspace: a, id: bookingId })).status, 200);
    const state = (await get(a)).body;
    assert.equal(state.bookings.find(b => b.id === bookingId).status, 'canceled');
    assert.equal(state.items.find(i => i.id === quote.id).status, 'open');
    assert.equal((await post({ action: 'book', workspace: a, customer: quote.customer, source: quote.id, title: 'New appointment', start: slot })).status, 201);
  });
  await t.test('disabled workflows and closed sources cannot be delivered', async () => {
    let state = (await get(a)).body;
    const review = state.tasks.find(t => t.kind === 'review');
    const cfg = state.workspace.config; cfg.rules.review = false;
    assert.equal((await post({ action: 'save_config', workspace: a, config: cfg })).status, 200);
    assert.equal((await post({ action: 'review_task', workspace: a, id: review.id, message: review.body })).status, 409);
    const invoice = state.items.find(i => i.kind === 'invoice');
    assert.equal((await post({ action: 'close_item', workspace: a, id: invoice.id })).status, 200);
    state = (await get(a)).body;
    assert.equal(state.tasks.find(t => t.source === invoice.id).status, 'dismissed');
  });
});
