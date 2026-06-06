import { computeVerificationTier } from './verificationTier';

const base = {
  email_verified: false,
  address_verified: false,
  studio_verified: false,
  coach_vouched: false,
  phone_verified: false,
};

describe('computeVerificationTier', () => {
  it('unverified when nothing is set', () => {
    expect(computeVerificationTier(base)).toBe('unverified');
  });

  it('basic when only email is verified', () => {
    expect(computeVerificationTier({ ...base, email_verified: true })).toBe('basic');
  });

  it('stays unverified without email even if studio is verified', () => {
    expect(computeVerificationTier({ ...base, studio_verified: true })).toBe('unverified');
  });

  it('verified when email + studio', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, studio_verified: true })).toBe('verified');
  });

  it('verified when email + coach vouch', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, coach_vouched: true })).toBe('verified');
  });

  it('verified when email + address', () => {
    expect(computeVerificationTier({ ...base, email_verified: true, address_verified: true })).toBe('verified');
  });
});
