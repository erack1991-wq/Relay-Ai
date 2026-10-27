# Security release verification — 2026-10-27

Applies to PR #23 (Next.js/React/RSC/Zod security update). **This is a release runbook, not proof of a staging or production deployment.** The update is committed to `security/next-react-oct2026` but is not merged into `main`.

## Verified evidence and limits

- PR quality run 40206071523 completed successfully: test, typecheck, lint, build, production dependency audit, critical all-dependency audit and secret scan. The production dependency audit reported zero findings at the time of that run.
- Twelve noncritical development/build dependency findings (five high, seven moderate) remain tracked in issue #24. Assess runtime/build exposure separately.
- The connected Vercel and Supabase accounts currently return zero projects. This **does not** establish that the hosted Relay application lacks a database or deployment: `.openai/hosting.json` declares a Sites project and D1 binding `DB`. Use the actual hosting platform's supported preview/deployment and backup controls, not an assumed Vercel or Supabase project.
- Relay's connected status reports `readyForPilot=false`: provider end-to-end verification and backup/restore evidence are absent. Do not set verification timestamps without dated evidence.
- The GitHub monitor can succeed while `readyForPilot=false`. A green uptime check is not a pilot-launch gate.

## Pre-release checks (no live provider traffic required)

1. Confirm PR #23 HEAD and `main` have not changed unexpectedly; inspect four changed files and lockfile integrity.
2. Re-run CI on the exact candidate SHA: `npm ci`, `npm run validate:providers -- .dev.vars.example`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, `npm audit --omit=dev --audit-level=high`, `npm audit --audit-level=critical`, secret scan. Preserve run URL and failures.
3. Verify framework build/preview uses the same runtime and D1 binding semantics as the intended hosted Sites application. Use isolated preview data, never production records for test resets.
4. Exercise non-provider smoke paths on preview: signed-in versus anonymous access; workspace ownership and cross-workspace denial; create/read/update workspace; lead and appointment persistence; invalid input and cross-site POST rejection; /api/health. Confirm Zod 4 input validation still returns 400 on invalid bodies.
5. Confirm the preview does not expose secrets or enable Owner AI without its explicit allowlist and flag. Preserve existing deployment artifact and its identifier for rollback.

## Supervised live-provider acceptance (approval and existing-provider usage required)

Use an owner-approved controlled test number and test workspace. Record provider message/call identifiers, timestamps and outcomes without posting customer data or secrets.

- Voice: inbound greeting, no-input/timeout, failed/busy/no-answer status callbacks including duplicate delivery, operator handoff and emergency disclaimer.
- Booking: explicit confirmation, duplicate request, slot collision, correct calendar/timezone, persistence and customer visibility.
- SMS: permission, no consent, STOP opt-out, accepted-versus-delivered distinction, failure/timeout, no duplicate sends.
- Billing: Stripe **test mode** signed webhook, duplicate event, interrupted processing/retry, subscription state; do not charge real customers.
- Recovery: identify the actual production data store, create a protected complete backup with approval, verify integrity, and perform a restoration drill in an isolated destination. Do not infer production backup validity from local D1 exports.

## Release decision, monitoring and rollback

**Do not merge or deploy automatically.** Obtain owner approval for any merge that triggers production rollout and for live-provider/production-data operations. If the preview cannot be accessed or smoke-tested, document the gap and defer production release.

After an approved rollout, compare before/after health, provider errors, booking persistence, login, failed/dead-letter jobs, and billing webhooks. Record deployment ID and exact commit SHA. If critical journeys regress, stop further changes and restore the previous known-good deployment through the hosting platform's supported rollback mechanism; avoid destructive database migrations.

Only after the security rollout is verified should PRs #20 (dead-letter monitoring), #21 (billing retries), #26 (missed-call dedupe), and #25 (log hygiene) be rebased/retested and considered separately. A successful security deployment does **not** by itself clear the pilot readiness gates.
