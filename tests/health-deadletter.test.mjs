import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

const output = resolve('.sites-runtime/tests/health-deadletter.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/health/route.ts'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'health-runtime', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$/ }, args => ({ path: args.path, namespace: 'health-runtime' }));
    b.onLoad({ filter: /.*/, namespace: 'health-runtime' }, () => ({ contents: 'export const env=globalThis.__healthTest.env;' }));
  } }],
});

test('health warns on exhausted dead-letter jobs', async t => {
  const mf = new Miniflare({ modules: true, script: 'export default {fetch(){return new Response("test")}}', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  for (const file of (await readdir('drizzle')).filter(n => n.endsWith('.sql')).sort()) {
    const statements = (await readFile(resolve('drizzle', file), 'utf8'))
      .split('--> statement-breakpoint').map(s => s.trim()).filter(Boolean);
    for (const sql of statements) await db.prepare(sql).run();
  }
  globalThis.__healthTest = { env: { DB: db } };
  const api = await import(pathToFileURL(output).href);
  const baseline = await (await api.GET()).json();
  assert.equal(baseline.operations.failedJobs, 0);
  const now = new Date().toISOString();
  await db.prepare('INSERT INTO jobs(id,kind,payload,status,attempts,run_after,last_error,created,updated) VALUES(?,?,?,?,?,?,?,?,?)')
    .bind('dead-letter-test-1','followup','{}','dead_letter',5,now,'test exhausted',now,now).run();
  const response = await api.GET();
  assert.equal(response.status, 200);
  const health = await response.json();
  assert.equal(health.operations.failedJobs, 1);
  assert.ok(health.pilotWarnings.some(w => w.id === 'operations:failed-work'));
});
