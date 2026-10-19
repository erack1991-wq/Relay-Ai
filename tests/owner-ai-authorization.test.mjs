import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

function loadSource(path, exports) {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8')
    .replace(/^import .*;\s*$/gm, '')
    .replaceAll('export ', '');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
  }).outputText;
  return { compiled, exports };
}

const registry = loadSource('../lib/owner-ai/tool-registry.ts', 'findOwnerTool, canExecuteOwnerTool');
const authorization = loadSource('../lib/owner-ai/tool-authorization.ts', 'authorizeOwnerInvocation');
const api = new Function(registry.compiled + '\n' + authorization.compiled +
  '\nreturn { findOwnerTool, canExecuteOwnerTool, authorizeOwnerInvocation };')();

const actor = {
  userId: 'owner-1', workspaceId: 'relay',
  authenticatedOwner: true, grantedIntegrations: ['github'],
};
const invocation = { toolId: 'github.pr.prepare', workspaceId: 'relay', arguments: { title: 'Fix' } };
const digest = 'a'.repeat(64);
const now = 1_000_000;
const approval = {
  toolId: invocation.toolId, workspaceId: 'relay', userId: 'owner-1',
  argumentDigest: digest, expiresAt: now + 1000, consumed: false,
};

test('unknown tools and ungranted integrations fail closed', () => {
  assert.equal(api.canExecuteOwnerTool('made.up', { authenticatedOwner: true, workspaceId: 'relay', grantedIntegrations: ['github'], verifiedApproval: true }), false);
  assert.equal(api.authorizeOwnerInvocation({ ...invocation, toolId: 'stripe.refund.create' }, actor, approval, digest, now).allowed, false);
});

test('read-only granted tool is allowed without approval', () => {
  const result = api.authorizeOwnerInvocation({ ...invocation, toolId: 'github.repo.read' }, actor, null, digest, now);
  assert.equal(result.allowed, true);
});

test('write operation needs a matching, fresh, unused approval', () => {
  assert.equal(api.authorizeOwnerInvocation(invocation, actor, null, digest, now).allowed, false);
  assert.equal(api.authorizeOwnerInvocation(invocation, actor, approval, digest, now).allowed, true);
  assert.equal(api.authorizeOwnerInvocation(invocation, actor, { ...approval, consumed: true }, digest, now).allowed, false);
  assert.equal(api.authorizeOwnerInvocation(invocation, actor, approval, digest, now + 1000).allowed, false);
  assert.equal(api.authorizeOwnerInvocation(invocation, actor, approval, 'b'.repeat(64), now).allowed, false);
});

test('identity and workspace mismatches are denied', () => {
  assert.equal(api.authorizeOwnerInvocation(invocation, { ...actor, authenticatedOwner: false }, approval, digest, now).allowed, false);
  assert.equal(api.authorizeOwnerInvocation(invocation, { ...actor, userId: 'other' }, approval, digest, now).allowed, false);
  assert.equal(api.authorizeOwnerInvocation({ ...invocation, workspaceId: 'other' }, actor, approval, digest, now).allowed, false);
});
