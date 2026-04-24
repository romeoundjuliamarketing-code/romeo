ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS stripe_customer_id text NULL,
ADD COLUMN IF NOT EXISTS stripe_subscription_id text NULL;

CREATE INDEX IF NOT EXISTS subscriptions_stripe_customer_idx ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS subscriptions_stripe_subscription_idx ON subscriptions(stripe_subscription_id);
