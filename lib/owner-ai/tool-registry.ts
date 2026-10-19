/**
 * Relay Owner AI tool catalog.
 *
 * Declarative only: registering a tool does not grant access or execute it.
 * Actual executors must verify trusted identity, workspace scope, grants,
 * server-side approval, audit logs, rate limits, and service credentials.
 */
export type ToolRisk = 'read' | 'write' | 'sensitive';
export type ToolDefinition = Readonly<{
  id: string;
  description: string;
  integration: 'github' | 'vercel' | 'supabase' | 'twilio' | 'stripe';
  risk: ToolRisk;
  requiresApproval: boolean;
}>;

export const OWNER_TOOL_CATALOG: readonly ToolDefinition[] = Object.freeze([
  { id: 'github.repo.read', description: 'Inspect repository metadata and files', integration: 'github', risk: 'read', requiresApproval: false },
  { id: 'github.pr.prepare', description: 'Prepare a pull request for review', integration: 'github', risk: 'write', requiresApproval: true },
  { id: 'vercel.deployment.read', description: 'Inspect deployment status', integration: 'vercel', risk: 'read', requiresApproval: false },
  { id: 'vercel.deployment.promote', description: 'Promote a deployment', integration: 'vercel', risk: 'sensitive', requiresApproval: true },
  { id: 'supabase.schema.read', description: 'Inspect permitted database schema', integration: 'supabase', risk: 'read', requiresApproval: false },
  { id: 'supabase.sql.execute', description: 'Execute database changes', integration: 'supabase', risk: 'sensitive', requiresApproval: true },
  { id: 'twilio.status.read', description: 'Inspect messaging service status', integration: 'twilio', risk: 'read', requiresApproval: false },
  { id: 'twilio.message.send', description: 'Send an outbound message', integration: 'twilio', risk: 'sensitive', requiresApproval: true },
  { id: 'stripe.balance.read', description: 'Read scoped balance summaries', integration: 'stripe', risk: 'read', requiresApproval: false },
  { id: 'stripe.refund.create', description: 'Issue a refund', integration: 'stripe', risk: 'sensitive', requiresApproval: true },
]);

export function findOwnerTool(id: string): ToolDefinition | undefined {
  return OWNER_TOOL_CATALOG.find(tool => tool.id === id);
}

export function describeOwnerTools() {
  return OWNER_TOOL_CATALOG.map(({ id, description, integration, risk, requiresApproval }) =>
    ({ id, description, integration, risk, requiresApproval }));
}

/**
 * Fail closed. This is an additional policy check, not a substitute for
 * authenticated, signed, single-use approval records on the execution server.
 */
export function canExecuteOwnerTool(
  toolId: string,
  context: {
    authenticatedOwner: boolean;
    workspaceId: string | null;
    grantedIntegrations: readonly string[];
    verifiedApproval: boolean;
  },
): boolean {
  const tool = findOwnerTool(toolId);
  if (!tool || !context.authenticatedOwner || !context.workspaceId ||
      !context.grantedIntegrations.includes(tool.integration)) return false;
  return !tool.requiresApproval || context.verifiedApproval;
}
