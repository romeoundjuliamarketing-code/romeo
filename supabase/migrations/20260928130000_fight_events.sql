-- Official fight-night dates (UFC, OKTAGON, …) for the Home block
-- "Gemeinsam Kämpfe schauen". Curated reference data, maintained by the team
-- (dashboard / SQL as service_role) from the promoters' official event pages —
-- there is no API key in the client and no scraping on app start.
--
-- A fight night is NOT a watch party: local meet-ups stay in `events`
-- (public_viewing). Nothing here creates or changes those.
--
-- Times are absolute (timestamptz); the app renders them in the device time
-- zone, so a US Saturday evening shows as Sunday morning in Germany.
--   event_date    local calendar date of the event at the venue (always known)
--   prelims_at    start of the prelims broadcast, if announced
--   main_card_at  start of the main card, if announced
--   ends_at       expected end; when null the app treats the night as running
--                 until 8 h after the last known start, so a live event does
--                 not disappear when the main card begins
--   status        'scheduled' | 'cancelled' (cancelled rows are never shown)
--
-- Not applied to production by this change. No rows are inserted here.

CREATE TABLE IF NOT EXISTS public.fight_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion     text        NOT NULL CHECK (promotion IN ('UFC', 'OKTAGON')),
  name          text        NOT NULL CHECK (length(trim(name)) > 0),
  event_date    date        NOT NULL,
  prelims_at    timestamptz,
  main_card_at  timestamptz,
  ends_at       timestamptz,
  status        text        NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'cancelled')),
  source_url    text,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fight_events_upcoming_idx
  ON public.fight_events (promotion, event_date) WHERE status = 'scheduled';

ALTER TABLE public.fight_events ENABLE ROW LEVEL SECURITY;

-- Reference data: readable for signed-in users, writable only by service_role
-- (no insert/update/delete policy for clients).
DROP POLICY IF EXISTS "authenticated reads fight events" ON public.fight_events;
CREATE POLICY "authenticated reads fight events" ON public.fight_events
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.fight_events FROM anon;
GRANT SELECT ON public.fight_events TO authenticated;

-- Upcoming and running fight nights, earliest first (a few per promotion).
-- One call serves every promotion, so Home never queries twice.
CREATE OR REPLACE FUNCTION public.get_upcoming_fight_events()
RETURNS SETOF public.fight_events
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT f.*
    FROM public.fight_events f
   WHERE f.status = 'scheduled'
     AND COALESCE(
           f.ends_at,
           COALESCE(f.main_card_at, f.prelims_at, (f.event_date + 1)::timestamp AT TIME ZONE 'UTC')
             + interval '8 hours'
         ) > now()
   ORDER BY COALESCE(f.prelims_at, f.main_card_at, f.event_date::timestamp AT TIME ZONE 'UTC')
   LIMIT 20;
$$;

REVOKE ALL ON FUNCTION public.get_upcoming_fight_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_upcoming_fight_events() TO authenticated;
