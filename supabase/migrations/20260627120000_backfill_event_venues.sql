-- Backfill: link bar/public-viewing events to venue profiles so the event card's
-- "Location ansehen" button can open the bar. Existing venues are reused when an
-- event sits at (essentially) the same spot; otherwise a sparse venue
-- (name/address/coords) is created and enriched later via the venue admin editor.
-- Idempotent: only touches active, named events that are not yet linked.

-- 1. Reuse an existing venue when the event sits at (essentially) the same place.
UPDATE events e
SET venue_id = v.id
FROM venues v
WHERE e.is_active = true
  AND e.venue_id IS NULL
  AND coalesce(trim(e.venue_name), '') <> ''
  AND e.lat IS NOT NULL AND e.lng IS NOT NULL
  AND abs(v.lat - e.lat) < 0.002
  AND abs(v.lng - e.lng) < 0.002;

-- 2. Create a venue per remaining unlinked event and link it.
DO $$
DECLARE
  r      RECORD;
  new_id uuid;
BEGIN
  FOR r IN
    SELECT id, venue_name, address, lat, lng
    FROM events
    WHERE is_active = true
      AND venue_id IS NULL
      AND coalesce(trim(venue_name), '') <> ''
      AND lat IS NOT NULL
      AND lng IS NOT NULL
  LOOP
    INSERT INTO venues (name, venue_type, address, lat, lng, is_active)
    VALUES (r.venue_name, 'Bar', r.address, r.lat, r.lng, true)
    RETURNING id INTO new_id;

    UPDATE events SET venue_id = new_id WHERE id = r.id;
  END LOOP;
END $$;
