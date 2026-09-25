# Relay controlled pilot handoff

Updated: 2026-09-25

## Completed locally

- Billing subscription persistence and cancellation handling implemented.
- Stripe webhook signature verification and duplicate-event protection tested.
- Authenticated workspace responses now expose billing status.
- `/api/health` now reports database schema readiness, provider configuration presence, and `readyForPilot`.
- 23 automated tests pass.
- TypeScript, lint, and production build pass.

## Remaining live actions

These require access to the intended production accounts or an explicit live deployment action:

1. Back up the live D1 database.
2. Apply `drizzle/0003_billing_state.sql` to the production `DB` binding.
3. Deploy the current build to the configured hosting project.
4. Configure the Stripe webhook endpoint as `POST /api/billing/webhook` and subscribe to:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Confirm the Stripe price ID and webhook secret belong to the intended Relay account.
6. Confirm the Twilio account owns the sender number and configure:
   - Voice webhook: `POST /api/voice`
   - Call status callback: `POST /api/voice/status`
   - Messaging webhook: `POST /api/voice/sms`
7. Confirm the OpenAI API key belongs to a funded project with a spend limit.
8. Open `/api/health` and require `readyForPilot: true` before inviting a customer.
9. Run one real call through intake, booking, confirmation, and delivery verification.
10. Run one Stripe test checkout, verify the subscription appears as active in Relay, then test cancellation handling.

## Official account links

- Stripe Dashboard: https://dashboard.stripe.com/
- Stripe Webhooks: https://dashboard.stripe.com/webhooks
- Twilio Console: https://console.twilio.com/
- OpenAI Platform billing: https://platform.openai.com/settings/organization/billing/overview
- OpenAI API keys: https://platform.openai.com/api-keys
- Meta Developers: https://developers.facebook.com/apps/
- Cloudflare Dashboard: https://dash.cloudflare.com/

## Safety requirements

- Never paste secrets into chat, source files, or tickets.
- Use a database backup before applying the billing migration.
- Use Stripe test mode before live charges.
- Keep the first pilot limited to one business.
- Set Twilio and OpenAI spend limits before a real call.
- Do not promise guaranteed revenue results.

## Final acceptance evidence

Record the production URL, `/api/health` response, migration timestamp, Stripe test event IDs, Twilio call SID, booking ID, delivery result, provider cost estimate, and rollback contact before accepting a paid pilot.
