import { useCallback, useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { loginRevenueCat } from '../lib/revenuecat';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import { RC_ENTITLEMENT_CARDS, RC_ENTITLEMENT_CREATOR } from '../utils/subscriptionPlans';

export interface StoreEntitlements {
  canCreateSparring: boolean;
  creatorActive: boolean;
  cardsActive: boolean;
}

const NONE: StoreEntitlements = { canCreateSparring: false, creatorActive: false, cardsActive: false };

// RevenueCat is right immediately after a purchase; the server knows the
// switch and what the webhook recorded. Either one granting is enough here —
// the insert policy has the final say.
export function useStoreEntitlements(refetchTrigger = 0): {
  entitlements: StoreEntitlements;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cacheKey = userId === null ? null : `useStoreEntitlements:${userId}`;
  const cached = cacheKey ? getCached<StoreEntitlements>(cacheKey) : undefined;
  const [entitlements, setEntitlements] = useState<StoreEntitlements>(() => cached ?? NONE);
  const [loading, setLoading] = useState(cached === undefined);

  const refetch = useCallback(async (): Promise<void> => {
    if (userId === null) {
      setEntitlements(NONE);
      setLoading(false);
      return;
    }
    await loginRevenueCat(userId).catch(() => undefined);
    const [rcInfo, dbResult] = await Promise.all([
      Purchases.getCustomerInfo().catch(() => null),
      supabase.rpc('get_my_store_entitlements'),
    ]);
    const rcCreator = rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_CREATOR] !== undefined;
    const rcCards = rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_CARDS] !== undefined;

    if (dbResult.error !== null) reportNetworkError(dbResult.error);
    else reportNetworkSuccess();
    const row = dbResult.data?.[0];

    const next: StoreEntitlements = {
      // Unknown server state: let the insert policy decide instead of blocking.
      canCreateSparring: rcCreator || (row !== undefined ? row.can_create_sparring : true),
      creatorActive: rcCreator || row?.creator_active === true,
      cardsActive: rcCards || row?.cards_active === true,
    };
    setEntitlements(next);
    if (cacheKey && row !== undefined) setCached<StoreEntitlements>(cacheKey, next);
    setLoading(false);
  }, [userId, cacheKey]);

  useEffect(() => {
    void refetch();
  }, [refetch, refetchTrigger]);

  return { entitlements, loading, refetch };
}
