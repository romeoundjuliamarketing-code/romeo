-- Global venue admin: a fixed account that may read, edit and activate ALL
-- venues (incl. inactive and ownerless team-curated entries). This complements
-- the existing owner-scoped RLS policies; permissive policies are OR'd together,
-- so owners keep their existing rights and the admin gains a superset.

-- ---------------------------------------------------------------------------
-- is_venue_admin: true when the current user is the fixed admin account.
-- SECURITY DEFINER so the policy may read auth.users (not exposed to clients).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION is_venue_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
      AND lower(email) = 'romeo.georgiadis@gmail.com'
  );
$$;

REVOKE EXECUTE ON FUNCTION is_venue_admin() FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION is_venue_admin() TO authenticated;

-- ---------------------------------------------------------------------------
-- venues: admin may read and edit every row.
-- ---------------------------------------------------------------------------
CREATE POLICY "admin reads all venues" ON venues
  FOR SELECT USING (is_venue_admin());

CREATE POLICY "admin updates all venues" ON venues
  FOR UPDATE USING (is_venue_admin()) WITH CHECK (is_venue_admin());

-- ---------------------------------------------------------------------------
-- venue_photos: admin may read/add/edit/delete photos of every venue.
-- ---------------------------------------------------------------------------
CREATE POLICY "admin reads all venue photos" ON venue_photos
  FOR SELECT USING (is_venue_admin());

CREATE POLICY "admin inserts any venue photos" ON venue_photos
  FOR INSERT WITH CHECK (is_venue_admin());

CREATE POLICY "admin updates any venue photos" ON venue_photos
  FOR UPDATE USING (is_venue_admin()) WITH CHECK (is_venue_admin());

CREATE POLICY "admin deletes any venue photos" ON venue_photos
  FOR DELETE USING (is_venue_admin());

-- ---------------------------------------------------------------------------
-- Allow the admin to flip is_active (map visibility), which the guard trigger
-- otherwise preserves for non-service_role clients.
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
  -- The global venue admin may also toggle is_active.
  IF is_venue_admin() THEN
    RETURN NEW;
  END IF;
  -- For everyone else, preserve the existing is_active value.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.is_active := OLD.is_active;
  END IF;
  RETURN NEW;
END;
$$;
