-- Map pins as sparring places (e.g. a meadow without a street address).
-- resolve-sparring-place stores them with osm_type 'pin' (osm_id = packed,
-- rounded coordinates) and category 'address', so publish_sparring requires a
-- place label as for plain addresses. The target coordinates still come only
-- from this table; the distance limit in publish_sparring applies unchanged.
-- Additive: existing rows and RPCs are untouched.

ALTER TABLE sparring_places DROP CONSTRAINT IF EXISTS sparring_places_osm_type_check;
ALTER TABLE sparring_places
  ADD CONSTRAINT sparring_places_osm_type_check
  CHECK (osm_type IN ('node', 'way', 'relation', 'pin'));
