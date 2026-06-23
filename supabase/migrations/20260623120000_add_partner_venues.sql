-- Partner-Venues: persistent profiles for bars/locations hosting events.
-- B2B activation only (grant_venue_partner, service_role). No IAP.

-- ---------------------------------------------------------------------------
-- venues
-- ---------------------------------------------------------------------------
CREATE TABLE venues (
  id            uuid             PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id uuid             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text             NOT NULL,
  venue_type    text             NOT NULL DEFAULT 'bar',  -- bar/restaurant/lounge/sportsbar
  city          text,
  address       text,
  lat           double precision,
  lng           double precision,
  description   text,
  capacity      int,
  opening_hours jsonb,
  avatar_url    text,
  banner_url    text,
  instagram     text,
  tags          text[],
  is_active     boolean          NOT NULL DEFAULT false,
  created_at    timestamptz      NOT NULL DEFAULT now()
);

CREATE INDEX venues_active_idx ON venues (id) WHERE is_active = true;
CREATE INDEX venues_owner_idx  ON venues (owner_user_id);

ALTER TABLE venues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone reads active venues" ON venues
  FOR SELECT USING (is_active = true);

CREATE POLICY "owner reads own venue" ON venues
  FOR SELECT USING (owner_user_id = auth.uid());

-- Owner may edit profile fields. is_active is guarded by a trigger (Step 2)
-- so the client cannot self-activate.
CREATE POLICY "owner updates own venue" ON venues
  FOR UPDATE USING (owner_user_id = auth.uid())
  WITH CHECK (owner_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- venue_photos
-- ---------------------------------------------------------------------------
CREATE TABLE venue_photos (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  url        text        NOT NULL,
  sort_order int         NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX venue_photos_venue_idx ON venue_photos (venue_id, sort_order);

ALTER TABLE venue_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read photos of active venues" ON venue_photos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM venues v
      WHERE v.id = venue_id AND (v.is_active OR v.owner_user_id = auth.uid())
    )
  );

CREATE POLICY "owner inserts venue photos" ON venue_photos
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

CREATE POLICY "owner deletes venue photos" ON venue_photos
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

CREATE POLICY "owner updates venue photos" ON venue_photos
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.owner_user_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- venue_ratings (mirrors studio_ratings)
-- ---------------------------------------------------------------------------
CREATE TABLE venue_ratings (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  venue_id   uuid        NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars      int         NOT NULL CHECK (stars BETWEEN 1 AND 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (venue_id, user_id)
);

CREATE INDEX venue_ratings_venue_idx ON venue_ratings (venue_id);

ALTER TABLE venue_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read ratings of active venues" ON venue_ratings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM venues v WHERE v.id = venue_id AND v.is_active)
  );

CREATE POLICY "user writes own venue rating" ON venue_ratings
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user updates own venue rating" ON venue_ratings
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "user deletes own venue rating" ON venue_ratings
  FOR DELETE USING (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- events.venue_id
-- ---------------------------------------------------------------------------
ALTER TABLE events ADD COLUMN venue_id uuid NULL REFERENCES venues(id) ON DELETE SET NULL;
CREATE INDEX events_venue_idx ON events (venue_id) WHERE venue_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Guard: a normal client UPDATE must not flip is_active. Only SECURITY DEFINER
-- functions (which run as the table owner / bypass this via the role check)
-- may change it.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION venues_guard_is_active()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- service_role (grant_venue_partner) may change anything.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;
  -- For everyone else, preserve the existing is_active value.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER venues_guard_is_active_trg
  BEFORE UPDATE ON venues
  FOR EACH ROW EXECUTE FUNCTION venues_guard_is_active();
