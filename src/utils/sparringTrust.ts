// Pure helpers for the reliable-sparrings UI. Decisions (radius, distance,
// slot, rate limit, check-in, unlock) are made by the server; these helpers only
// prepare the device fix and turn server answers into what the UI shows.
import { SPARRING_TRUST } from '../data/sparringConfig';
import type { DeviceFix, TrustReason } from '../types/sparringTrust';
import type de from '../i18n/locales/de';

export type TrustNoticeKey = keyof typeof de.sparringTrust.notice;

export type FixQuality = 'ok' | 'stale' | 'inaccurate';

export function fixAgeSeconds(fix: DeviceFix, nowMs: number): number {
  return Math.round((nowMs - fix.timestamp) / 100) / 10;
}

// Mirrors sparring_position_problem() so the app re-measures before sending a
// fix the server would refuse anyway.
export function classifyFix(fix: DeviceFix, nowMs: number): FixQuality {
  if (!Number.isFinite(fix.accuracyM) || fix.accuracyM > SPARRING_TRUST.locationMaxAccuracyM) {
    return 'inaccurate';
  }
  if (fixAgeSeconds(fix, nowMs) > SPARRING_TRUST.clientRefixAfterS) return 'stale';
  return 'ok';
}

export interface FixRpcArgs {
  p_lat: number;
  p_lng: number;
  p_accuracy_m: number;
  p_fix_age_s: number;
}

export function fixToRpcArgs(fix: DeviceFix, nowMs: number): FixRpcArgs {
  return {
    p_lat: fix.lat,
    p_lng: fix.lng,
    p_accuracy_m: Math.round(fix.accuracyM * 10) / 10,
    p_fix_age_s: Math.max(0, fixAgeSeconds(fix, nowMs)),
  };
}

// Distance text for "too far" notices. Unknown distance -> null (never invent one).
// Near the radius one decimal is shown and rounded UP, so a refused distance is
// never displayed as equal to the radius (e.g. 150.0004 km -> "150,1").
export function formatTooFarKm(distanceM: number | undefined | null, radiusKm: number, locale: string): string | null {
  if (distanceM === undefined || distanceM === null || !Number.isFinite(distanceM)) return null;
  const km = distanceM / 1000;
  if (km < radiusKm + 1) {
    const up = Math.ceil(km * 10) / 10;
    return up.toLocaleString(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  return Math.round(km).toLocaleString(locale);
}

export type TrustAction = 'nearby' | 'howItWorks' | 'limit' | 'mySparring' | 'retry' | 'settings';

export interface TrustNotice {
  // i18n key below sparringTrust.notice.*
  key: TrustNoticeKey;
  actions: TrustAction[];
}

// Server reason -> user-facing notice. Every refusal gets an explanation and a
// way forward; technical reasons fall back to a generic, non-technical text.
export function trustNoticeFor(reason: TrustReason): TrustNotice {
  switch (reason) {
    case 'too_far':
      return { key: 'tooFar', actions: ['nearby', 'howItWorks'] };
    case 'slot_taken':
      return { key: 'slotTaken', actions: ['mySparring'] };
    case 'rate_limited':
      return { key: 'rateLimited', actions: ['howItWorks'] };
    case 'location_missing':
      return { key: 'locationMissing', actions: ['retry'] };
    case 'location_inaccurate':
      return { key: 'locationInaccurate', actions: ['retry'] };
    case 'location_stale':
      return { key: 'locationStale', actions: ['retry'] };
    case 'place_unknown':
      return { key: 'placeUnknown', actions: [] };
    case 'place_invalid':
      return { key: 'placeInvalid', actions: [] };
    case 'place_label_required':
      return { key: 'placeLabelRequired', actions: [] };
    case 'place_label_invalid':
      return { key: 'placeLabelInvalid', actions: [] };
    case 'permission_not_confirmed':
      return { key: 'permissionNotConfirmed', actions: [] };
    case 'own_sparring':
      return { key: 'ownSparring', actions: [] };
    case 'sparring_gone':
    case 'sparring_cancelled':
      return { key: 'sparringGone', actions: [] };
    case 'sparring_started':
      return { key: 'sparringStarted', actions: [] };
    case 'verified_only':
      return { key: 'verifiedOnly', actions: [] };
    case 'time_invalid':
      return { key: 'timeInvalid', actions: [] };
    case 'duration_invalid':
      return { key: 'durationInvalid', actions: [] };
    case 'content_blocked':
      return { key: 'contentBlocked', actions: [] };
    case 'subscription_required':
      return { key: 'subscriptionRequired', actions: [] };
    case 'not_coach':
      return { key: 'notCoach', actions: [] };
    case 'checkin_not_open':
      return { key: 'checkinNotOpen', actions: [] };
    case 'checkin_closed':
      return { key: 'checkinClosed', actions: [] };
    case 'too_far_from_venue':
      return { key: 'tooFarFromVenue', actions: ['retry'] };
    case 'token_expired':
      return { key: 'tokenExpired', actions: ['retry'] };
    case 'token_invalid':
    case 'token_wrong_sparring':
      return { key: 'tokenInvalid', actions: ['retry'] };
    case 'organizer_self':
      return { key: 'organizerSelf', actions: [] };
    case 'not_participant':
      return { key: 'notParticipant', actions: [] };
    case 'not_organizer':
      return { key: 'notOrganizer', actions: [] };
    case 'feedback_not_open':
      return { key: 'feedbackNotOpen', actions: [] };
    case 'feedback_closed':
      return { key: 'feedbackClosed', actions: [] };
    case 'suggestion_rate_limited':
      return { key: 'suggestionRateLimited', actions: [] };
    default:
      return { key: 'generic', actions: ['retry'] };
  }
}

// Offset between server and device clock (ms). Countdowns use server time so a
// wrong device clock cannot open or close windows early.
export function serverOffsetMs(serverNowIso: string, deviceNowMs: number): number {
  const server = Date.parse(serverNowIso);
  return Number.isFinite(server) ? server - deviceNowMs : 0;
}

export type CheckinPhase = 'before' | 'open' | 'closed';

export function checkinPhase(opensAtIso: string, closesAtIso: string, serverNowMs: number): CheckinPhase {
  if (serverNowMs < Date.parse(opensAtIso)) return 'before';
  if (serverNowMs > Date.parse(closesAtIso)) return 'closed';
  return 'open';
}

// Extracts the token from a scanned check-in QR code ("sparr-checkin:v1:<token>").
// Anything else (profile QR codes, URLs) is not a check-in code.
export const CHECKIN_QR_PREFIX = 'sparr-checkin:v1:';

export function checkinQrValue(token: string): string {
  return `${CHECKIN_QR_PREFIX}${token}`;
}

export function parseCheckinQr(data: string): string | null {
  if (!data.startsWith(CHECKIN_QR_PREFIX)) return null;
  const token = data.slice(CHECKIN_QR_PREFIX.length);
  return /^[A-Za-z0-9_-]{16,128}$/.test(token) ? token : null;
}
