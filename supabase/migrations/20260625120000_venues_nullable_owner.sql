-- Allow ownerless venues: team-curated entries that exist without an account.
-- The FK to auth.users is preserved; NULL is valid with a nullable FK column.
-- A venue with owner_user_id = NULL cannot be edited by any client (no RLS policy
-- matches), so it is effectively read-only until claimed by setting an owner later.
ALTER TABLE venues ALTER COLUMN owner_user_id DROP NOT NULL;
