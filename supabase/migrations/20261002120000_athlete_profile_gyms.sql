-- Athlete profile + lean gym function (additive, keeps all existing data).
--
-- A "gym" is a row in the existing studios table — no parallel gym system.
-- Two new, independent links point at it:
--   profiles.home_gym_id    "Hier trainiere ich": a self-declaration, NOT a
--                           membership. profiles.studio_id stays the confirmed
--                           team membership (join requests, coach vouching).
--   open_sparrings.gym_id   the gym a sparring takes place at. Unlike
--                           open_sparrings.studio_id (official studio sparring,
--                           coaches only) any creator may set it — a meeting
--                           in a gym is not an official offer of the studio.
-- Shared gym rows stay protected: users create them only through create_gym
-- (owner_user_id stays NULL, the existing owner-only UPDATE policy applies)
-- and propose changes through gym_correction_requests, which are stored but
-- never applied automatically.

-- ─── 1. Profile: cover photo + home gym ───────────────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cover_url     text,
  ADD COLUMN IF NOT EXISTS cover_focus_x real NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS cover_focus_y real NOT NULL DEFAULT 0.5,
  ADD COLUMN IF NOT EXISTS home_gym_id   uuid REFERENCES public.studios(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_cover_focus_range') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_cover_focus_range
      CHECK (cover_focus_x BETWEEN 0 AND 1 AND cover_focus_y BETWEEN 0 AND 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS profiles_home_gym_id_idx
  ON public.profiles (home_gym_id) WHERE home_gym_id IS NOT NULL;

-- Members keep the gym their profile showed so far (it came from studio_id).
-- One-off: later team changes never touch the self-declared home gym.
UPDATE public.profiles
   SET home_gym_id = studio_id
 WHERE home_gym_id IS NULL
   AND studio_id IS NOT NULL;

-- ─── 2. Gyms: who created a shared entry (rate limit, moderation) ─────────────

ALTER TABLE public.studios
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Normalised name/city for duplicate detection ("Box-Club  München" = "box club münchen").
CREATE OR REPLACE FUNCTION public.gym_norm(p text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public
AS $$ SELECT btrim(regexp_replace(lower(coalesce(p, '')), '[^[:alnum:]]+', ' ', 'g')) $$;

CREATE INDEX IF NOT EXISTS studios_gym_norm_idx
  ON public.studios (public.gym_norm(name), public.gym_norm(city));

-- Creates a shared gym entry, or returns the existing one with the same
-- normalised name in the same city (same name in another city = another gym).
CREATE OR REPLACE FUNCTION public.create_gym(p_name text, p_city text, p_address text DEFAULT NULL)
RETURNS TABLE (id uuid, name text, city text, address text, created boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
DECLARE
  v_uid     uuid := auth.uid();
  v_name    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_city    text := btrim(regexp_replace(coalesce(p_city, ''), '\s+', ' ', 'g'));
  v_address text := nullif(btrim(regexp_replace(coalesce(p_address, ''), '\s+', ' ', 'g')), '');
  v_existing studios%ROWTYPE;
  v_new_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF char_length(v_name) < 2 OR char_length(v_name) > 80 THEN
    RAISE EXCEPTION 'GYM_NAME_INVALID';
  END IF;
  IF char_length(v_city) < 2 OR char_length(v_city) > 60 THEN
    RAISE EXCEPTION 'GYM_CITY_INVALID';
  END IF;
  IF v_address IS NOT NULL AND char_length(v_address) > 160 THEN
    RAISE EXCEPTION 'GYM_ADDRESS_INVALID';
  END IF;

  SELECT s.* INTO v_existing
    FROM studios s
   WHERE gym_norm(s.name) = gym_norm(v_name)
     AND gym_norm(s.city) = gym_norm(v_city)
   ORDER BY s.created_at
   LIMIT 1;
  IF FOUND THEN
    RETURN QUERY SELECT v_existing.id, v_existing.name, v_existing.city, v_existing.address, false;
    RETURN;
  END IF;

  -- Not every free text becomes a gym: a few new entries per user and day.
  IF (SELECT count(*) FROM studios s
       WHERE s.created_by = v_uid AND s.created_at > now() - interval '1 day') >= 3 THEN
    RAISE EXCEPTION 'GYM_RATE_LIMIT';
  END IF;

  INSERT INTO studios (name, city, address, owner_user_id, created_by)
  VALUES (v_name, v_city, v_address, NULL, v_uid)
  RETURNING studios.id INTO v_new_id;

  RETURN QUERY SELECT v_new_id, v_name, v_city, v_address, true;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_gym(text, text, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.create_gym(text, text, text) TO authenticated;

-- ─── 3. Correction suggestions (stored, never auto-applied) ───────────────────

CREATE TABLE IF NOT EXISTS public.gym_correction_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id        uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  proposed_name    text CHECK (proposed_name    IS NULL OR char_length(proposed_name)    BETWEEN 2 AND 80),
  proposed_city    text CHECK (proposed_city    IS NULL OR char_length(proposed_city)    BETWEEN 2 AND 60),
  proposed_address text CHECK (proposed_address IS NULL OR char_length(proposed_address) <= 160),
  note             text CHECK (note             IS NULL OR char_length(note)             <= 500),
  status           text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'applied', 'rejected')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (proposed_name IS NOT NULL OR proposed_city IS NOT NULL
         OR proposed_address IS NOT NULL OR note IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS gym_correction_requests_studio_idx
  ON public.gym_correction_requests (studio_id, created_at DESC);

ALTER TABLE public.gym_correction_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "insert own gym correction" ON public.gym_correction_requests;
CREATE POLICY "insert own gym correction" ON public.gym_correction_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'open');

DROP POLICY IF EXISTS "read own gym corrections" ON public.gym_correction_requests;
CREATE POLICY "read own gym corrections" ON public.gym_correction_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- No UPDATE/DELETE for clients: review happens with service_role.
REVOKE UPDATE, DELETE ON public.gym_correction_requests FROM anon, authenticated;

-- ─── 4. Sparring location: gym + optional access note ─────────────────────────

ALTER TABLE public.open_sparrings
  ADD COLUMN IF NOT EXISTS gym_id      uuid REFERENCES public.studios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS access_note text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'open_sparrings_access_note_len') THEN
    ALTER TABLE public.open_sparrings
      ADD CONSTRAINT open_sparrings_access_note_len
      CHECK (access_note IS NULL OR char_length(access_note) <= 120);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS open_sparrings_gym_upcoming_idx
  ON public.open_sparrings (gym_id, scheduled_at)
  WHERE gym_id IS NOT NULL AND is_active;

-- Direct client UPDATEs on open_sparrings are revoked (20260927120000), so the
-- creator links/unlinks the gym of an existing sparring through this RPC.
-- Purely descriptive: address/coordinates stay with update_sparring, nobody is
-- notified, the gym gains no rights over the sparring.
CREATE OR REPLACE FUNCTION public.set_sparring_gym(p_id uuid, p_gym_id uuid, p_access_note text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_note text := nullif(btrim(coalesce(p_access_note, '')), '');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED';
  END IF;
  IF v_note IS NOT NULL AND char_length(v_note) > 120 THEN
    RAISE EXCEPTION 'ACCESS_NOTE_TOO_LONG';
  END IF;
  IF p_gym_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM studios WHERE id = p_gym_id) THEN
    RAISE EXCEPTION 'GYM_NOT_FOUND';
  END IF;

  UPDATE open_sparrings
     SET gym_id = p_gym_id,
         access_note = v_note
   WHERE id = p_id
     AND created_by = auth.uid()
     AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SPARRING_NOT_EDITABLE';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_sparring_gym(uuid, uuid, text) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.set_sparring_gym(uuid, uuid, text) TO authenticated;
