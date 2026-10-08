// Result shapes of the reliable-sparrings RPCs
// (supabase/migrations/20261008120100_sparring_trust_rpcs.sql).
// The server is authoritative for radius, unlock state, distance, counters,
// tokens and time; the client only renders these values.

export type TrustReason =
  | 'too_far'
  | 'slot_taken'
  | 'rate_limited'
  | 'location_missing'
  | 'location_inaccurate'
  | 'location_stale'
  | 'place_invalid'
  | 'place_unknown'
  | 'place_label_required'
  | 'place_label_invalid'
  | 'permission_not_confirmed'
  | 'subscription_required'
  | 'not_coach'
  | 'details_invalid'
  | 'time_invalid'
  | 'duration_invalid'
  | 'content_blocked'
  | 'invalid_request'
  | 'invalid_action'
  | 'sparring_gone'
  | 'sparring_started'
  | 'sparring_cancelled'
  | 'own_sparring'
  | 'verified_only'
  | 'rules_required'
  | 'join_failed'
  | 'not_organizer'
  | 'not_participant'
  | 'organizer_self'
  | 'checkin_not_open'
  | 'checkin_closed'
  | 'too_far_from_venue'
  | 'token_invalid'
  | 'token_wrong_sparring'
  | 'token_expired'
  | 'feedback_not_open'
  | 'feedback_closed'
  | 'answer_invalid'
  | 'note_too_long'
  | 'suggestion_rate_limited';

// Common refusal payload. Optional fields depend on the reason.
export interface TrustRefusal {
  ok: false;
  reason: TrustReason;
  radius_km?: number;
  unlocked?: boolean;
  distance_m?: number;
  active_sparring_id?: string;
  next_publish_at?: string;
  opens_at?: string;
  detail?: string;
}

export interface SparringReachStatus {
  radius_km: number;
  base_radius_km: number;
  unlocked_radius_km: number;
  unlocked: boolean;
  unlocked_at: string | null;
  unlock_unseen: boolean;
  active_count: number;
  active_limit: number;
  active_sparring_id: string | null;
  publish_used: number;
  publish_limit: number;
  publish_next_at: string | null;
  intro_acked: boolean;
  intro_version: number;
  server_now: string;
}

export type EligibilityResult =
  | { ok: true; radius_km?: number; unlocked?: boolean; distance_m?: number; already?: string }
  | TrustRefusal;

export type PublishResult =
  | { ok: true; sparring_id: string; replayed: boolean }
  | TrustRefusal;

export type JoinV2Result =
  | { ok: true; status: 'pending' | 'confirmed' | 'waitlisted'; replayed: boolean; distance_m?: number }
  | TrustRefusal;

export type CheckinSessionResult =
  | { ok: true; token: string; expires_at: string; server_now: string; ttl_s: number }
  | TrustRefusal;

export type CheckinResult =
  | { ok: true; checked_in_at: string; already: boolean }
  | TrustRefusal;

export type MeetingAnswer = 'happened' | 'cancelled' | 'problem';

export type FeedbackResult =
  | { ok: true; answer: MeetingAnswer; already: boolean; unlocked: boolean }
  | TrustRefusal;

export interface SparringTrustState {
  role: 'organizer' | 'participant' | 'none';
  signup_status?: string | null;
  cancelled?: boolean;
  has_place?: boolean;
  starts_at?: string;
  ends_at?: string;
  checkin_opens_at?: string;
  checkin_closes_at?: string;
  checked_in_at?: string | null;
  checked_in_count?: number | null;
  feedback_answer?: MeetingAnswer | null;
  feedback_opens_at?: string;
  feedback_closes_at?: string;
  can_feedback?: boolean;
  server_now: string;
}

export interface SparringCheckinEntry {
  user_id: string;
  name: string | null;
  avatar_url: string | null;
  checked_in_at: string;
}

export type PlaceSuggestionResult =
  | { ok: true; id: string }
  | TrustRefusal;

// One server-resolved place from the resolve-sparring-place Edge Function.
export interface SparringPlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  // 'address' = plain street address: the organizer must name the venue.
  category: string;
}

// The device fix sent with binding actions. Never stored on the server.
export interface DeviceFix {
  lat: number;
  lng: number;
  accuracyM: number;
  // Device time of the measurement (ms since epoch); the age is computed on the
  // device so a skewed device clock does not matter.
  timestamp: number;
}
