import { useCallback, useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { loginRevenueCat } from '../lib/revenuecat';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

export type SubscriptionTier = 'individual' | 'studio';
export type EntitlementSource = 'direct' | 'studio';

export interface EntitlementState {
  hasAccess: boolean;
  tier: SubscriptionTier | null;
  source: EntitlementSource | null;
  canCreateStudio: boolean;
  includedSeats: number;
  usedSeats: number;
  extraSeats: number;
}

const DEFAULT_ENTITLEMENT: EntitlementState = {
  hasAccess: false,
  tier: null,
  source: null,
  canCreateStudio: false,
  includedSeats: 0,
  usedSeats: 0,
  extraSeats: 0,
};

const RC_ENTITLEMENT_ID = 'Sparr Pro';

export function useEntitlement(refetchTrigger = 0): {
  entitlement: EntitlementState;
  loading: boolean;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const [entitlement, setEntitlement] = useState<EntitlementState>(DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(true);

  const refetch = useCallback(async (): Promise<void> => {
    if (user === null) {
      setEntitlement(DEFAULT_ENTITLEMENT);
      setLoading(false);
      return;
    }

    setLoading(true);

    await loginRevenueCat(user.id);

    const [rcInfo, supaResult] = await Promise.all([
      Purchases.getCustomerInfo().catch(() => null),
      supabase.rpc('get_my_entitlement'),
    ]);

    const rcHasAccess =
      rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

    const { data, error } = supaResult;

    if (error !== null || data === null || data.length === 0) {
      if (error !== null) reportNetworkError(error);
      setEntitlement({ ...DEFAULT_ENTITLEMENT, hasAccess: rcHasAccess });
      setLoading(false);
      return;
    }
    reportNetworkSuccess();

    const row = data[0];
    const dbHasAccess: boolean = row.has_access;
    setEntitlement({
      hasAccess: rcHasAccess || dbHasAccess,
      tier: row.tier === 'individual' || row.tier === 'studio' ? row.tier : null,
      source: row.source === 'direct' || row.source === 'studio' ? row.source : null,
      canCreateStudio: row.can_create_studio,
      includedSeats: row.included_seats,
      usedSeats: row.used_seats,
      extraSeats: row.extra_seats,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    void refetch();
  }, [refetch, refetchTrigger]);

  return { entitlement, loading, refetch };
}
