# Relay Owner AI — release gate checklist

**Scope:** feature/shared-owner-ai-foundation. Do not merge or deploy solely because this document exists.

## Mandatory checks
- [ ] GitHub Actions: npm ci, npm test, typecheck, lint, build and secret scan pass at the same commit.
- [ ] Production dependency audit passes without exclusions or disabled rules.
- [ ] Review generated sharp package.json + package-lock.json patch; commit both together.
- [ ] Confirm patched sharp version and its dependency compatibility.
- [ ] Verify owner authentication is derived from trusted infrastructure (never client headers alone).
- [ ] Validate per-workspace authorization, integration grants and tenant isolation.
- [ ] Implement persistent one-time approvals with atomic consume + audit; test concurrent consumption.
- [ ] Implement idempotency/outbox for sensitive external operations.
- [ ] Add per-user/workspace rate limits and model cost budgets.
- [ ] Test failures for unavailable providers, missing credentials, timeouts and malformed responses.
- [ ] Verify no API keys or customer data are exposed in logs, UI, or repository.
- [ ] Review data retention and customer consent requirements before real calls/SMS.
- [ ] Require explicit owner confirmation for production deploy, paid services, credentials and destructive actions.

## Current known blockers
- sharp 0.35.4 is pinned in the miniflare override; cloud repair validation is experimental and does not automatically commit the patch.
- Approval/audit interfaces and proposed SQL schema are not a deployed, trusted authorization service.
- The owner AI chat API is intentionally disabled by default.

## Rollout plan
1. Repair dependencies and establish a green CI baseline.
2. Implement and test the approval store and secure auth boundary.
3. Run read-only integrations in staging with synthetic data.
4. Enable approved write operations individually, with audit and rollback.
5. Deploy only after an explicit release review.
