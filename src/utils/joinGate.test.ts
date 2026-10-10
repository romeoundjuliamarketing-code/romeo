import { joinGateFor, nearbyRadiusWithin } from './joinGate';

describe('joinGateFor', () => {
  it('236 km at the initial 150 km limit is blocked with the unlock path open', () => {
    expect(joinGateFor({
      kind: 'refused',
      refusal: { ok: false, reason: 'too_far' as const, distance_m: 236000, radius_km: 150, unlocked: false },
    })).toEqual({ kind: 'tooFar', distanceM: 236000, radiusKm: 150, unlocked: false });
  });

  it('within the limit is allowed', () => {
    expect(joinGateFor({ kind: 'ok' })).toEqual({ kind: 'allowed' });
  });

  it('beyond the unlocked 300 km is blocked without further unlock', () => {
    expect(joinGateFor({
      kind: 'refused',
      refusal: { ok: false, reason: 'too_far' as const, distance_m: 412000, radius_km: 300, unlocked: true },
    })).toEqual({ kind: 'tooFar', distanceM: 412000, radiusKm: 300, unlocked: true });
  });

  it('missing distance falls back to null and the base radius', () => {
    expect(joinGateFor({ kind: 'refused', refusal: { ok: false, reason: 'too_far' as const } }))
      .toEqual({ kind: 'tooFar', distanceM: null, radiusKm: 150, unlocked: false });
  });

  it('missing location or a failed check is never shown as too far', () => {
    expect(joinGateFor({ kind: 'location' })).toEqual({ kind: 'unknown' });
    expect(joinGateFor({ kind: 'network' })).toEqual({ kind: 'unknown' });
    expect(joinGateFor({ kind: 'refused', refusal: { ok: false, reason: 'location_missing' as const } }))
      .toEqual({ kind: 'unknown' });
    expect(joinGateFor({ kind: 'refused', refusal: { ok: false, reason: 'slot_taken' as const } }))
      .toEqual({ kind: 'unknown' });
  });
});

describe('nearbyRadiusWithin', () => {
  it('picks the largest radius filter inside the allowed distance', () => {
    expect(nearbyRadiusWithin(150)).toBe(100);
    expect(nearbyRadiusWithin(300)).toBe(100);
    expect(nearbyRadiusWithin(40)).toBe(30);
    expect(nearbyRadiusWithin(null)).toBe(100);
  });
});
