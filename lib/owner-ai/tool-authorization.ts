import { canExecuteOwnerTool, findOwnerTool } from './tool-registry';

/**
 * Pure, deny-by-default authorization for a future tool executor.
 * A real executor must additionally validate signed session identity,
 * a server-side one-time approval, credential scopes, and transaction audit.
 */
export type OwnerToolInvocation = {
  toolId: string;
  workspaceId: string;
  arguments: unknown;
};

export type VerifiedOwnerContext = {
  userId: string;
  workspaceId: string;
  authenticatedOwner: boolean;
  grantedIntegrations: readonly string[];
};

export type VerifiedApproval = {
  toolId: string;
  workspaceId: string;
  userId: string;
  argumentDigest: string;
  expiresAt: number;
  consumed: boolean;
};

export function authorizeOwnerInvocation(
  invocation: OwnerToolInvocation,
  actor: VerifiedOwnerContext,
  approval: VerifiedApproval | null,
  argumentDigest: string,
  now: number,
): { allowed: boolean; reason: string } {
  const tool = findOwnerTool(invocation.toolId);
  if (!tool) return { allowed: false, reason: 'unknown_tool' };
  if (!actor.authenticatedOwner || !actor.userId || !actor.workspaceId ||
      invocation.workspaceId !== actor.workspaceId) {
    return { allowed: false, reason: 'identity_or_scope' };
  }
  const verifiedApproval = !!approval &&
    approval.toolId === invocation.toolId &&
    approval.workspaceId === actor.workspaceId &&
    approval.userId === actor.userId &&
    approval.argumentDigest === argumentDigest &&
    !approval.consumed &&
    Number.isFinite(approval.expiresAt) &&
    approval.expiresAt > now;
  const allowed = canExecuteOwnerTool(invocation.toolId, {
    authenticatedOwner: actor.authenticatedOwner,
    workspaceId: actor.workspaceId,
    grantedIntegrations: actor.grantedIntegrations,
    verifiedApproval,
  });
  return { allowed, reason: allowed ? 'allowed' :
    tool.requiresApproval && !verifiedApproval ? 'approval_required' : 'integration_not_granted' };
}

/**
 * This interface deliberately does not provide a runnable implementation.
 * Implementations must atomically consume approval and append an audit record
 * before dispatching a sensitive external operation.
 */
export interface OwnerToolExecutor {
  execute(invocation: OwnerToolInvocation, actor: VerifiedOwnerContext): Promise<unknown>;
}
