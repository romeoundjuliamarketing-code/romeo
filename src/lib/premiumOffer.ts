import { Platform } from 'react-native';
import Purchases, { INTRO_ELIGIBILITY_STATUS, PurchasesPackage } from 'react-native-purchases';
import { loginRevenueCat } from './revenuecat';
import { planForProduct, PREMIUM_PLAN } from '../utils/subscriptionPlans';
import { freeTrialOffer, IntroEligibility, TrialOffer } from '../utils/paywallTrial';

// Dev-only visual check: with EXPO_PUBLIC_PREVIEW_TRIAL_OFFER=1 the trial offer
// opens on every start with a sample trial; nothing is counted or bought.
export const PREVIEW_TRIAL_OFFER = __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_TRIAL_OFFER === '1';
export const PREVIEW_TRIAL: TrialOffer = { count: 7, unit: 'day', priceAfter: '7,99 €' };

export interface PremiumOffer {
  pkg: PurchasesPackage;
  /** null when the store offers this user no free trial. */
  trial: TrialOffer | null;
}

// Premium package plus the free trial the store grants this user (same checks
// as the paywall). null when the offering cannot be loaded.
export async function loadPremiumOffer(): Promise<PremiumOffer | null> {
  const offerings = await Purchases.getOfferings();
  const source = offerings.current ?? Object.values(offerings.all)[0];
  const pkg = (source?.availablePackages ?? []).find((p) => planForProduct(p.product.identifier) === PREMIUM_PLAN);
  if (pkg === undefined) return null;
  let eligibility: IntroEligibility = 'unknown';
  // iOS grants the intro offer once per Apple ID; Android filters offers itself.
  if (Platform.OS === 'ios') {
    try {
      const result = await Purchases.checkTrialOrIntroductoryPriceEligibility([pkg.product.identifier]);
      const status = result[pkg.product.identifier]?.status;
      eligibility = status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_ELIGIBLE ? 'eligible'
        : status === INTRO_ELIGIBILITY_STATUS.INTRO_ELIGIBILITY_STATUS_INELIGIBLE ? 'ineligible'
          : 'unknown';
    } catch {
      // Unknown eligibility: no trial promise.
    }
  }
  return { pkg, trial: freeTrialOffer(pkg.product, Platform.OS, eligibility) };
}

// Buys Premium for this account. Throws like Purchases.purchasePackage
// (check `userCancelled`). Only offered to users without any plan, so there
// is no legacy plan to replace here.
export async function purchasePremium(pkg: PurchasesPackage, userId: string): Promise<void> {
  // Never buy anonymously: the webhook could not attach it to this account.
  await loginRevenueCat(userId);
  await Purchases.purchasePackage(pkg);
}
