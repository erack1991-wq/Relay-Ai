import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = readFileSync(new URL('../lib/owner-ai/core.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replaceAll('export ', ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
}).outputText;
const api = new Function(compiled + '; return { authorizeTool, storageNamespace, providerFromEnvironment };')();
const personal = { userId: 'user-1', surface: 'personal' };
const relay = { userId: 'user-1', surface: 'relay_owner', workspaceId: 'relay' };
const request = capability => ({ capability, target: 'sample', reason: 'test' });

test('personal and Relay memory namespaces are isolated', () => {
  assert.notEqual(api.storageNamespace(personal), api.storageNamespace(relay));
  assert.notEqual(api.storageNamespace(personal), api.storageNamespace({ userId: 'user-2', surface: 'personal' }));
  assert.throws(() => api.storageNamespace({ userId: 'user-1', surface: 'relay_owner' }));
});

test('sensitive actions require approval', () => {
  assert.equal(api.authorizeTool(relay, request('deploy')).requiresApproval, true);
  assert.equal(api.authorizeTool(relay, request('deploy'), true).allowed, true);
  assert.equal(api.authorizeTool(personal, request('billing'), true).allowed, false);
  assert.equal(api.authorizeTool(personal, request('chat')).allowed, true);
});

test('unverified actor and workspace are denied', () => {
  assert.equal(api.authorizeTool({ userId: '', surface: 'personal' }, request('chat')).allowed, false);
  assert.equal(api.authorizeTool({ userId: 'a', surface: 'relay_owner' }, request('chat')).allowed, false);
});

test('provider availability never returns credentials', () => {
  assert.equal(api.providerFromEnvironment('openai', { OPENAI_API_KEY: 'secret' }), true);
  assert.equal(api.providerFromEnvironment('anthropic', {}), false);
});
