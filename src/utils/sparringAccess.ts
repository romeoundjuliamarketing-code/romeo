import { VerificationTier } from './verificationTier';

// Whether a user with the given tier may join a sparring.
// Open sparrings (verifiedOnly = false) are joinable by anyone; verified-only
// sparrings require the 'verified' tier.
export function canJoinSparring(verifiedOnly: boolean, tier: VerificationTier): boolean {
  if (!verifiedOnly) return true;
  return tier === 'verified';
}
