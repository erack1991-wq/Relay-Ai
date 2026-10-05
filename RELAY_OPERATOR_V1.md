# Relay Operator V1

Relay Operator V1 is the first safe foundation for an owner-side Jarvis. It runs the engineering loop that can be automated today:

1. Inspect provider configuration shape without printing values.
2. Run typecheck, lint, tests, and the production build.
3. Check the configured live health endpoint.
4. Report the highest-priority blocker and its next action.

Run it with:

```text
npm run operator
npm run operator -- https://relay-business-workspace.epeazy2.chatgpt.site/api/health
```

The operator may read, analyze, edit code, create tests, and run local verification. It must stop for credentials, MFA, purchases, production secret changes, destructive data operations, security-boundary changes, real customer/provider traffic, and irreversible releases.

Operator tasks are now persisted by owner through `/api/operator/tasks`, with explicit `queued`, `in_progress`, `blocked`, `completed`, and `cancelled` states plus `pending_owner` approval. The schema is prepared in migration `0007_operator_tasks.sql` and must be applied through the normal production migration approval process. Provider verification and backup/restore evidence remain external readiness gates; the operator must never manufacture those signals.
