-- RPC for deactivating a sparring session.
-- SECURITY DEFINER bypasses RLS so the creator can set is_active=false
-- even though the updated row would no longer satisfy the SELECT policy.
-- Authorization is enforced inside the function: only the creator may deactivate.
CREATE OR REPLACE FUNCTION deactivate_sparring(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE open_sparrings
  SET is_active = false
  WHERE id = p_id
    AND created_by = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sparring nicht gefunden oder keine Berechtigung';
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION deactivate_sparring(uuid) TO authenticated;
