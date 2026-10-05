export type ToolRisk = 'safe' | 'controlled' | 'approval_required';
export type ToolScope = 'read' | 'sandbox_write' | 'preview' | 'production_write';

export type OperatorTool = {
  id: string;
  description: string;
  risk: ToolRisk;
  scope: ToolScope;
  approvalRequired: boolean;
};

export const operatorTools: readonly OperatorTool[] = [
  { id: 'repo.inspect', description: 'Inspect Relay source and configuration without exposing secrets.', risk: 'safe', scope: 'read', approvalRequired: false },
  { id: 'repo.edit_sandbox', description: 'Edit code in the controlled workspace.', risk: 'safe', scope: 'sandbox_write', approvalRequired: false },
  { id: 'verification.run', description: 'Run typecheck, lint, tests, builds, and safe scans.', risk: 'safe', scope: 'read', approvalRequired: false },
  { id: 'browser.qa', description: 'Run browser checks against Relay previews and test environments.', risk: 'controlled', scope: 'preview', approvalRequired: false },
  { id: 'provider.simulate', description: 'Exercise provider workflows with local deterministic simulations.', risk: 'safe', scope: 'sandbox_write', approvalRequired: false },
  { id: 'github.read', description: 'Read issues, pull requests, and CI results when connected.', risk: 'controlled', scope: 'read', approvalRequired: false },
  { id: 'github.write', description: 'Create branches, commits, or pull requests.', risk: 'controlled', scope: 'preview', approvalRequired: true },
  { id: 'deployment.preview', description: 'Create a reversible preview deployment.', risk: 'controlled', scope: 'preview', approvalRequired: false },
  { id: 'deployment.production', description: 'Deploy a production release.', risk: 'approval_required', scope: 'production_write', approvalRequired: true },
  { id: 'secrets.change', description: 'Create, rotate, or remove production credentials.', risk: 'approval_required', scope: 'production_write', approvalRequired: true },
  { id: 'billing.change', description: 'Change pricing, billing, subscriptions, or payments.', risk: 'approval_required', scope: 'production_write', approvalRequired: true },
  { id: 'data.destructive', description: 'Delete or irreversibly transform customer data.', risk: 'approval_required', scope: 'production_write', approvalRequired: true },
];

export function getOperatorTool(id: string) {
  return operatorTools.find((tool) => tool.id === id);
}

export function canRunOperatorTool(id: string, approved = false) {
  const tool = getOperatorTool(id);
  return !!tool && (!tool.approvalRequired || approved);
}
