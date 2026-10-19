/**
 * Shared, side-effect-free AI engine policy primitives.
 * Personal and Relay Owner AI share these types and routing rules, never identities,
 * secrets, memories, or authorization grants.
 */
export type AiSurface = 'personal' | 'relay_owner';
export type ModelProvider = 'openai' | 'anthropic' | 'google' | 'ollama';
export type Capability = 'chat' | 'research' | 'read_files' | 'write_files' | 'browser' | 'terminal' | 'deploy' | 'billing';

export type ActorContext = Readonly<{
  userId: string;
  surface: AiSurface;
  workspaceId?: string;
}>;

export type ToolRequest = Readonly<{
  capability: Capability;
  target: string;
  reason: string;
}>;

export type AuthorizationDecision =
  | { allowed: true; requiresApproval: false }
  | { allowed: false; requiresApproval: boolean; reason: string };

const sensitive = new Set<Capability>(['write_files', 'terminal', 'deploy', 'billing']);
const permitted: Record<AiSurface, ReadonlySet<Capability>> = {
  personal: new Set(['chat', 'research', 'read_files', 'write_files', 'browser', 'terminal']),
  relay_owner: new Set(['chat', 'research', 'read_files', 'write_files', 'browser', 'terminal', 'deploy', 'billing']),
};

/** This policy is defense in depth, NOT a replacement for server-side identity checks. */
export function authorizeTool(
  actor: ActorContext,
  request: ToolRequest,
  approved = false,
): AuthorizationDecision {
  if (!actor.userId.trim()) return { allowed: false, requiresApproval: false, reason: 'Missing verified identity' };
  if (actor.surface === 'relay_owner' && !actor.workspaceId?.trim()) {
    return { allowed: false, requiresApproval: false, reason: 'Missing verified Relay workspace' };
  }
  if (!permitted[actor.surface]?.has(request.capability)) {
    return { allowed: false, requiresApproval: false, reason: 'Capability unavailable on this surface' };
  }
  if (!request.target.trim() || !request.reason.trim()) {
    return { allowed: false, requiresApproval: false, reason: 'Target and reason are required' };
  }
  if (sensitive.has(request.capability) && !approved) {
    return { allowed: false, requiresApproval: true, reason: 'Explicit approval required' };
  }
  return { allowed: true, requiresApproval: false };
}

/** Never use user-supplied namespaces as storage keys. Derive them from verified server context. */
export function storageNamespace(actor: ActorContext): string {
  if (!actor.userId.trim()) throw new Error('Verified identity required');
  if (actor.surface === 'relay_owner') {
    if (!actor.workspaceId?.trim()) throw new Error('Verified workspace required');
    return JSON.stringify(['relay_owner', actor.workspaceId, actor.userId]);
  }
  if (actor.surface !== 'personal') throw new Error('Unknown surface');
  return JSON.stringify(['personal', actor.userId]);
}

export function providerFromEnvironment(
  provider: ModelProvider,
  env: Record<string, string | undefined>,
): boolean {
  const key: Record<ModelProvider, string> = {
    openai: 'OPENAI_API_KEY',
    anthropic: 'ANTHROPIC_API_KEY',
    google: 'GOOGLE_GENERATIVE_AI_API_KEY',
    ollama: 'OLLAMA_BASE_URL',
  };
  return Boolean(env[key[provider]]?.trim());
}
