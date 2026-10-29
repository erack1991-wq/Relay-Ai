import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const output = resolve('.sites-runtime/tests/health-auth-readiness.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/health/route.ts'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'health-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, args => ({ path: args.path, namespace: 'health-runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'health-runtime' }, () => ({ contents: 'export const env=globalThis.__healthAuthTest.env;' }));
  } }],
});

test('pilot readiness fails closed on missing and invalid production-auth evidence', async t => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(n => n.endsWith('.sql')).sort()) {
    const statements = (await readFile(resolve('drizzle', file), 'utf8'))
      .split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  const verifiedAt = new Date(Date.now() - 60_000).toISOString();
  const env = {
    DB: db,
    TWILIO_ACCOUNT_SID: 'test', TWILIO_AUTH_TOKEN: 'test', TWILIO_PHONE_NUMBER: '+15555550100',
    OPENAI_API_KEY: 'test', PUBLIC_BASE_URL: 'https://example.invalid',
    STRIPE_SECRET_KEY: 'test', STRIPE_PRICE_ID: 'test', STRIPE_WEBHOOK_SECRET: 'test',
    PROVIDER_VERIFIED_AT: verifiedAt, BACKUP_VERIFIED_AT: verifiedAt, BACKUP_RESTORE_TESTED_AT: verifiedAt,
  };
  globalThis.__healthAuthTest = { env };
  const { GET } = await import(pathToFileURL(output).href);

  const missing = await (await GET()).json();
  assert.equal(missing.databaseReachable, true);
  assert.equal(missing.configurationReady, true);
  assert.equal(missing.providerVerification, 'verified');
  assert.equal(missing.readyForPilot, false);
  assert.equal(missing.productionAuthVerification, 'not_run');
  assert.ok(missing.pilotBlockers.some(b => b.id === 'auth:production' && b.status === 'unverified'));
  assert.ok(missing.configurationWarnings.some(w => w.includes('tenant isolation')));

  env.PRODUCTION_AUTH_VERIFIED_AT = 'not-a-timestamp';
  const invalid = await (await GET()).json();
  assert.equal(invalid.readyForPilot, false);
  assert.equal(invalid.productionAuthVerification, 'invalid');
  assert.ok(invalid.pilotBlockers.some(b => b.id === 'auth:production' && b.status === 'invalid'));

  env.PRODUCTION_AUTH_VERIFIED_AT = new Date(Date.now() + 60_000).toISOString();
  const future = await (await GET()).json();
  assert.equal(future.readyForPilot, false);
  assert.equal(future.productionAuthVerification, 'invalid');

  env.PRODUCTION_AUTH_VERIFIED_AT = verifiedAt;
  const verified = await (await GET()).json();
  assert.equal(verified.productionAuthVerification, 'verified');
  assert.equal(verified.readyForPilot, true);
  assert.ok(!verified.pilotBlockers.some(b => b.id === 'auth:production'));
});
