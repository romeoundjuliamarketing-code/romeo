-- Store subscriptions (RevenueCat) mirrored into Postgres so RLS can enforce
-- "creating a private sparring needs the creator subscription".
-- Spec: docs/superpowers/specs/2026-09-29-sparr-abos-design.md
-- The enforcement stays off until app_flags.sparring_creation_requires_sub is
-- switched on after the new build is live in both stores.

CREATE TABLE IF NOT EXISTS public.store_entitlements (
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entitlement text        NOT NULL CHECK (entitlement IN ('creator', 'cards')),
  product_id  text        NOT NULL,
  expires_at  timestamptz NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, entitlement)
);

ALTER TABLE public.store_entitlements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.store_entitlements FROM anon, authenticated;
GRANT SELECT ON public.store_entitlements TO authenticated;
DROP POLICY IF EXISTS "read own store entitlements" ON public.store_entitlements;
CREATE POLICY "read own store entitlements" ON public.store_entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.app_flags (
  key     text    PRIMARY KEY,
  enabled boolean NOT NULL
);

ALTER TABLE public.app_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.app_flags FROM anon, authenticated;
GRANT SELECT ON public.app_flags TO authenticated;
DROP POLICY IF EXISTS "read app flags" ON public.app_flags;
CREATE POLICY "read app flags" ON public.app_flags
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.app_flags (key, enabled)
VALUES ('sparring_creation_requires_sub', false)
ON CONFLICT (key) DO NOTHING;

-- True when the switch is off or the caller holds a live creator entitlement.
CREATE OR REPLACE FUNCTION public.can_create_sparring()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false)
      OR EXISTS (
        SELECT 1 FROM store_entitlements
        WHERE user_id = auth.uid() AND entitlement = 'creator' AND expires_at > now()
      )
$$;
REVOKE ALL ON FUNCTION public.can_create_sparring() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_create_sparring() TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_store_entitlements()
RETURNS TABLE (
  can_create_sparring   boolean,
  creator_active        boolean,
  cards_active          boolean,
  creation_requires_sub boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_create_sparring(),
         EXISTS (SELECT 1 FROM store_entitlements
                 WHERE user_id = auth.uid() AND entitlement = 'creator' AND expires_at > now()),
         EXISTS (SELECT 1 FROM store_entitlements
                 WHERE user_id = auth.uid() AND entitlement = 'cards' AND expires_at > now()),
         COALESCE((SELECT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), false)
$$;
REVOKE ALL ON FUNCTION public.get_my_store_entitlements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_store_entitlements() TO authenticated;

-- Webhook only. p_expires_at set: grant/extend (never shortens).
-- p_expires_at NULL: expire, but only rows still owned by p_product_id, so a
-- late EXPIRATION of an old product cannot end access a newer product granted.
CREATE OR REPLACE FUNCTION public.apply_store_entitlement(
  p_user_id      uuid,
  p_entitlements text[],
  p_product_id   text,
  p_expires_at   timestamptz
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_expires_at IS NULL THEN
    UPDATE store_entitlements
       SET expires_at = LEAST(expires_at, now()),
           updated_at = now()
     WHERE user_id = p_user_id
       AND entitlement = ANY (p_entitlements)
       AND product_id = p_product_id;
  ELSE
    INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
    SELECT p_user_id, e, p_product_id, p_expires_at
      FROM unnest(p_entitlements) AS e
    ON CONFLICT (user_id, entitlement) DO UPDATE
       SET product_id = EXCLUDED.product_id,
           expires_at = GREATEST(store_entitlements.expires_at, EXCLUDED.expires_at),
           updated_at = now();
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_store_entitlement(uuid, text[], text, timestamptz) TO service_role;

-- Webhook only (RevenueCat TRANSFER, e.g. restore on another account): move
-- live rows to the new user, keeping expiry; the old users lose them.
CREATE OR REPLACE FUNCTION public.transfer_store_entitlements(p_from uuid[], p_to uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
  SELECT p_to, entitlement, product_id, expires_at
    FROM store_entitlements
   WHERE user_id = ANY (p_from) AND user_id <> p_to AND expires_at > now()
  ON CONFLICT (user_id, entitlement) DO UPDATE
     SET product_id = CASE WHEN EXCLUDED.expires_at > store_entitlements.expires_at
                           THEN EXCLUDED.product_id ELSE store_entitlements.product_id END,
         expires_at = GREATEST(store_entitlements.expires_at, EXCLUDED.expires_at),
         updated_at = now();
  DELETE FROM store_entitlements WHERE user_id = ANY (p_from) AND user_id <> p_to;
END;
$$;
REVOKE ALL ON FUNCTION public.transfer_store_entitlements(uuid[], uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_store_entitlements(uuid[], uuid) TO service_role;

-- Private sparrings (studio_id IS NULL) need can_create_sparring(); the coach
-- policy for studio sparrings stays untouched (studio sparrings are free).
-- Recreated from the live prod definition (read 2026-09-29) plus the new check.
DROP POLICY IF EXISTS "users insert own sparrings" ON public.open_sparrings;
CREATE POLICY "users insert own sparrings" ON public.open_sparrings
  FOR INSERT WITH CHECK (
    auth.uid() = created_by
    AND studio_id IS NULL
    AND NOT is_featured
    AND public.can_create_sparring()
  );
