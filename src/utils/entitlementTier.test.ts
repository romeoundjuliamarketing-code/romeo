import { tierAllows } from './entitlementTier';

// Feature sets (mirrors the implementation — used for exhaustive matrix tests)
const visibilityFeatures = [
  'create_studio',
  'manage_studio',
  'map_visibility',
  'invite_members',
  'trial_bookings',
  'drop_in',
] as const;

const suiteOnlyFeatures = [
  'announce',
  'manage_memberships',
  'coach_system',
  'attendance',
] as const;

const allFeatures = [...visibilityFeatures, ...suiteOnlyFeatures] as const;

// ── none ────────────────────────────────────────────────────────────────────────

describe('none tier', () => {
  test.each(allFeatures)('denies %s', (feature) => {
    expect(tierAllows('none', feature)).toBe(false);
  });
});

// ── individual ──────────────────────────────────────────────────────────────────

describe('individual tier', () => {
  test.each(allFeatures)('denies %s', (feature) => {
    expect(tierAllows('individual', feature)).toBe(false);
  });
});

// ── studio_visibility ───────────────────────────────────────────────────────────

describe('studio_visibility tier', () => {
  test.each(visibilityFeatures)('allows %s', (feature) => {
    expect(tierAllows('studio_visibility', feature)).toBe(true);
  });

  test.each(suiteOnlyFeatures)('denies suite-only feature %s', (feature) => {
    expect(tierAllows('studio_visibility', feature)).toBe(false);
  });
});

// ── studio_suite ────────────────────────────────────────────────────────────────

describe('studio_suite tier', () => {
  test.each(allFeatures)('allows %s', (feature) => {
    expect(tierAllows('studio_suite', feature)).toBe(true);
  });
});

// ── superset guarantee: studio_suite ⊇ studio_visibility ────────────────────────

describe('superset guarantee', () => {
  test.each(visibilityFeatures)(
    'studio_suite allows every studio_visibility feature: %s',
    (feature) => {
      const visibilityAllows = tierAllows('studio_visibility', feature);
      const suiteAllows = tierAllows('studio_suite', feature);
      // If visibility allows it, suite must too.
      if (visibilityAllows) {
        expect(suiteAllows).toBe(true);
      }
    },
  );

  it('studio_suite allows strictly more features than studio_visibility', () => {
    const suiteOnlyCount = suiteOnlyFeatures.filter(
      (f) => !tierAllows('studio_visibility', f) && tierAllows('studio_suite', f),
    ).length;
    expect(suiteOnlyCount).toBe(suiteOnlyFeatures.length);
  });
});

// ── explicit spot-checks ────────────────────────────────────────────────────────

describe('spot checks', () => {
  it('announce is denied for studio_visibility', () => {
    expect(tierAllows('studio_visibility', 'announce')).toBe(false);
  });

  it('announce is allowed for studio_suite', () => {
    expect(tierAllows('studio_suite', 'announce')).toBe(true);
  });

  it('create_studio is allowed for studio_visibility', () => {
    expect(tierAllows('studio_visibility', 'create_studio')).toBe(true);
  });

  it('create_studio is denied for individual', () => {
    expect(tierAllows('individual', 'create_studio')).toBe(false);
  });

  it('manage_memberships is denied for studio_visibility', () => {
    expect(tierAllows('studio_visibility', 'manage_memberships')).toBe(false);
  });

  it('drop_in is allowed for studio_visibility', () => {
    expect(tierAllows('studio_visibility', 'drop_in')).toBe(true);
  });

  it('attendance is denied for studio_visibility', () => {
    expect(tierAllows('studio_visibility', 'attendance')).toBe(false);
  });

  it('attendance is allowed for studio_suite', () => {
    expect(tierAllows('studio_suite', 'attendance')).toBe(true);
  });
});
