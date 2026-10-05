import {
  entitlementsForProduct, isSupabaseUserId, subscriptionChange,
} from '../../supabase/functions/rc-boost-webhook/storeEntitlementEvents';

const EXP = Date.UTC(2026, 10, 1, 12, 0, 0);

describe('entitlementsForProduct', () => {
  it('maps the three plans', () => {
    expect(entitlementsForProduct('sparr_bundle_monthly')).toEqual(['creator', 'cards']);
    expect(entitlementsForProduct('sparr_creator_monthly')).toEqual(['creator']);
    expect(entitlementsForProduct('com.deinebundle.sparr.sparr_individual_monthly')).toEqual(['cards']);
    expect(entitlementsForProduct('sparr_cards_monthly:monthly')).toEqual(['cards']);
    expect(entitlementsForProduct('sparr_creator_monthly:monthly')).toEqual(['creator']);
  });
  it('ignores consumables and retired plans', () => {
    expect(entitlementsForProduct('com.deinebundle.sparr.mapbadge_30d')).toEqual([]);
    expect(entitlementsForProduct('sparr_studio_monthly')).toEqual([]);
  });
});

describe('subscriptionChange', () => {
  it('grants on purchase and renewal', () => {
    for (const type of ['INITIAL_PURCHASE', 'RENEWAL', 'UNCANCELLATION'] as const) {
      expect(subscriptionChange({ type, product_id: 'sparr_bundle_monthly', expiration_at_ms: EXP })).toEqual({
        kind: 'grant', entitlements: ['creator', 'cards'], productId: 'sparr_bundle_monthly', expiresAt: '2026-11-01T12:00:00.000Z',
      });
    }
  });
  it('grants the new product on a product change', () => {
    expect(subscriptionChange({
      type: 'PRODUCT_CHANGE', product_id: 'sparr_individual_monthly', new_product_id: 'sparr_bundle_monthly', expiration_at_ms: EXP,
    })).toEqual({
      kind: 'grant', entitlements: ['creator', 'cards'], productId: 'sparr_bundle_monthly', expiresAt: '2026-11-01T12:00:00.000Z',
    });
  });
  it('expires on expiration and on refunds', () => {
    expect(subscriptionChange({ type: 'EXPIRATION', product_id: 'sparr_creator_monthly' })).toEqual({
      kind: 'expire', entitlements: ['creator'], productId: 'sparr_creator_monthly',
    });
    expect(subscriptionChange({ type: 'CANCELLATION', product_id: 'sparr_creator_monthly', cancel_reason: 'CUSTOMER_SUPPORT' })).toEqual({
      kind: 'expire', entitlements: ['creator'], productId: 'sparr_creator_monthly',
    });
  });
  it('keeps access on a normal cancellation', () => {
    expect(subscriptionChange({ type: 'CANCELLATION', product_id: 'sparr_creator_monthly', cancel_reason: 'UNSUBSCRIBE' }))
      .toEqual({ kind: 'ignore' });
  });
  it('ignores consumables, unknown types and grants without expiry', () => {
    expect(subscriptionChange({ type: 'NON_RENEWING_PURCHASE', product_id: 'com.deinebundle.sparr.mapbadge_30d' })).toEqual({ kind: 'ignore' });
    expect(subscriptionChange({ type: 'BILLING_ISSUE', product_id: 'sparr_creator_monthly', expiration_at_ms: EXP })).toEqual({ kind: 'ignore' });
    expect(subscriptionChange({ type: 'RENEWAL', product_id: 'sparr_creator_monthly', expiration_at_ms: null })).toEqual({ kind: 'ignore' });
  });
});

describe('isSupabaseUserId', () => {
  it('accepts uuids only', () => {
    expect(isSupabaseUserId('0b9f7c1e-4a3d-4c2b-9d8e-1f2a3b4c5d6e')).toBe(true);
    expect(isSupabaseUserId('$RCAnonymousID:abc123')).toBe(false);
    expect(isSupabaseUserId('')).toBe(false);
  });
});

describe('subscriptionChange TRANSFER', () => {
  it('moves entitlements from the old uuid users to the new one', () => {
    expect(subscriptionChange({
      type: 'TRANSFER', product_id: '',
      transferred_from: ['0b9f7c1e-4a3d-4c2b-9d8e-1f2a3b4c5d6e', '$RCAnonymousID:abc'],
      transferred_to: ['1c0a8d2f-5b4e-4d3c-8e9f-2a3b4c5d6e7f'],
    })).toEqual({
      kind: 'transfer',
      fromUserIds: ['0b9f7c1e-4a3d-4c2b-9d8e-1f2a3b4c5d6e'],
      toUserId: '1c0a8d2f-5b4e-4d3c-8e9f-2a3b4c5d6e7f',
    });
  });
  it('ignores transfers without a uuid on either side', () => {
    expect(subscriptionChange({
      type: 'TRANSFER', product_id: '', transferred_from: ['$RCAnonymousID:abc'], transferred_to: ['1c0a8d2f-5b4e-4d3c-8e9f-2a3b4c5d6e7f'],
    })).toEqual({ kind: 'ignore' });
    expect(subscriptionChange({
      type: 'TRANSFER', product_id: '', transferred_from: ['0b9f7c1e-4a3d-4c2b-9d8e-1f2a3b4c5d6e'], transferred_to: ['$RCAnonymousID:x'],
    })).toEqual({ kind: 'ignore' });
  });
});
