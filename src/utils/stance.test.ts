import { STANCES, stanceLabel } from './stance';

describe('stanceLabel', () => {
  it('maps each stance to its fighting-stance label', () => {
    expect(stanceLabel('orthodox')).toBe('Orthodox');
    expect(stanceLabel('southpaw')).toBe('Southpaw');
    expect(stanceLabel('switch')).toBe('Switch');
  });

  it('returns null for unset stance', () => {
    expect(stanceLabel(null)).toBeNull();
    expect(stanceLabel(undefined)).toBeNull();
  });

  it('exposes all three stances as options', () => {
    expect(STANCES).toEqual(['orthodox', 'southpaw', 'switch']);
  });
});
