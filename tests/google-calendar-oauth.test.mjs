import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { Miniflare } from 'miniflare';

// Exercise the real OAuth callback and an isolated D1 database. Identity and
// Google's token exchange are substituted; no external OAuth calls are made.
const output = resolve('.sites-runtime/tests/google-calendar-oauth-route.mjs');
await mkdir(resolve('.sites-runtime/tests'), { recursive: true });
await build({
  entryPoints: ['app/api/google-calendar/callback/route.ts'], outfile: output,
  bundle: true, platform: 'node', format: 'esm', logLevel: 'silent',
  plugins: [{ name: 'isolated-oauth-test', setup(b) {
    b.onResolve({ filter: /^cloudflare:workers$|^@\\/app\\/chatgpt-auth$|^@\\/lib\\/google-calendar$/ }, args => ({ path: args.path, namespace: 'oauth-test' }));
    b.onLoad({ filter: /.*/, namespace: 'oauth-test' }, args => ({ contents:
      args.path === 'cloudflare:workers'
        ? 'export const env = globalThis.__relayOAuthTest.env;'
        : args.path === '@/app/chatgpt-auth'
          ? 'export async function getChatGPTUser(){return globalThis.__relayOAuthTest.user;}'
          : 'export async function exchangeGoogleCode(){globalThis.__relayOAuthTest.exchanges++;return {access_token:"access-test",refresh_token:"refresh-test",expires_in:3600};} export async function encryptGoogleToken(v){return "sealed:"+v;}'
    }));
  } }]
});

test('Google OAuth callback cannot bind a foreign or transferred workspace', async t => {
  const mf = new Miniflare({ modules: true, script: 'export default { fetch(){return new Response("test")} }', compatibilityDate: '2026-05-15', d1Databases: ['DB'] });
  t.after(() => mf.dispose());
  const db = await mf.getD1Database('DB');
  await db.prepare('CREATE TABLE workspaces (id TEXT PRIMARY KEY, owner TEXT NOT NULL)').run();
  await db.prepare('INSERT INTO workspaces(id,owner) VALUES (?,?)').bind('ws-a', 'owner-a').run();
  await db.prepare('INSERT INTO workspaces(id,owner) VALUES (?,?)').bind('ws-b', 'owner-b').run();
  globalThis.__relayOAuthTest = { env: { DB: db }, user: { userId: 'owner-a' }, exchanges: 0 };
  const api = await import(pathToFileURL(output).href);
  const makeState = (workspace, owner) => `${crypto.randomUUID()}.${btoa(JSON.stringify({ workspace, owner, exp: Date.now() + 600000 }))}`;
  const callback = state => api.GET(new Request(`https://relay.test/api/google-calendar/callback?code=test-code&state=${encodeURIComponent(state)}`, {
    headers: { cookie: `relay_google_oauth_state=${encodeURIComponent(state)}` }
  }));

  await t.test('a matching attacker-controlled cookie cannot authorize a foreign workspace', async () => {
    const response = await callback(makeState('ws-b', 'owner-a'));
    assert.equal(response.status, 404);
    assert.equal(globalThis.__relayOAuthTest.exchanges, 0, 'must reject before contacting Google');
  });

  await t.test('ownership revoked after /connect is rejected at callback time', async () => {
    const pending = makeState('ws-a', 'owner-a');
    await db.prepare('UPDATE workspaces SET owner=? WHERE id=?').bind('owner-b', 'ws-a').run();
    const response = await callback(pending);
    assert.equal(response.status, 404);
    assert.equal(globalThis.__relayOAuthTest.exchanges, 0);
  });

  await t.test('the current owner can complete OAuth and persist encrypted tokens', async () => {
    globalThis.__relayOAuthTest.user = { userId: 'owner-b' };
    const response = await callback(makeState('ws-b', 'owner-b'));
    assert.equal(response.status, 302);
    assert.equal(globalThis.__relayOAuthTest.exchanges, 1);
    const row = await db.prepare('SELECT owner,refresh_token,access_token FROM google_calendar_connections WHERE workspace=?').bind('ws-b').first();
    assert.equal(row.owner, 'owner-b');
    assert.equal(row.refresh_token, 'sealed:refresh-test');
    assert.equal(row.access_token, 'sealed:access-test');
    const foreign = await db.prepare('SELECT count(*) AS n FROM google_calendar_connections WHERE workspace=?').bind('ws-a').first();
    assert.equal(foreign.n, 0);
  });
});
