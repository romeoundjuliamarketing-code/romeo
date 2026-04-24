-- Subscription plans: same features for all paid users.
-- Studio plan adds owner rights and included seats.

ALTER TABLE studios
ADD COLUMN IF NOT EXISTS owner_user_id uuid NULL REFERENCES auth.users(id);

CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier text NOT NULL CHECK (tier IN ('individual', 'studio')),
  billing_cycle text NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'yearly')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'inactive')),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NULL,
  included_seats integer NOT NULL DEFAULT 0 CHECK (included_seats >= 0),
  extra_seats integer NOT NULL DEFAULT 0 CHECK (extra_seats >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_user_id_idx ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions(status);

CREATE TABLE IF NOT EXISTS studio_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released')),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  released_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_memberships_active_user_idx
ON studio_memberships(user_id)
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS studio_memberships_subscription_idx ON studio_memberships(subscription_id);

CREATE TABLE IF NOT EXISTS studio_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS studio_invites_subscription_idx ON studio_invites(subscription_id);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON subscriptions;
CREATE POLICY "subscriptions_select_own"
ON subscriptions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "studio_memberships_select_own" ON studio_memberships;
CREATE POLICY "studio_memberships_select_own"
ON studio_memberships FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "studio_invites_select_own_subscriptions" ON studio_invites;
CREATE POLICY "studio_invites_select_own_subscriptions"
ON studio_invites FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.id = subscription_id
      AND s.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS TABLE (
  has_access boolean,
  tier text,
  source text,
  can_create_studio boolean,
  included_seats integer,
  used_seats integer,
  extra_seats integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  direct_sub subscriptions%ROWTYPE;
  studio_sub subscriptions%ROWTYPE;
  studio_active_members integer := 0;
BEGIN
  SELECT *
  INTO direct_sub
  FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF direct_sub.id IS NOT NULL THEN
    SELECT count(*)
    INTO studio_active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = direct_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      true,
      direct_sub.tier,
      'direct'::text,
      (direct_sub.tier = 'studio'),
      direct_sub.included_seats,
      studio_active_members,
      direct_sub.extra_seats;
    RETURN;
  END IF;

  SELECT s.*
  INTO studio_sub
  FROM studio_memberships sm
  JOIN subscriptions s ON s.id = sm.subscription_id
  WHERE sm.user_id = auth.uid()
    AND sm.status = 'active'
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF studio_sub.id IS NOT NULL THEN
    SELECT count(*)
    INTO studio_active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = studio_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      true,
      studio_sub.tier,
      'studio'::text,
      false,
      studio_sub.included_seats,
      studio_active_members,
      studio_sub.extra_seats;
    RETURN;
  END IF;

  RETURN QUERY SELECT false, NULL::text, NULL::text, false, 0, 0, 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_studio_with_owner(
  p_name text,
  p_city text
)
RETURNS TABLE (
  id uuid,
  name text,
  city text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  SELECT true
  INTO allowed
  FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.tier = 'studio'
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF coalesce(allowed, false) = false THEN
    RAISE EXCEPTION 'Studio-Abo erforderlich';
  END IF;

  RETURN QUERY
  WITH created AS (
    INSERT INTO studios (name, city, owner_user_id)
    VALUES (trim(p_name), trim(p_city), auth.uid())
    RETURNING studios.id, studios.name, studios.city
  )
  SELECT created.id, created.name, created.city
  FROM created;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) TO authenticated;
