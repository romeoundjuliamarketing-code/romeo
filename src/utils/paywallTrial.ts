import i18n from '../i18n';

// Free trial on the paywall. iOS: the introductory offer, shown only when the
// App Store says this Apple ID may still use it (it is granted once per
// subscription group). Android: Play only returns offers the account may use,
// and RevenueCat buys `defaultOption` — so its free phase is exactly what the
// purchase will contain. Anything uncertain falls back to the normal CTA: a
// trial promise the store then does not honour would charge the user at once.

export type TrialUnit = 'day' | 'month' | 'year';

export interface TrialOffer {
  count: number;
  unit: TrialUnit;
  /** Price charged after the trial, formatted by the store. */
  priceAfter: string;
}

export type IntroEligibility = 'eligible' | 'ineligible' | 'unknown';

// Structural subset of react-native-purchases' PurchasesStoreProduct.
export interface TrialProduct {
  priceString: string;
  introPrice: { price: number; periodUnit: string; periodNumberOfUnits: number; cycles: number } | null;
  defaultOption: {
    freePhase: { billingPeriod: { unit: string; value: number } } | null;
    fullPricePhase: { price: { formatted: string } } | null;
  } | null;
}

/** Store period → what the CTA says. Weeks are shown as days ("7 Tage"). */
export function trialDuration(unit: string, value: number): { count: number; unit: TrialUnit } | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  switch (unit.toUpperCase()) {
    case 'DAY': return { count: value, unit: 'day' };
    case 'WEEK': return { count: value * 7, unit: 'day' };
    case 'MONTH': return { count: value, unit: 'month' };
    case 'YEAR': return { count: value, unit: 'year' };
    default: return null;
  }
}

export function freeTrialOffer(
  product: TrialProduct,
  platform: string,
  iosEligibility: IntroEligibility,
): TrialOffer | null {
  if (platform === 'android') {
    const phase = product.defaultOption?.freePhase ?? null;
    if (phase === null) return null;
    const duration = trialDuration(phase.billingPeriod.unit, phase.billingPeriod.value);
    const priceAfter = product.defaultOption?.fullPricePhase?.price.formatted ?? product.priceString;
    return duration !== null ? { ...duration, priceAfter } : null;
  }
  if (platform === 'ios') {
    const intro = product.introPrice;
    if (iosEligibility !== 'eligible' || intro === null || intro.price !== 0) return null;
    const duration = trialDuration(intro.periodUnit, intro.periodNumberOfUnits * Math.max(intro.cycles, 1));
    return duration !== null ? { ...duration, priceAfter: product.priceString } : null;
  }
  return null;
}

export function durationText(trial: TrialOffer): string {
  switch (trial.unit) {
    case 'day': return i18n.t('paywall.trial.day', { count: trial.count });
    case 'month': return i18n.t('paywall.trial.month', { count: trial.count });
    case 'year': return i18n.t('paywall.trial.year', { count: trial.count });
  }
}

export interface PaywallCta {
  label: string;
  /** Small line under the button: price after the trial (Apple requires it to be clearly visible). */
  note: string | null;
}

export function paywallCta(state: { premiumActive: boolean; price: string | undefined; trial: TrialOffer | null }): PaywallCta {
  if (state.premiumActive) return { label: i18n.t('paywall.cta.active'), note: null };
  if (state.price === undefined) return { label: i18n.t('paywall.cta.unavailable'), note: null };
  if (state.trial === null) return { label: i18n.t('paywall.cta.continue', { price: state.price }), note: null };
  return {
    label: i18n.t('paywall.cta.trial', { duration: durationText(state.trial) }),
    note: i18n.t('paywall.cta.trialNote', { price: state.trial.priceAfter }),
  };
}
