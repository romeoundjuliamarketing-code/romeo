import {
  activePlan, bundleSavings, creatorGateAllows, formatSavings, orderPlans, planForProduct, planLabel,
  planSwitchNotice, replacedProductId, sparringInsertErrorCode, subscriptionRejection,
} from './subscriptionPlans';

describe('planForProduct', () => {
  it('maps plain store ids', () => {
    expect(planForProduct('sparr_creator_monthly')).toBe('creator');
    expect(planForProduct('sparr_individual_monthly')).toBe('cards');
    expect(planForProduct('sparr_bundle_monthly')).toBe('bundle');
  });
  it('ignores reverse-DNS prefixes and Play base plans', () => {
    expect(planForProduct('com.deinebundle.sparr.sparr_individual_monthly')).toBe('cards');
    expect(planForProduct('sparr_cards_monthly:monthly')).toBe('cards');
    expect(planForProduct('sparr_creator_monthly:monthly')).toBe('creator');
  });
  it('does not treat the app bundle prefix as the bundle plan', () => {
    expect(planForProduct('com.deinebundle.sparr.mapbadge_30d')).toBeNull();
    expect(planForProduct('com.deinebundle.sparr.event_create')).toBeNull();
  });
  it('drops retired plans', () => {
    expect(planForProduct('sparr_individual_yearly')).toBeNull();
    expect(planForProduct('sparr_studio_monthly')).toBeNull();
  });
});

describe('orderPlans', () => {
  it('puts the focused plan first and the bundle second', () => {
    expect(orderPlans('cards')).toEqual(['cards', 'bundle', 'creator']);
    expect(orderPlans('creator')).toEqual(['creator', 'bundle', 'cards']);
    expect(orderPlans(undefined)).toEqual(['creator', 'bundle', 'cards']);
  });
});

describe('activePlan / planLabel', () => {
  it('derives the plan from the two entitlements', () => {
    expect(activePlan(true, true)).toBe('bundle');
    expect(activePlan(true, false)).toBe('creator');
    expect(activePlan(false, true)).toBe('cards');
    expect(activePlan(false, false)).toBeNull();
  });
  it('labels in German', () => {
    expect(planLabel(true, true)).toBe('Ersteller + Karten');
    expect(planLabel(true, false)).toBe('Ersteller');
    expect(planLabel(false, true)).toBe('Karten');
    expect(planLabel(false, false)).toBe('Kein aktives Abo');
  });
});

describe('bundleSavings / formatSavings', () => {
  it('computes the saving from live prices', () => {
    expect(bundleSavings(3.99, 2.99, 5.99)).toBe(0.99);
  });
  it('is null when a price is missing or there is no saving', () => {
    expect(bundleSavings(null, 2.99, 5.99)).toBeNull();
    expect(bundleSavings(3.99, 2.99, null)).toBeNull();
    expect(bundleSavings(2.99, 2.99, 5.99)).toBeNull();
  });
  it('formats as currency', () => {
    expect(formatSavings(0.99, 'EUR')).toMatch(/^0,99\s€$/);
  });
});

describe('sparringInsertErrorCode', () => {
  it('flags an RLS rejection of a private sparring', () => {
    expect(sparringInsertErrorCode('42501', null)).toBe('subscription_required');
  });
  it('does not blame the subscription for studio inserts or other errors', () => {
    expect(sparringInsertErrorCode('42501', 'studio-1')).toBeNull();
    expect(sparringInsertErrorCode('23505', null)).toBeNull();
    expect(sparringInsertErrorCode(undefined, null)).toBeNull();
  });
});

describe('creatorGateAllows', () => {
  it('lets the server decide while entitlements are still loading', () => {
    expect(creatorGateAllows({ loading: true, canCreateSparring: false, inStudio: false })).toBe(true);
  });
  it('blocks only when loaded, not allowed and not in a studio', () => {
    expect(creatorGateAllows({ loading: false, canCreateSparring: false, inStudio: false })).toBe(false);
    expect(creatorGateAllows({ loading: false, canCreateSparring: true, inStudio: false })).toBe(true);
    expect(creatorGateAllows({ loading: false, canCreateSparring: false, inStudio: true })).toBe(true);
  });
});

describe('subscriptionRejection', () => {
  it('tells paying users to retry instead of buying again', () => {
    expect(subscriptionRejection(true)).toBe('activating');
    expect(subscriptionRejection(false)).toBe('purchase');
  });
});

describe('planSwitchNotice', () => {
  it('warns when a single plan would replace the other one', () => {
    expect(planSwitchNotice('creator', 'cards')).toBe('Das Karten-Abo ersetzt dein Ersteller-Abo. Für beides nimm das Paket.');
    expect(planSwitchNotice('cards', 'creator')).toBe('Das Ersteller-Abo ersetzt dein Karten-Abo. Für beides nimm das Paket.');
  });
  it('warns when leaving the bundle', () => {
    expect(planSwitchNotice('bundle', 'cards')).toBe('Das Karten-Abo ersetzt dein Paket. Sparrings erstellen ist dann nicht mehr enthalten.');
    expect(planSwitchNotice('bundle', 'creator')).toBe('Das Ersteller-Abo ersetzt dein Paket. Das Kartenspiel ist dann nicht mehr enthalten.');
  });
  it('stays silent for new subscriptions and upgrades to the bundle', () => {
    expect(planSwitchNotice(null, 'creator')).toBeNull();
    expect(planSwitchNotice('cards', 'bundle')).toBeNull();
    expect(planSwitchNotice('creator', 'bundle')).toBeNull();
  });
});

describe('replacedProductId', () => {
  it('finds the active plan product to switch away from', () => {
    expect(replacedProductId(['com.deinebundle.sparr.mapbadge_30d', 'sparr_creator_monthly:monthly'])).toBe('sparr_creator_monthly:monthly');
  });
  it('is null without an active plan', () => {
    expect(replacedProductId([])).toBeNull();
    expect(replacedProductId(['com.deinebundle.sparr.mapbadge_30d'])).toBeNull();
  });
});
