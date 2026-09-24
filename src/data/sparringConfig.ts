// Commitment deadlines for sparring signups. Mirrors the SQL functions
// sparring_cancel_deadline(), sparring_confirm_deadline() and
// sparring_confirm_window() in
// supabase/migrations/20260911120100_sparring_commitment_rpcs.sql.
// The server is authoritative — these values only drive UI copy. Keep in sync.
export const SPARRING_CANCEL_DEADLINE_HOURS = 6;
export const SPARRING_CONFIRM_DEADLINE_HOURS = 6;
export const SPARRING_CONFIRM_WINDOW_HOURS = 24;

// Star ratings between sparring partners are hidden in favour of the
// reliability quote. Code and table stay in place; flip to bring them back.
export const SHOW_SPARRING_STARS = false;
