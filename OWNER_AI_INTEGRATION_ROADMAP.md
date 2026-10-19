# Relay AI — Integration decision record (2026-10-19)

Status: **candidate evaluation only**. Nothing in this document authorizes external API actions, production deployment, purchases, or installing third-party code without review.

## First: unblock existing security gate
- Upgrade the pinned vulnerable sharp 0.35.4 override to a patched version.
- Regenerate and commit package-lock.json in the same change.
- Require npm ci, tests, typecheck, lint, build, production npm audit, and secret scanning to pass.
- Do not bypass the audit.

## Next: build reliable operations
1. **Approval store**: D1/SQLite transactional one-time consumption, trusted owner identity, server-derived argument digest, audit log, idempotency/outbox, and tests.
2. **Customer isolation**: explicit owner versus customer authentication; workspace scoping and negative authorization tests.
3. **AI observability**: evaluate Langfuse; redact PII/transcripts and set retention limits.
4. **Durable jobs**: evaluate Trigger.dev against Cloudflare-native queues/workflows for missed-call callbacks and follow-ups; estimate operating costs.
5. **Agent orchestration**: benchmark RuFlo against LangGraph with a single coordinator; avoid nested swarms and unbounded loops.
6. **Model gateway**: benchmark LiteLLM versus the existing TypeScript model router; use per-workspace budgets, fallback rules, rate limits and circuit breakers.
7. **End-to-end reliability**: Playwright tests for owner login, customer tenant boundaries, lead capture, booking, and failed external integrations.
8. **Production diagnostics**: Sentry/OpenTelemetry with scrubbed logs and alert thresholds.
9. **Customer value**: call-quality evaluations, lead capture accuracy, booking conflict tests, and ROI dashboard.

## Integration acceptance criteria
- Maintained project and license compatible with intended commercial use.
- Compatible with Next/Vinext/Cloudflare architecture or cleanly isolated in a worker.
- No secrets in GitHub; use scoped server-side credentials.
- Explicit customer consent for recording, messaging, and data use where required.
- Minimal customer data transfer, documented retention/deletion, tenant isolation.
- Performance, cost, reliability and security compared against current stack.
- Each addition enters through a feature branch and passes CI before merging.
- No tool receives unrestricted production or billing authority.

## Suggested agent roles
Engineering, testing/security, customer operations, marketing drafts, support triage, and finance reporting. Default to read-only or draft-only; sensitive writes require one-time owner approval.

## Candidate upstreams
- https://github.com/langchain-ai/langgraph
- https://github.com/triggerdotdev/trigger.dev
- https://github.com/langfuse/langfuse
- https://github.com/BerriAI/litellm

Avoid importing entire repositories or adding unused packages. Prototype one integration at a time with a rollback plan.
