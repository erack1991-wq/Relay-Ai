import { createHash, randomUUID } from 'node:crypto';
import { authorizeOwnerInvocation, type OwnerToolInvocation, type VerifiedOwnerContext, type VerifiedApproval } from './tool-authorization';

/** Reference implementation contract; the production store must use transactions. */
export type ApprovalRecord = VerifiedApproval & {
  id: string;
  createdAt: number;
  consumedAt: number | null;
};

export type AuditEvent = {
  id: string;
  at: number;
  actorId: string;
  workspaceId: string;
  toolId: string;
  outcome: 'requested' | 'approved' | 'denied' | 'consumed';
  approvalId: string | null;
};

export interface ApprovalAuditStore {
  createApproval(record: ApprovalRecord): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
  /** Atomically check identity, digest, expiry, consumed=false, then consume and log. */
  consumeOnce(recordId: string, actor: VerifiedOwnerContext, invocation: OwnerToolInvocation, digest: string, now: number): Promise<boolean>;
}

export function digestToolArguments(args: unknown): string {
  // Use exact canonical request bytes at the API boundary; JSON serialization
  // here is intended for already-normalized, validated argument objects only.
  return createHash('sha256').update(JSON.stringify(args)).digest('hex');
}

export function prepareApproval(
  actor: VerifiedOwnerContext,
  invocation: OwnerToolInvocation,
  argumentDigest: string,
  now = Date.now(),
): ApprovalRecord {
  if (!actor.authenticatedOwner || !actor.userId || !actor.workspaceId ||
      actor.workspaceId !== invocation.workspaceId || !/^[a-f0-9]{64}$/.test(argumentDigest)) {
    throw new Error('Invalid approval request');
  }
  const id = randomUUID();
  return {
    id, userId: actor.userId, workspaceId: actor.workspaceId,
    toolId: invocation.toolId, argumentDigest, createdAt: now,
    expiresAt: now + 5 * 60 * 1000, consumed: false, consumedAt: null,
  };
}

export async function consumeAuthorizedApproval(
  store: ApprovalAuditStore,
  actor: VerifiedOwnerContext,
  invocation: OwnerToolInvocation,
  approval: ApprovalRecord,
  argumentDigest: string,
  now = Date.now(),
): Promise<boolean> {
  const decision = authorizeOwnerInvocation(invocation, actor, approval, argumentDigest, now);
  if (!decision.allowed) {
    await store.appendAudit({
      id: randomUUID(), at: now, actorId: actor.userId,
      workspaceId: actor.workspaceId, toolId: invocation.toolId,
      outcome: 'denied', approvalId: approval.id,
    });
    return false;
  }
  // The database must atomically enforce single-use and log consumption.
  return store.consumeOnce(approval.id, actor, invocation, argumentDigest, now);
}
