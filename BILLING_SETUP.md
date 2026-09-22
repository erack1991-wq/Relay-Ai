# Relay billing setup

Relay has guarded billing endpoints at `/api/billing/checkout` and `/api/billing/webhook`.

Add these values to the private `.dev.vars` file after the stable deployment is available:

```text
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID=price_...
STRIPE_SETUP_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`STRIPE_PRICE_ID` is the recurring $149 Relay Founding Pilot price. `STRIPE_SETUP_PRICE_ID` is the one-time $99 setup price. Create a Stripe webhook endpoint at:

```text
https://YOUR_STABLE_DOMAIN/api/billing/webhook
```

Subscribe it to checkout completion, subscription creation/update/deletion, invoice payment success, and invoice payment failure events. Keep all secret values out of source control and chat.
