import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const output = resolve('.sites-runtime/tests/billing.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({ entryPoints: ['app/api/billing/webhook/route.ts'], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent', plugins: [{ name: 'billing-runtime', setup(b) { b.onResolve({ filter: /^cloudflare:workers$/ }, args => ({ path: args.path, namespace: 'billing-runtime' })); b.onLoad({ filter: /.*/, namespace: 'billing-runtime' }, () => ({ contents: 'export const env=globalThis.__billingTest.env;' })); } }] });

test('Stripe subscription webhooks persist state and are idempotent', async t => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(n => n.endsWith('.sql')).sort()) for (const sql of (await readFile(resolve('drizzle', file), 'utf8')).split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean)) await db.prepare(sql).run();
  const secret = 'stripe-test-secret';
  globalThis.__billingTest = { env: { DB: db, STRIPE_WEBHOOK_SECRET: secret } };
  const api = await import(pathToFileURL(output).href);
  async function post(event, timestamp = Math.floor(Date.now() / 1000)) {
    const raw = JSON.stringify(event);
    const signature = createHmac('sha256', secret).update(`${timestamp}.${raw}`).digest('hex');
    return api.POST(new Request('https://relay.test/api/billing/webhook', { method: 'POST', headers: { 'stripe-signature': `t=${timestamp},v1=${signature}` }, body: raw }));
  }
  const owner = 'owner-paid';
  const event = { id: 'evt_paid_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', customer: 'cus_1', subscription: 'sub_1', metadata: { owner } } } };
  assert.equal((await post(event)).status, 204);
  assert.deepEqual(await db.prepare('SELECT owner,stripe_customer_id,stripe_subscription_id,status FROM subscriptions').first(), { owner, stripe_customer_id: 'cus_1', stripe_subscription_id: 'sub_1', status: 'active' });
  assert.equal((await post(event)).status, 204);
  assert.equal((await db.prepare('SELECT count(*) AS n FROM subscription_events').first()).n, 1);
  const canceled = { id: 'evt_cancel_1', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled' } } };
  assert.equal((await post(canceled)).status, 204);
  assert.equal((await db.prepare('SELECT status FROM subscriptions WHERE owner=?').bind(owner).first()).status, 'canceled');
});
