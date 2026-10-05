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
  return focus === 'cards' ? ['cards', 'bundle', 'creator'] : ['creator', 'bundle', 'cards'];
}

export function activePlan(creator: boolean, cards: boolean): PlanKey | null {
  if (creator && cards) return 'bundle';
  if (creator) return 'creator';
  if (cards) return 'cards';
  return null;
}

export function planLabel(creator: boolean, cards: boolean): string {
  switch (activePlan(creator, cards)) {
    case 'bundle': return 'Ersteller + Karten';
    case 'creator': return 'Ersteller';
    case 'cards': return 'Karten';
    default: return 'Kein aktives Abo';
  }
}

export function bundleSavings(creator: number | null, cards: number | null, bundle: number | null): number | null {
  if (creator === null || cards === null || bundle === null) return null;
  const saving = Math.round((creator + cards - bundle) * 100) / 100;
  return saving > 0 ? saving : null;
}

export function formatSavings(amount: number, currencyCode: string): string {
  return new Intl.NumberFormat('de-DE', { style: 'currency', currency: currencyCode }).format(amount);
}

// Postgres "insufficient_privilege" on a private insert means the RLS check
// can_create_sparring() failed — i.e. no creator subscription on the server.
export function sparringInsertErrorCode(
  pgCode: string | undefined,
  studioId: string | null,
): 'subscription_required' | null {
  return pgCode === '42501' && studioId === null ? 'subscription_required' : null;
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

const PLAN_NAME: Record<PlanKey, string> = {
  creator: 'Ersteller-Abo',
  cards: 'Karten-Abo',
  bundle: 'Paket',
};

// All plans share one store subscription group, so buying another plan
// replaces the current one. Warn whenever that loses something.
export function planSwitchNotice(current: PlanKey | null, target: PlanKey): string | null {
  if (current === null || current === target || target === 'bundle') return null;
  if (current === 'bundle') {
    const lost = target === 'cards' ? 'Sparrings erstellen ist' : 'Das Kartenspiel ist';
    return `Das ${PLAN_NAME[target]} ersetzt dein Paket. ${lost} dann nicht mehr enthalten.`;
  }
  return `Das ${PLAN_NAME[target]} ersetzt dein ${PLAN_NAME[current]}. Für beides nimm das Paket.`;
}

// Google Play has no subscription groups: a plan change must name the product
// it replaces, otherwise the user ends up with two subscriptions.
export function replacedProductId(activeSubscriptions: string[]): string | null {
  return activeSubscriptions.find((id) => planForProduct(id) !== null) ?? null;
}
