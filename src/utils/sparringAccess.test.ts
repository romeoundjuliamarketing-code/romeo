import { canJoinSparring } from './sparringAccess';

describe('canJoinSparring', () => {
  // Open sparrings (verifiedOnly = false) are joinable by all tiers
  it('allows unverified to join an open sparring', () => {
    expect(canJoinSparring(false, 'unverified')).toBe(true);
  });

  it('allows basic to join an open sparring', () => {
    expect(canJoinSparring(false, 'basic')).toBe(true);
  });

  it('allows verified to join an open sparring', () => {
    expect(canJoinSparring(false, 'verified')).toBe(true);
  });

  // Verified-only sparrings block non-verified users
  it('blocks unverified from joining a verified-only sparring', () => {
    expect(canJoinSparring(true, 'unverified')).toBe(false);
  });

  it('blocks basic from joining a verified-only sparring', () => {
    expect(canJoinSparring(true, 'basic')).toBe(false);
  });

  it('allows verified to join a verified-only sparring', () => {
    expect(canJoinSparring(true, 'verified')).toBe(true);
  });
});
