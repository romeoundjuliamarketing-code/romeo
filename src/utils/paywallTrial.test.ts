import i18n from '../i18n';
import { freeTrialOffer, paywallCta, trialDuration } from './paywallTrial';

const IOS_TRIAL = {
  priceString: '9,99 €',
  introPrice: { price: 0, periodUnit: 'WEEK', periodNumberOfUnits: 1, cycles: 1 },
  defaultOption: null,
};
const IOS_PAID_INTRO = { ...IOS_TRIAL, introPrice: { price: 1.99, periodUnit: 'MONTH', periodNumberOfUnits: 1, cycles: 1 } };
const IOS_NO_OFFER = { ...IOS_TRIAL, introPrice: null };

const ANDROID_TRIAL = {
  priceString: '9,99 €',
  introPrice: null,
  defaultOption: {
    freePhase: { billingPeriod: { unit: 'DAY', value: 7 } },
    fullPricePhase: { price: { formatted: '9,99 €' } },
  },
};
const ANDROID_BASE_PLAN = { ...ANDROID_TRIAL, defaultOption: { freePhase: null, fullPricePhase: { price: { formatted: '9,99 €' } } } };

beforeAll(async () => { await i18n.changeLanguage('de'); });

describe('trialDuration', () => {
  it('shows weeks as days', () => {
    expect(trialDuration('WEEK', 1)).toEqual({ count: 7, unit: 'day' });
    expect(trialDuration('DAY', 3)).toEqual({ count: 3, unit: 'day' });
    expect(trialDuration('MONTH', 1)).toEqual({ count: 1, unit: 'month' });
  });
  it('rejects unknown or empty periods', () => {
    expect(trialDuration('UNKNOWN', 1)).toBeNull();
    expect(trialDuration('DAY', 0)).toBeNull();
  });
});

describe('freeTrialOffer', () => {
  it('iOS: only for an eligible Apple ID with a free intro offer', () => {
    expect(freeTrialOffer(IOS_TRIAL, 'ios', 'eligible')).toEqual({ count: 7, unit: 'day', priceAfter: '9,99 €' });
    expect(freeTrialOffer(IOS_TRIAL, 'ios', 'ineligible')).toBeNull();
    expect(freeTrialOffer(IOS_TRIAL, 'ios', 'unknown')).toBeNull();
    expect(freeTrialOffer(IOS_PAID_INTRO, 'ios', 'eligible')).toBeNull();
    expect(freeTrialOffer(IOS_NO_OFFER, 'ios', 'eligible')).toBeNull();
  });
  it('Android: the free phase of the default option', () => {
    expect(freeTrialOffer(ANDROID_TRIAL, 'android', 'unknown')).toEqual({ count: 7, unit: 'day', priceAfter: '9,99 €' });
    expect(freeTrialOffer(ANDROID_BASE_PLAN, 'android', 'unknown')).toBeNull();
  });
});

describe('paywallCta', () => {
  it('eligible: trial CTA with the price after the trial', () => {
    const trial = freeTrialOffer(IOS_TRIAL, 'ios', 'eligible');
    expect(paywallCta({ premiumActive: false, price: '9,99 €', trial })).toEqual({
      label: '7 Tage gratis testen',
      note: 'Danach 9,99 € / Monat · jederzeit kündbar',
    });
  });
  it('not eligible (trial already used): today’s CTA', () => {
    const trial = freeTrialOffer(IOS_TRIAL, 'ios', 'ineligible');
    expect(paywallCta({ premiumActive: false, price: '9,99 €', trial })).toEqual({ label: 'Weiter – 9,99 € / Monat', note: null });
  });
  it('no offer in the store: today’s CTA', () => {
    const trial = freeTrialOffer(ANDROID_BASE_PLAN, 'android', 'unknown');
    expect(paywallCta({ premiumActive: false, price: '9,99 €', trial })).toEqual({ label: 'Weiter – 9,99 € / Monat', note: null });
  });
  it('active subscription and missing package win over a trial', () => {
    const trial = { count: 7, unit: 'day' as const, priceAfter: '9,99 €' };
    expect(paywallCta({ premiumActive: true, price: '9,99 €', trial }).label).toBe('Aktives Abo');
    expect(paywallCta({ premiumActive: false, price: undefined, trial }).label).toBe('Derzeit nicht verfügbar');
  });
  it('English', async () => {
    await i18n.changeLanguage('en');
    expect(paywallCta({ premiumActive: false, price: '€9.99', trial: { count: 7, unit: 'day', priceAfter: '€9.99' } })).toEqual({
      label: 'Try 7 days free',
      note: 'Then €9.99 / month · cancel anytime',
    });
    await i18n.changeLanguage('de');
  });
});
