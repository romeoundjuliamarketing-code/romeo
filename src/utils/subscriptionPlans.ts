import i18n from '../i18n';
import { parseLanguage } from './language';

// Store subscription rules shared by paywall, settings and the sparring gate.
// Product matching mirrors supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts —
// keep both in sync.

export type PlanKey = 'creator' | 'cards' | 'bundle';
export type PlanFocus = 'creator' | 'cards';

export const RC_ENTITLEMENT_CARDS = 'Sparr Pro';
export const RC_ENTITLEMENT_CREATOR = 'Sparr Creator';

// Last id segment without store prefix ("com.x.y.") or Play base plan (":monthly").
function productKey(productId: string): string {
  const withoutBasePlan = productId.split(':')[0];
  const segments = withoutBasePlan.split('.');
  return segments[segments.length - 1].toLowerCase();
}

const PLAN_BY_KEY: Record<string, PlanKey> = {
  sparr_creator_monthly: 'creator',
  sparr_individual_monthly: 'cards',
  // Google Play cards subscription (created 2026-10-05 under its own id).
  sparr_cards_monthly: 'cards',
  sparr_bundle_monthly: 'bundle',
};

export function planForProduct(productId: string): PlanKey | null {
  return PLAN_BY_KEY[productKey(productId)] ?? null;
}

export function orderPlans(focus: PlanFocus | undefined): PlanKey[] {
  return focus === 'cards' ? ['bundle', 'cards', 'creator'] : ['bundle', 'creator', 'cards'];
}

// First purchasable plan in display order; an active bundle already covers everything.
export function defaultSelection(
  order: PlanKey[],
  isAvailable: (plan: PlanKey) => boolean,
  current: PlanKey | null,
): PlanKey | null {
  if (current === 'bundle') return null;
  return order.find((plan) => plan !== current && isAvailable(plan)) ?? null;
}

export function activePlan(creator: boolean, cards: boolean): PlanKey | null {
  if (creator && cards) return 'bundle';
  if (creator) return 'creator';
  if (cards) return 'cards';
  return null;
}

export function planLabel(creator: boolean, cards: boolean): string {
  switch (activePlan(creator, cards)) {
    case 'bundle': return i18n.t('paywall.planLabel.bundle');
    case 'creator': return i18n.t('paywall.planLabel.creator');
    case 'cards': return i18n.t('paywall.planLabel.cards');
    default: return i18n.t('paywall.planLabel.none');
  }
}

export function bundleSavings(creator: number | null, cards: number | null, bundle: number | null): number | null {
  if (creator === null || cards === null || bundle === null) return null;
  const saving = Math.round((creator + cards - bundle) * 100) / 100;
  return saving > 0 ? saving : null;
}

export function formatSavings(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat((parseLanguage(i18n.language) ?? 'de') === 'en' ? 'en-GB' : 'de-DE', { style: 'currency', currency: currencyCode }).format(amount);
}

// Until entitlements are loaded the client must not block: the insert policy
// decides. Members of a studio may open the sheet (studio sparrings are free).
export function creatorGateAllows(state: { loading: boolean; canCreateSparring: boolean; inStudio: boolean }): boolean {
  return state.loading || state.canCreateSparring || state.inStudio;
}

// Server rejected a private insert: a user RevenueCat already knows as creator
// is waiting for the webhook, everyone else needs to buy.
export function subscriptionRejection(creatorActive: boolean): 'activating' | 'purchase' {
  return creatorActive ? 'activating' : 'purchase';
}

// All plans share one store subscription group, so buying another plan
// replaces the current one. Warn whenever that loses something.
export function planSwitchNotice(current: PlanKey | null, target: PlanKey): string | null {
  if (current === null || current === target || target === 'bundle') return null;
  if (current === 'bundle') {
    const lost = target === 'cards' ? i18n.t('paywall.switchNotice.lostCreate') : i18n.t('paywall.switchNotice.lostCards');
    return i18n.t('paywall.switchNotice.fromBundle', { target: i18n.t(`paywall.planName.${target}`), lost });
  }
  return i18n.t('paywall.switchNotice.other', {
    target: i18n.t(`paywall.planName.${target}`),
    current: i18n.t(`paywall.planName.${current}`),
  });
}

// Google Play has no subscription groups: a plan change must name the product
// it replaces, otherwise the user ends up with two subscriptions.
export function replacedProductId(activeSubscriptions: string[]): string | null {
  return activeSubscriptions.find((id) => planForProduct(id) !== null) ?? null;
}
