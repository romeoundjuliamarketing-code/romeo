// Central entitlement tier rules.
// Adjust the feature map here without touching the DB.
//
// Tier hierarchy (superset order):
//   none < individual < studio_visibility < studio_suite
//
// studio_suite is a strict superset of studio_visibility:
//   every feature allowed for studio_visibility is also allowed for studio_suite,
//   PLUS the suite-only features (announce, manage_memberships, coach_system, attendance).

export type EntitlementTier = 'none' | 'individual' | 'studio_visibility' | 'studio_suite';

export type EntitlementFeature =
  | 'create_studio'
  | 'manage_studio'
  | 'map_visibility'
  | 'invite_members'
  | 'trial_bookings'
  | 'drop_in'
  | 'announce'
  | 'manage_memberships'
  | 'coach_system'
  | 'attendance';

// Features accessible from studio_visibility (and above).
const VISIBILITY_FEATURES: ReadonlySet<EntitlementFeature> = new Set([
  'create_studio',
  'manage_studio',
  'map_visibility',
  'invite_members',
  'trial_bookings',
  'drop_in',
]);

// Additional features only accessible from studio_suite.
const SUITE_ONLY_FEATURES: ReadonlySet<EntitlementFeature> = new Set([
  'announce',
  'manage_memberships',
  'coach_system',
  'attendance',
]);

export function tierAllows(tier: EntitlementTier, feature: EntitlementFeature): boolean {
  switch (tier) {
    case 'studio_suite':
      return VISIBILITY_FEATURES.has(feature) || SUITE_ONLY_FEATURES.has(feature);
    case 'studio_visibility':
      return VISIBILITY_FEATURES.has(feature);
    case 'individual':
    case 'none':
      return false;
  }
}
