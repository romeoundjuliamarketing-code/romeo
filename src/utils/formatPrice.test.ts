import { formatPrice, billingIntervalLabel } from './formatPrice';

describe('formatPrice', () => {
  it('formats a round euro amount correctly', () => {
    expect(formatPrice(2900)).toBe('29,00 €');
  });

  it('formats sub-cent remainders with padding', () => {
    expect(formatPrice(4999)).toBe('49,99 €');
  });

  it('formats zero cents as 0,00 €', () => {
    expect(formatPrice(0)).toBe('0,00 €');
  });

  it('formats amounts with single-digit cents padded', () => {
    expect(formatPrice(1005)).toBe('10,05 €');
  });

  it('formats large amounts', () => {
    expect(formatPrice(100000)).toBe('1000,00 €');
  });
});

describe('billingIntervalLabel', () => {
  it('returns monatlich for monthly', () => {
    expect(billingIntervalLabel('monthly' as const)).toBe('monatlich');
  });

  it('returns jährlich for yearly', () => {
    expect(billingIntervalLabel('yearly' as const)).toBe('jährlich');
  });
});
