# Relay operations runbook

Use this checklist before routing real customer traffic. Do not treat a successful deploy as proof that providers or recovery work.

## Daily safe scan

```powershell
npm audit --omit=dev --audit-level=high
npm run validate:providers
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

### Supervised verification sequence

Run these checks with an owner or operator watching the workspace. Use a dedicated test contact and test calendar slot; never use an unsuspecting customer.

1. Call the Relay number and confirm the call is answered, the workspace is correct, and a lead is created.
2. Provide explicit SMS consent, confirm one delivery, reply once, then send `STOP` and confirm later follow-up is blocked.
3. Request an appointment, confirm the booking exists in the intended timezone, then repeat the same request and confirm no duplicate booking is created.
4. Deliver one Stripe test webhook twice and confirm one state transition plus one duplicate/no-op result.
5. Send one signed Meta test event twice and confirm one persisted provider event plus one duplicate/no-op result.
6. Record only the test date, provider event IDs, booking ID, delivery status, and pass/fail result. Do not record message bodies or secrets.
7. Record `PROVIDER_VERIFIED_AT` only after all applicable provider checks pass. Use an ISO-8601 timestamp from the completed test; never use a placeholder or future timestamp.

If any step fails, preserve the lead and event for follow-up, leave readiness blocked, and fix the failing integration before repeating the test.

## Integration setup map

Use the provider dashboards to create credentials; never put secret values in chat, source control, or browser-visible code. Set values in the site's protected runtime environment, then deploy and run the daily safe scan.

| Integration | Required runtime keys | Callback or webhook URL | Verification |
| --- | --- | --- | --- |
| OpenAI primary | `OPENAI_API_KEY` | None | Run a supervised AI response and confirm the lead is saved. |
| AI backup | `AI_BACKUP_API_KEY`, `AI_BACKUP_BASE_URL`, `AI_BACKUP_MODEL` | None | Temporarily simulate a primary outage and confirm backup response behavior. |
| Twilio | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | `/api/voice`, `/api/voice/sms`, `/api/voice/status` | Call, SMS, consent, STOP, booking, and status-callback checks. |
| Stripe | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID`, optional `STRIPE_SETUP_PRICE_ID` | `/api/billing/webhook` | One test event plus a duplicate delivery. |
| Google Calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY`, `GOOGLE_REDIRECT_URI` | `/api/google-calendar/callback` | OAuth connection, availability read, booking write, and disconnect. |
| Meta Messenger | `META_APP_SECRET`, `META_PAGE_ACCESS_TOKEN`, `META_VERIFY_TOKEN` | `/api/messenger/webhook` | Verify challenge, signed event, duplicate event, and intended Page authorization. |

Current public base URL: `https://relay-business-workspace.epeazy2.chatgpt.site`

After changing runtime credentials, verify the deployed environment—not only a local `.env` file. Confirm `/api/health`, then run the affected supervised provider test before routing customer traffic.

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
