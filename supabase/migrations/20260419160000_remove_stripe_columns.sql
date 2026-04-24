DROP INDEX IF EXISTS subscriptions_stripe_customer_idx;
DROP INDEX IF EXISTS subscriptions_stripe_subscription_idx;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_customer_id;
ALTER TABLE subscriptions DROP COLUMN IF EXISTS stripe_subscription_id;
DROP TABLE IF EXISTS processed_stripe_events;
