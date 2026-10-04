# Relay operations runbook

Use this checklist before routing real customer traffic. Do not treat a successful deploy as proof that providers or recovery work.

## Daily safe scan

```powershell
npm audit --omit=dev --audit-level=high
npm run verify
node scripts/check-readiness.mjs https://relay-business-workspace.epeazy2.chatgpt.site/api/health
```

Record the date, deployed version, health response, test result, and any failed jobs. Never paste tokens, customer messages, phone numbers, or provider payloads into reports.

## Pilot gate

Relay is not ready for customer traffic until all of these have evidence:

- `readyForPilot=true` from the live health endpoint.
- A supervised real Twilio call completes and the owner can see the resulting lead.
- A consented SMS test completes and STOP prevents a later outbound message.
- A booking test succeeds and a conflicting booking is rejected.
- A billing webhook is received once and a duplicate is ignored.
- A Messenger webhook is verified, deduplicated, and handled under the intended page authorization.
- A database backup exists and a restore has been tested in a safe environment.
- Provider verification and backup timestamps are recorded in the deployment environment.

## Failure handling

1. Keep customer intake available while pausing outbound delivery when a provider is degraded.
2. Inspect the operations dashboard before retrying anything.
3. Retry only failed jobs, only within the attempt limit, and only after the cause is understood.
4. Treat `dead_letter` work as requiring human investigation; do not repeatedly replay it.
5. Create a callback task for calls marked `needs-attention`.
6. Preserve the original event, error, timestamp, and audit entry.

## Approval-required actions

Get owner approval before production migrations, credential creation or rotation, paid services, paid advertising, large external communications, data deletion, or public posts. Keep a rollback path and record the approval with the change.

## Recovery evidence

For each backup/restore drill record only metadata: backup identifier, creation time, restore environment, schema check result, row-count check result, and cleanup result. Do not copy customer data into tickets or chat.

## Weekly owner report

Report: calls handled, leads captured, bookings, completed jobs, escalations, failed/dead-letter jobs, provider health, backup status, revenue attribution, churn, AI/API cost, security findings, changes deployed, and the next priority.
