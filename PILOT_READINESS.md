# Relay pilot readiness

Relay is ready for customer traffic only when the readiness endpoint reports `readyForPilot: true`.

Run the local or deployed check with:

```text
npm run readiness -- https://your-relay-host.example/api/health
```

The check must cover:

- Database schema and backups
- Twilio authentication, inbound voice, outbound SMS, delivery receipts, STOP/HELP, and A2P status
- AI provider authentication, timeout handling, and fallback behavior
- Calendar authorization, timezone handling, conflict detection, and cancellation
- Stripe checkout, webhook signature validation, active entitlement, past-due handling, and cancellation
- Tenant isolation and owner authorization
- Human escalation for urgent, uncertain, or high-value callers
- Monitoring, alerting, retry queues, and webhook replay

Configuration presence is not delivery proof. A supervised real call, message, booking, and billing test must pass before routing customer traffic.

## Evidence recording

After the supervised checks pass, record the UTC completion timestamps in the hosting provider's runtime environment (these are evidence markers, not secrets):

- `PROVIDER_VERIFIED_AT`: one timestamp covering successful provider authentication and the real call, SMS, booking/calendar, and billing checks.
- `BACKUP_VERIFIED_AT`: timestamp of the verified production database backup.
- `BACKUP_RESTORE_TESTED_AT`: timestamp of a successful restore drill in a safe environment.

Relay does not accept these markers as proof by themselves; retain the provider receipts, test results, backup identifier, and restore notes alongside them. The health endpoint uses the markers only to prevent accidental readiness claims when evidence is absent.
