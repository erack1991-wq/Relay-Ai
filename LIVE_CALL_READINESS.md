# Live call pilot status

Implemented: signed Twilio webhooks; persisted caller and intake state; constrained AI extraction of name/service/slot choice; explicit booking confirmation; Relay calendar availability; duplicate webhook protection; consented SMS submission; SMS delivery status callbacks; STOP handling; call activity and errors in the Receptionist screen; request timeouts.

The calendar is Relay's own single-resource calendar, with one-hour appointments. Automatic slot offers currently support the configured Monday–Friday, 9 AM–5 PM schedule only. Other hours fail closed and save a callback request. Google/Outlook availability is not connected. SMS acceptance is not delivery.

## Required configuration

Keep secrets in `.dev.vars` locally and the hosting provider's secret store in production. Never commit them.

- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`: account that owns the sender number.
- `TWILIO_PHONE_NUMBER`: owned voice/SMS-capable number in E.164 form.
- `OPENAI_API_KEY`: funded API project. Optional `OPENAI_VOICE_MODEL`, default `gpt-5-mini`.
- `PUBLIC_BASE_URL`: exact externally reachable HTTPS origin, no trailing slash.
- `RELAY_WORKSPACE_ID`: existing business workspace for inbound calls. Outbound tests use the authenticated workspace explicitly.

Configure the Twilio number with POST voice webhook `/api/voice`, POST call status callback `/api/voice/status`, and POST messaging webhook `/api/voice/sms`. Outbound tests configure their own voice and status URLs. Production hosting must allow signed Twilio requests to these webhook routes while preserving dashboard authentication.

## Verification on September 22, 2026

Automated tests use isolated D1 and mock provider responses; they do not prove a real phone or SMS delivery. Real provider checks returned OpenAI HTTP 429 `credit_balance_exhausted` and Twilio HTTP 200 with an empty owned-number list for the credentials currently configured. Resolve those account issues before dialing again.

Before sale: publish stable hosting, configure production secrets and the intended workspace, connect the desired external calendar if needed, and complete one real call that saves the correct lead and booking and receives a delivered confirmation. A configuration-presence health check is not evidence of readiness.

## Database backup

A consistent SQLite backup was saved locally under `.sites-runtime/backups` before applying the voice tables. That directory is ignored by Git and contains private business data. This is a one-time local backup, not an automated production backup system. Keep the server stopped when restoring and verify the restored database before resuming calls.
