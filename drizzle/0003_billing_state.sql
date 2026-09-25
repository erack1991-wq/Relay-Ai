CREATE TABLE IF NOT EXISTS subscriptions (
  owner TEXT PRIMARY KEY NOT NULL,
  stripe_customer_id TEXT NOT NULL DEFAULT '',
  stripe_subscription_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL,
  price_id TEXT NOT NULL DEFAULT '',
  current_period_end TEXT NOT NULL DEFAULT '',
  updated TEXT NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id) WHERE stripe_subscription_id <> '';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS subscription_events (
  id TEXT PRIMARY KEY NOT NULL,
  created TEXT NOT NULL
);
