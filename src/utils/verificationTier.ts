export interface VerificationFlags {
  email_verified: boolean;
  address_verified: boolean;
  studio_verified: boolean;
  coach_vouched: boolean;
  phone_verified: boolean;
}

export type VerificationTier = 'unverified' | 'basic' | 'verified';

// Central tier rule (adjust here without touching the DB):
// basic    = email verified
// verified = basic AND at least one "real person" signal
//            (active studio membership OR coach vouch OR verified address)
export function computeVerificationTier(flags: VerificationFlags): VerificationTier {
  if (!flags.email_verified) return 'unverified';
  const realPerson =
    flags.studio_verified || flags.coach_vouched || flags.address_verified || flags.phone_verified;
  return realPerson ? 'verified' : 'basic';
}
