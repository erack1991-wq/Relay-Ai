# Shared Owner AI — first implementation

This branch introduces a small shared, side-effect-free TypeScript engine foundation at `lib/owner-ai/core.ts`, with node tests.

## Boundaries
- **Personal AI:** independent application and authentication; personal memory, API credentials and tools.
- **Relay Owner AI:** existing Relay operator experience; Relay-only workspace and operations.
- **Shared engine:** capability vocabulary, policy evaluation, model-provider configuration detection and storage namespace construction; never a shared user database or API-key store.
- **Customers:** must never import or access owner AI routes or owner secrets.

## First implemented slice
- Distinct namespace construction from verified actor context.
- Deny-by-default capability policy, including explicit approval for writes, shell actions, deployments and billing.
- Model provider configuration detection for OpenAI, Anthropic, Google and Ollama, without exposing keys.
- Regression tests for isolation, approval and missing identity.

## Not yet implemented
No model calls, desktop control, background workers, personal app UI, production auth, secret vault, tool execution, or deployments are provided by this slice. Do not expose these primitives as a public API without production authorization. An `approved` boolean must **never** be accepted directly from a client: future approval must be verified server-side against a durable, actor-scoped approval record, tied to the exact action and parameters.

## Next steps
1. Implement verified owner authentication and server-enforced separation of personal and Relay credentials.
2. Add separate encrypted persistence and per-surface audit trails; test cross-surface and cross-tenant denial.
3. Add model router and server-side adapters with timeouts, budgets and redacted logs.
4. Add a chat endpoint for owner-only use and a separate personal app UI.
5. Add a narrow read-only tool registry; then signed, single-use approvals for side effects.
6. Run typecheck, tests, lint, and build in CI before merging. No production rollout from this branch.
