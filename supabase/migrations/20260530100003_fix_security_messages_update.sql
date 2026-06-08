-- Security fix: restrict UPDATE on sparring_messages to the read_at column only.
-- The previous UPDATE policy allowed the recipient to modify any column,
-- including content and sender_id (message tampering / identity spoofing).
-- Column-level grants are the cleanest enforcement: RLS still applies on top.

REVOKE UPDATE ON sparring_messages FROM authenticated;
GRANT  UPDATE (read_at) ON sparring_messages TO authenticated;
