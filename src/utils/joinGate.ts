import { SPARRING_TRUST } from '../data/sparringConfig';
import type { TrustRefusal } from '../types/sparringTrust';
import { RADIUS_OPTIONS_KM } from './sparringSearch';

// Whether the user may join a sparring, as far as the client knows before the
// binding join. Only the server decides; this just mirrors its last answer.
// 'unknown': nothing measured yet (no location permission, check failed) —
// never shown as a radius refusal.
export type JoinGate =
  | { kind: 'unknown' }
  | { kind: 'checking' }
  | { kind: 'allowed' }
  | { kind: 'tooFar'; distanceM: number | null; radiusKm: number; unlocked: boolean };

// Structural subset of TrustOutcome (hooks/useSparringTrustActions).
export type GateOutcome =
  | { kind: 'ok' }
  | { kind: 'refused'; refusal: TrustRefusal }
  | { kind: 'location' }
  | { kind: 'network' };

export function joinGateFor(out: GateOutcome): JoinGate {
  if (out.kind === 'ok') return { kind: 'allowed' };
  if (out.kind === 'refused' && out.refusal.reason === 'too_far') {
    const r = out.refusal;
    return {
      kind: 'tooFar',
      distanceM: typeof r.distance_m === 'number' && Number.isFinite(r.distance_m) ? r.distance_m : null,
      radiusKm: r.radius_km ?? SPARRING_TRUST.radiusBaseKm,
      unlocked: r.unlocked === true,
    };
  }
  return { kind: 'unknown' };
}

// Largest existing radius filter that stays inside the allowed join distance,
// so "Sparring in meiner Nähe finden" only lists sparrings the user can join.
export function nearbyRadiusWithin(reachKm: number | null | undefined): number {
  const limit = reachKm ?? SPARRING_TRUST.radiusBaseKm;
  const fitting = RADIUS_OPTIONS_KM.filter((km) => km <= limit);
  return fitting.length > 0 ? fitting[fitting.length - 1] : RADIUS_OPTIONS_KM[0];
}
