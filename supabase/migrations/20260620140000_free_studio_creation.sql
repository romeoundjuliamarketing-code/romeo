-- Studio creation is now free for every authenticated user.
-- Map visibility stays paid (gated via get_subscribed_studios / map_visibility) — unchanged.
-- a) create_studio_with_owner: drop the entitlement gate; keep owner + profiles.studio_id assignment.
-- b) get_my_entitlement: can_create_studio is now always true (creation is tier-independent).

CREATE OR REPLACE FUNCTION public.create_studio_with_owner(p_name text, p_city text)
RETURNS TABLE (id uuid, name text, city text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO studios (name, city, owner_user_id)
  VALUES (trim(p_name), trim(p_city), auth.uid())
  RETURNING studios.id INTO v_id;
  UPDATE profiles SET studio_id = v_id WHERE profiles.id = auth.uid();
  RETURN QUERY SELECT s.id, s.name, s.city FROM studios s WHERE s.id = v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) FROM anon;

CREATE OR REPLACE FUNCTION public.get_my_entitlement()
RETURNS TABLE (
  has_access            boolean,
  tier                  text,
  source                text,
  can_create_studio     boolean,
  can_manage_studio     boolean,
  can_announce          boolean,
  can_manage_memberships boolean,
  included_seats        integer,
  used_seats            integer,
  extra_seats           integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  direct_sub       subscriptions%ROWTYPE;
  studio_sub       subscriptions%ROWTYPE;
  active_members   integer := 0;
BEGIN
  -- 1. Check for a direct subscription belonging to the current user.
  SELECT *
  INTO direct_sub
  FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;

  IF direct_sub.id IS NOT NULL THEN
    SELECT count(*)
    INTO active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = direct_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      true,
      direct_sub.tier,
      'direct'::text,
      true,
      entitlement_allows(direct_sub.tier, 'manage_studio'),
      entitlement_allows(direct_sub.tier, 'announce'),
      entitlement_allows(direct_sub.tier, 'manage_memberships'),
      direct_sub.included_seats,
      active_members,
      direct_sub.extra_seats;
    RETURN;
  END IF;

  -- 2. Check for access via a studio membership (user is a member of a studio).
  --    The studio's owner must have an active subscription; the tier of that
  --    subscription determines whether the member gets has_access.
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
    INTO active_members
    FROM studio_memberships sm
    WHERE sm.subscription_id = studio_sub.id
      AND sm.status = 'active';

    RETURN QUERY SELECT
      -- members only get access when the studio is on studio_suite
      (studio_sub.tier = 'studio_suite'),
      studio_sub.tier,
      'studio'::text,
      -- members are never owners; no studio management flags for them
      true,
      false,
      false,
      false,
      studio_sub.included_seats,
      active_members,
      studio_sub.extra_seats;
    RETURN;
  END IF;

  -- 3. No subscription found.
  RETURN QUERY SELECT false, NULL::text, NULL::text, true, false, false, false, 0, 0, 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_entitlement() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_my_entitlement() FROM anon;
