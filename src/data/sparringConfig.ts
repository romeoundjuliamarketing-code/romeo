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

// Events / watch parties are paused for now: no "Events" mode on the sparring
// map and no fight-night block on Home. Code, tables and venue event screens
// stay in place; flip to bring them back.
export const SHOW_EVENTS = false;

// Reliable sparrings: start values mirrored from the sparring_trust_* SQL
// functions in supabase/migrations/20261008120000_sparring_trust_schema.sql.
// The server decides; these only drive UI copy and client-side re-measuring.
export const SPARRING_TRUST = {
  radiusBaseKm: 150,
  radiusUnlockedKm: 300,
  locationMaxAgeS: 120,
  locationMaxAccuracyM: 200,
  publishLimit: 3,
  publishWindowHours: 24,
  checkinOpenBeforeMin: 30,
  checkinCloseAfterMin: 60,
  checkinRadiusM: 500,
  qrTtlS: 60,
  // Client renews the QR code before the server-side 60 s expiry.
  qrRefreshS: 45,
  feedbackWindowHours: 72,
  introVersion: 1,
  // Planned length of a new sparring (server accepts 30..300 minutes).
  durationOptionsMin: [60, 90, 120, 180] as const,
  // Fix older than this is re-measured before a binding action (below the
  // server limit so transfer time does not push it over).
  clientRefixAfterS: 90,
} as const;
