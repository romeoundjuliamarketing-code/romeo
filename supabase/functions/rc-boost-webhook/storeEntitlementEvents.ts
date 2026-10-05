// Pure mapping from RevenueCat subscription events to store entitlements.
// No Deno imports so Jest can test it (src/utils/storeEntitlementEvents.test.ts).
// Product matching mirrors src/utils/subscriptionPlans.ts — keep both in sync.

export type StoreEntitlement = 'creator' | 'cards';

export interface RcSubscriptionEvent {
  type:              string;
  product_id:        string;
  new_product_id?:   string | null;
  expiration_at_ms?: number | null;
  cancel_reason?:    string | null;
  transferred_from?: string[] | null;
  transferred_to?:   string[] | null;
}

export type StoreEntitlementChange =
  | { kind: 'grant'; entitlements: StoreEntitlement[]; productId: string; expiresAt: string }
  | { kind: 'expire'; entitlements: StoreEntitlement[]; productId: string }
  | { kind: 'transfer'; fromUserIds: string[]; toUserId: string }
  | { kind: 'ignore' };

const ENTITLEMENTS_BY_KEY: Record<string, StoreEntitlement[]> = {
  sparr_bundle_monthly:     ['creator', 'cards'],
  sparr_creator_monthly:    ['creator'],
  sparr_individual_monthly: ['cards'],
  // Google Play cards subscription (created 2026-10-05 under its own id).
  sparr_cards_monthly:      ['cards'],
};

const GRANT_TYPES = new Set(['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION', 'PRODUCT_CHANGE']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Last id segment without store prefix ("com.x.y.") or Play base plan (":monthly").
function productKey(productId: string): string {
  const segments = productId.split(':')[0].split('.');
  return segments[segments.length - 1].toLowerCase();
}

export function entitlementsForProduct(productId: string): StoreEntitlement[] {
  return ENTITLEMENTS_BY_KEY[productKey(productId)] ?? [];
}

export function isSupabaseUserId(id: string): boolean {
  return UUID_RE.test(id);
}

export function subscriptionChange(event: RcSubscriptionEvent): StoreEntitlementChange {
  // Restore on another account moves the purchase; the server rows must follow.
  if (event.type === 'TRANSFER') {
    const fromUserIds = (event.transferred_from ?? []).filter(isSupabaseUserId);
    const toUserId = (event.transferred_to ?? []).find(isSupabaseUserId);
    return fromUserIds.length > 0 && toUserId !== undefined
      ? { kind: 'transfer', fromUserIds, toUserId }
      : { kind: 'ignore' };
  }
  const isRefund = event.type === 'CANCELLATION' && event.cancel_reason === 'CUSTOMER_SUPPORT';
  if (event.type === 'EXPIRATION' || isRefund) {
    const entitlements = entitlementsForProduct(event.product_id);
    return entitlements.length > 0
      ? { kind: 'expire', entitlements, productId: event.product_id }
      : { kind: 'ignore' };
  }
  if (!GRANT_TYPES.has(event.type)) return { kind: 'ignore' };

  const productId = event.type === 'PRODUCT_CHANGE' && event.new_product_id
    ? event.new_product_id
    : event.product_id;
  const entitlements = entitlementsForProduct(productId);
  if (entitlements.length === 0 || event.expiration_at_ms === undefined || event.expiration_at_ms === null) {
    return { kind: 'ignore' };
  }
  return { kind: 'grant', entitlements, productId, expiresAt: new Date(event.expiration_at_ms).toISOString() };
}
