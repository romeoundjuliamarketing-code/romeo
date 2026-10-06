import Purchases from 'react-native-purchases';
import { RC_ENTITLEMENT_CARDS, RC_ENTITLEMENT_CREATOR } from '../utils/subscriptionPlans';

/** Restores store purchases for the signed-in account. Throws when the store call fails. */
export async function restorePurchases(): Promise<'restored' | 'none'> {
  const info = await Purchases.restorePurchases();
  const restored =
    info.entitlements.active[RC_ENTITLEMENT_CARDS] !== undefined ||
    info.entitlements.active[RC_ENTITLEMENT_CREATOR] !== undefined;
  return restored ? 'restored' : 'none';
}
