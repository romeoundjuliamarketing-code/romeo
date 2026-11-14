import i18n from '../i18n';

// Store subscription rules shared by paywall, settings and the sparring gate.
// Product matching mirrors supabase/functions/rc-boost-webhook/storeEntitlementEvents.ts —
// keep both in sync.

// Only 'bundle' (Sparr Premium Membership) is sold. 'creator' and 'cards' are
// legacy single plans that existing subscribers keep until they cancel.
export type PlanKey = 'creator' | 'cards' | 'bundle';
export const PREMIUM_PLAN: PlanKey = 'bundle';

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

export function activePlan(creator: boolean, cards: boolean): PlanKey | null {
  if (creator && cards) return 'bundle';
  if (creator) return 'creator';
  if (cards) return 'cards';
  return null;
}

export function planLabel(creator: boolean, cards: boolean): string {
  switch (activePlan(creator, cards)) {
    case 'bundle': return i18n.t('paywall.planLabel.premium');
    case 'creator': return i18n.t('paywall.planLabel.creator');
    case 'cards': return i18n.t('paywall.planLabel.cards');
    default: return i18n.t('paywall.planLabel.none');
  }
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

// Google Play has no subscription groups: a plan change must name the product
// it replaces, otherwise the user ends up with two subscriptions.
export function replacedProductId(activeSubscriptions: string[]): string | null {
  return activeSubscriptions.find((id) => planForProduct(id) !== null) ?? null;
}

// Private sparring scheduled after the creator subscription runs out (auto-renew
// off): the server cancels it at that point, so the create flow warns first.
// Studio sparrings are free and never affected.
export function sparringOutlivesSubscription(scheduledAt: Date, subscriptionEndsAt: string | null, atStudio: boolean): boolean {
  if (atStudio || subscriptionEndsAt === null) return false;
  const endsAt = new Date(subscriptionEndsAt).getTime();
  return Number.isFinite(endsAt) && scheduledAt.getTime() > endsAt;
}
