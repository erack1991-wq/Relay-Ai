import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { renderToStaticMarkup } from 'react-dom/server';

const require = createRequire(import.meta.url);
function load(relative, stubs) {
  const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => name in stubs ? stubs[name] : require(name), exports);
  return exports;
}

function page({ email = 'owner@example.test', configured = 'owner@example.test' } = {}) {
  const values = { OWNER_AI_ALLOWED_EMAILS: configured };
  const access = load('../lib/operator-owner-access.ts', { 'cloudflare:workers': { env: values } });
  return load('../app/operator/command/page.tsx', {
    '@/app/chatgpt-auth': { requireChatGPTUser: async path => {
      assert.equal(path, '/operator/command');
      if (!email) throw new Error('sign-in redirect');
      return { userId: 'test-owner', email };
    } },
    '@/lib/operator-owner-access': access,
    './owner-command-center': { default: () => 'CONNECTED_DASHBOARD' },
  }).default;
}

test('command center redirects an anonymous visitor before exposing owner UI', async () => {
  await assert.rejects(page({ email: '' })(), /sign-in redirect/);
});

test('command center fails closed when owners are not configured', async () => {
  const html = renderToStaticMarkup(await page({ configured: '' })());
  assert.match(html, /Owner access required/);
  assert.doesNotMatch(html, /CONNECTED_DASHBOARD/);
});

test('command center denies another signed-in account', async () => {
  const html = renderToStaticMarkup(await page({ email: 'other@example.test' })());
  assert.match(html, /restricted to configured Relay owners/);
  assert.doesNotMatch(html, /CONNECTED_DASHBOARD/);
});

test('command center admits a configured owner using normalized email comparison', async () => {
  const html = renderToStaticMarkup(await page({ email: 'Owner@Example.Test', configured: ' owner@example.test ' })());
  assert.equal(html, 'CONNECTED_DASHBOARD');
});
