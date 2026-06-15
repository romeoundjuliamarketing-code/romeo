-- Team join now requires staff approval. Members request; studio staff confirm.
-- Also locks down direct self-assignment of profiles.studio_id via a trigger.

-- 1. Join requests table
CREATE TABLE IF NOT EXISTS studio_join_requests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  studio_id    uuid        NOT NULL REFERENCES studios(id)    ON DELETE CASCADE,
  status       text        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz NULL,
  responded_by uuid        NULL REFERENCES auth.users(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS studio_join_requests_one_pending_per_user_studio
  ON studio_join_requests (user_id, studio_id) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS studio_join_requests_studio_status_idx
  ON studio_join_requests (studio_id, status);

ALTER TABLE studio_join_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "studio_join_requests_select" ON studio_join_requests
  FOR SELECT USING (auth.uid() = user_id OR is_studio_staff(studio_id));
CREATE POLICY "studio_join_requests_insert" ON studio_join_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "studio_join_requests_update_user_cancel" ON studio_join_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending')
  WITH CHECK (auth.uid() = user_id AND status = 'cancelled');
CREATE POLICY "studio_join_requests_update_staff" ON studio_join_requests
  FOR UPDATE USING (is_studio_staff(studio_id));

-- 2. RPC: member requests to join
CREATE OR REPLACE FUNCTION request_studio_join(p_studio_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id        uuid;
  v_current   uuid;
  v_requester text;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT studio_id INTO v_current FROM profiles WHERE id = auth.uid();
  IF v_current IS NOT NULL THEN
    RAISE EXCEPTION 'Du bist bereits in einem Team.';
  END IF;
  IF EXISTS (SELECT 1 FROM studio_join_requests
             WHERE user_id = auth.uid() AND studio_id = p_studio_id AND status = 'pending') THEN
    RAISE EXCEPTION 'Es existiert bereits eine offene Beitrittsanfrage für dieses Studio.';
  END IF;
  INSERT INTO studio_join_requests (user_id, studio_id, status)
  VALUES (auth.uid(), p_studio_id, 'pending') RETURNING id INTO v_id;
  SELECT COALESCE(name, 'Ein neues Mitglied') INTO v_requester FROM profiles WHERE id = auth.uid();
  PERFORM notify_studio_staff(
    p_studio_id, 'studio_join_request', 'Neue Beitrittsanfrage',
    v_requester || ' möchte deinem Team beitreten.',
    jsonb_build_object('request_id', v_id, 'studio_id', p_studio_id), auth.uid());
  RETURN v_id;
END; $$;
GRANT EXECUTE ON FUNCTION request_studio_join(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION request_studio_join(uuid) FROM anon;

-- 3. RPC: staff approves/rejects
CREATE OR REPLACE FUNCTION respond_studio_join(p_id uuid, p_approve boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_studio_id uuid; v_user_id uuid; v_status text; v_studio_nm text;
BEGIN
  SELECT studio_id, user_id, status INTO v_studio_id, v_user_id, v_status
  FROM studio_join_requests WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Anfrage nicht gefunden.'; END IF;
  IF NOT is_studio_staff(v_studio_id) THEN
    RAISE EXCEPTION 'Keine Berechtigung, um diese Anfrage zu beantworten.';
  END IF;
  IF v_status <> 'pending' THEN
    RAISE EXCEPTION 'Nur ausstehende Anfragen können beantwortet werden.';
  END IF;
  UPDATE studio_join_requests
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      responded_at = now(), responded_by = auth.uid()
  WHERE id = p_id;
  IF p_approve THEN
    UPDATE profiles SET studio_id = v_studio_id WHERE id = v_user_id AND studio_id IS NULL;
  END IF;
  SELECT COALESCE(name, 'das Team') INTO v_studio_nm FROM studios WHERE id = v_studio_id;
  PERFORM notify_user(
    v_user_id, 'studio_join_response',
    CASE WHEN p_approve THEN 'Beitritt bestätigt' ELSE 'Beitritt abgelehnt' END,
    CASE WHEN p_approve THEN 'Du bist jetzt Mitglied bei ' || v_studio_nm || '.'
         ELSE 'Deine Beitrittsanfrage bei ' || v_studio_nm || ' wurde abgelehnt.' END,
    jsonb_build_object('studio_id', v_studio_id, 'approved', p_approve));
END; $$;
GRANT EXECUTE ON FUNCTION respond_studio_join(uuid, boolean) TO authenticated;
REVOKE EXECUTE ON FUNCTION respond_studio_join(uuid, boolean) FROM anon;

-- 4. RPC: staff removes a member
CREATE OR REPLACE FUNCTION remove_studio_member(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_id uuid; v_owner uuid;
BEGIN
  SELECT studio_id INTO v_studio_id FROM profiles WHERE id = p_user_id;
  IF v_studio_id IS NULL THEN RAISE EXCEPTION 'Mitglied ist in keinem Team.'; END IF;
  IF NOT is_studio_staff(v_studio_id) THEN RAISE EXCEPTION 'Keine Berechtigung.'; END IF;
  IF p_user_id = auth.uid() THEN RAISE EXCEPTION 'Du kannst dich nicht selbst entfernen.'; END IF;
  SELECT owner_user_id INTO v_owner FROM studios WHERE id = v_studio_id;
  IF p_user_id = v_owner THEN RAISE EXCEPTION 'Der Studio-Inhaber kann nicht entfernt werden.'; END IF;
  UPDATE profiles SET studio_id = NULL, is_coach = false WHERE id = p_user_id;
END; $$;
GRANT EXECUTE ON FUNCTION remove_studio_member(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION remove_studio_member(uuid) FROM anon;

-- 5. RPC: leave own team (needed because direct studio_id writes are blocked)
CREATE OR REPLACE FUNCTION leave_studio()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_studio_id uuid; v_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT studio_id INTO v_studio_id FROM profiles WHERE id = auth.uid();
  IF v_studio_id IS NOT NULL THEN
    SELECT owner_user_id INTO v_owner FROM studios WHERE id = v_studio_id;
    IF v_owner = auth.uid() THEN
      RAISE EXCEPTION 'Als Studio-Inhaber kannst du dein Team nicht verlassen.';
    END IF;
  END IF;
  UPDATE profiles SET studio_id = NULL, is_coach = false WHERE id = auth.uid();
END; $$;
GRANT EXECUTE ON FUNCTION leave_studio() TO authenticated;
REVOKE EXECUTE ON FUNCTION leave_studio() FROM anon;

-- 6. Lockdown: block direct studio_id self-assignment from the client.
-- SECURITY DEFINER RPCs run as the table owner (current_user != 'authenticated')
-- and are therefore allowed; direct client writes (current_user = 'authenticated') are blocked.
CREATE OR REPLACE FUNCTION guard_profiles_studio_id()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.studio_id IS NOT NULL THEN
        RAISE EXCEPTION 'Team-Beitritt nur über Anfrage möglich.';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.studio_id IS DISTINCT FROM OLD.studio_id THEN
        RAISE EXCEPTION 'Team-Beitritt nur über Anfrage möglich.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_guard_profiles_studio_id ON profiles;
CREATE TRIGGER trg_guard_profiles_studio_id
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION guard_profiles_studio_id();

-- 7. create_studio_with_owner must now set the owner's studio_id server-side
-- (the client no longer does it). Preserve the existing entitlement check.
CREATE OR REPLACE FUNCTION public.create_studio_with_owner(p_name text, p_city text)
RETURNS TABLE (id uuid, name text, city text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_tier text; v_id uuid;
BEGIN
  SELECT s.tier INTO v_tier FROM subscriptions s
  WHERE s.user_id = auth.uid()
    AND s.status IN ('active', 'trialing', 'past_due')
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  LIMIT 1;
  IF NOT entitlement_allows(v_tier, 'create_studio') THEN
    RAISE EXCEPTION 'Studio-Abo erforderlich';
  END IF;
  INSERT INTO studios (name, city, owner_user_id)
  VALUES (trim(p_name), trim(p_city), auth.uid())
  RETURNING studios.id INTO v_id;
  UPDATE profiles SET studio_id = v_id WHERE profiles.id = auth.uid();
  RETURN QUERY SELECT s.id, s.name, s.city FROM studios s WHERE s.id = v_id;
END; $$;
GRANT EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.create_studio_with_owner(text, text) FROM anon;
