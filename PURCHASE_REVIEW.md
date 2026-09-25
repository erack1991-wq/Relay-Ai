# Pilot purchase review — September 22, 2026

No purchases have been made. The earlier $5,000–$10,000 discussion was conditional; no vendor-specific spending cap or recurring budget has been approved.

## Verified state

- 22 automated tests passed, with mock voice/AI/SMS providers and isolated D1.
- TypeScript, targeted lint, and production build passed.
- Local and temporary public health endpoints returned HTTP 200 and reached the database.
- The configured Twilio account is active, Trial, and owns zero numbers. The configured sender is not owned by that account.
- The latest AI request returned HTTP 429 with `credit_balance_exhausted`.
- Both Twilio browser sessions and OpenAI API billing require sign-in.

## Purchase order

1. Sign in and identify the API billing organization corresponding to the configured key. Proposed initial purchase: $10 of API credit with automatic recharge disabled. Review actual checkout taxes and total before approval. Do not fund an unrelated organization.
2. Sign in to the intended Twilio account and check existing phone ownership before buying anything. Published US local-number pricing is $1.15/month, with voice, speech recognition, messaging, carrier/registration fees, and taxes charged separately. Do not treat the number rental as an all-inclusive quote. Obtain the actual checkout total and a recurring/usage budget first.
3. Finish the deployment and verify signed webhook access while keeping customer data authenticated. Do not buy hosting until the existing Site deployment route is resolved and a specific hosting plan is justified.
4. Run one real call through lead capture, booking, and delivered confirmation. Automated tests do not substitute for this acceptance test.

## Outstanding work before broad sales

Stable production URL; funded and correctly matched provider accounts; real delivery test; external calendar connection if promised; automated production backups and restore testing; external failure alerts; provider cost reconciliation and enforceable usage limits. The current flow supports Relay's single-resource calendar and one fixed weekday schedule.

Do not buy ads, prospect lists, CRM subscriptions, additional numbers, or annual plans before the first successful pilot. There is no verified revenue or profitability yet.

Sources: https://help.openai.com/en/articles/8264644 and https://www.twilio.com/en-us/voice/pricing/us . Prices must be rechecked at checkout.
