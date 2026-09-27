import { getInitials } from './initials';

describe('getInitials', () => {
  it('takes the first letters of up to two words', () => {
    expect(getInitials('romeo georgiadis')).toBe('RG');
    expect(getInitials('Ali')).toBe('A');
    expect(getInitials('Jean Claude Van Damme')).toBe('JC');
  });
  it('falls back to "?" for empty names', () => {
    expect(getInitials(null)).toBe('?');
    expect(getInitials('   ')).toBe('?');
  });
});
