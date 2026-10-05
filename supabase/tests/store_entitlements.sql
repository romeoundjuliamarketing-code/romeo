-- Scenario tests for store entitlements (spec 2026-09-29-sparr-abos-design.md, section 2).
-- Run via supabase/tests/run_store_entitlements.sh against a throwaway local DB.

\set ON_ERROR_STOP 1
SET client_min_messages = notice;

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-0000000000b2');
INSERT INTO profiles (id, name) VALUES
  ('00000000-0000-0000-0000-0000000000a1', 'Anna'),
  ('00000000-0000-0000-0000-0000000000b2', 'Ben');

CREATE FUNCTION t_a() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-0000000000a1'::uuid $$;
CREATE FUNCTION t_b() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-0000-0000-0000000000b2'::uuid $$;

CREATE FUNCTION t_as(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claim.sub', COALESCE(p_uid::text, ''), false)
$$;

-- Tries a private sparring insert as p_uid through RLS; true = allowed.
CREATE FUNCTION t_try_insert(p_uid uuid) RETURNS boolean LANGUAGE plpgsql AS $$
BEGIN
  PERFORM t_as(p_uid);
  SET LOCAL ROLE authenticated;
  INSERT INTO open_sparrings (created_by, title, discipline, address, lat, lng, scheduled_at)
  VALUES (p_uid, 'Test', 'Boxen', 'Hauptstr. 1, 28195 Bremen', 53.08, 8.80, now() + interval '2 days');
  RESET ROLE;
  RETURN true;
EXCEPTION WHEN insufficient_privilege THEN
  RESET ROLE;
  RETURN false;
END $$;

CREATE FUNCTION t_flag(p_on boolean) RETURNS void LANGUAGE sql AS $$
  UPDATE app_flags SET enabled = p_on WHERE key = 'sparring_creation_requires_sub'
$$;

DO $$ BEGIN
  ASSERT (SELECT NOT enabled FROM app_flags WHERE key = 'sparring_creation_requires_sub'), 'flag starts off';
  ASSERT t_try_insert(t_a()), 'flag off: insert without subscription allowed';
  RAISE NOTICE 'ok 1 Schalter aus: Erstellen ohne Abo erlaubt';
END $$;

DO $$ BEGIN
  PERFORM t_flag(true);
  ASSERT NOT t_try_insert(t_a()), 'flag on: insert without subscription denied';
  RAISE NOTICE 'ok 2 Schalter an: Erstellen ohne Abo abgelehnt';
END $$;

DO $$ BEGIN
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', now() + interval '30 days');
  ASSERT t_try_insert(t_a()), 'valid creator allowed';
  ASSERT NOT t_try_insert(t_b()), 'other user still denied';
  RAISE NOTICE 'ok 3 Gültiges Ersteller-Abo: Erstellen erlaubt';
END $$;

DO $$ BEGIN
  -- An older grant must never shorten access.
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', now() + interval '1 day');
  ASSERT (SELECT expires_at > now() + interval '29 days' FROM store_entitlements WHERE user_id = t_a() AND entitlement = 'creator'), 'not shortened';
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', NULL);
  ASSERT NOT t_try_insert(t_a()), 'expired creator denied';
  RAISE NOTICE 'ok 4 Ablauf beendet, ältere Verlängerung verkürzt nicht';
END $$;

DO $$
DECLARE r record;
BEGIN
  -- Downgrade bundle -> cards with the bundle EXPIRATION arriving after the cards RENEWAL.
  PERFORM apply_store_entitlement(t_b(), ARRAY['creator', 'cards'], 'sparr_bundle_monthly', now() + interval '10 days');
  PERFORM apply_store_entitlement(t_b(), ARRAY['cards'], 'sparr_individual_monthly', now() + interval '40 days');
  PERFORM apply_store_entitlement(t_b(), ARRAY['creator', 'cards'], 'sparr_bundle_monthly', NULL);
  PERFORM t_as(t_b());
  SELECT * INTO r FROM get_my_store_entitlements();
  ASSERT NOT r.creator_active, 'bundle creator ended';
  ASSERT r.cards_active, 'cards now owned by the cards product stay active';
  ASSERT NOT r.can_create_sparring, 'no creator -> cannot create';
  ASSERT r.creation_requires_sub, 'flag reported';
  RAISE NOTICE 'ok 5 Wechsel mit vertauschter Reihenfolge: Karten bleiben';
END $$;

DO $$
DECLARE denied integer := 0; visible integer;
BEGIN
  PERFORM t_as(t_b());
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO store_entitlements (user_id, entitlement, product_id, expires_at)
        VALUES (t_b(), 'creator', 'x', now() + interval '1 year');
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN PERFORM apply_store_entitlement(t_b(), ARRAY['creator'], 'x', now() + interval '1 year');
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  BEGIN UPDATE app_flags SET enabled = false;
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  SELECT count(*) INTO visible FROM store_entitlements;  -- only own rows
  RESET ROLE;
  ASSERT denied = 3, format('denied %s of 3', denied);
  ASSERT visible = 2, format('user b sees %s rows, expected own 2 (creator expired, cards)', visible);
  RAISE NOTICE 'ok 6 Nutzer kann Abos und Schalter nicht selbst schreiben, sieht nur eigene Zeilen';
END $$;

DO $$
DECLARE r record; denied integer := 0;
BEGIN
  -- Anna restores on Ben's account: her creator grant moves to Ben, keeps its expiry.
  PERFORM apply_store_entitlement(t_a(), ARRAY['creator'], 'sparr_creator_monthly', now() + interval '20 days');
  PERFORM transfer_store_entitlements(ARRAY[t_a()], t_b());
  ASSERT NOT EXISTS (SELECT 1 FROM store_entitlements WHERE user_id = t_a()), 'old user has no rows left';
  PERFORM t_as(t_b());
  SELECT * INTO r FROM get_my_store_entitlements();
  ASSERT r.creator_active AND r.can_create_sparring, 'creator moved to new user';
  ASSERT r.cards_active, 'new user keeps own cards';
  ASSERT (SELECT expires_at < now() + interval '21 days' FROM store_entitlements WHERE user_id = t_b() AND entitlement = 'creator'), 'expiry kept';
  SET LOCAL ROLE authenticated;
  BEGIN PERFORM transfer_store_entitlements(ARRAY[t_b()], t_a());
  EXCEPTION WHEN insufficient_privilege THEN denied := denied + 1; END;
  RESET ROLE;
  ASSERT denied = 1, 'authenticated cannot transfer';
  RAISE NOTICE 'ok 7 Wiederherstellen auf anderem Konto verschiebt das Abo';
END $$;

\echo 'ALL STORE ENTITLEMENT TESTS PASSED'
