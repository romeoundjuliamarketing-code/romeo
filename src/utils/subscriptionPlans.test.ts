import {
  activePlan, creatorGateAllows, planForProduct, planLabel, replacedProductId, subscriptionRejection,
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

describe('activePlan / planLabel', () => {
  it('derives the plan from the two entitlements', () => {
    expect(activePlan(true, true)).toBe('bundle');
    expect(activePlan(true, false)).toBe('creator');
    expect(activePlan(false, true)).toBe('cards');
    expect(activePlan(false, false)).toBeNull();
  });
  it('labels in German', () => {
    expect(planLabel(true, true)).toBe('Sparr Premium');
    expect(planLabel(true, false)).toBe('Ersteller (altes Abo)');
    expect(planLabel(false, true)).toBe('Karten (altes Abo)');
    expect(planLabel(false, false)).toBe('Kein aktives Abo');
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

describe('replacedProductId', () => {
  it('finds the active plan product to switch away from', () => {
    expect(replacedProductId(['com.deinebundle.sparr.mapbadge_30d', 'sparr_creator_monthly:monthly'])).toBe('sparr_creator_monthly:monthly');
  });
  it('is null without an active plan', () => {
    expect(replacedProductId([])).toBeNull();
    expect(replacedProductId(['com.deinebundle.sparr.mapbadge_30d'])).toBeNull();
  });
});
