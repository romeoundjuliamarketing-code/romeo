import { useCallback, useEffect, useState } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';
import { loginRevenueCat } from '../lib/revenuecat';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import { type EntitlementTier } from '../utils/entitlementTier';

// Re-export so callers that imported SubscriptionTier from here still compile.
export type { EntitlementTier };
// Legacy alias kept for backwards compat; prefer EntitlementTier.
export type SubscriptionTier = EntitlementTier;
export type EntitlementSource = 'direct' | 'studio';

export interface EntitlementState {
  hasAccess: boolean;
  tier: EntitlementTier | null;
  source: EntitlementSource | null;
  canCreateStudio: boolean;
  canManageStudio: boolean;
  canAnnounce: boolean;
  canManageMemberships: boolean;
  includedSeats: number;
  usedSeats: number;
  extraSeats: number;
}

const DEFAULT_ENTITLEMENT: EntitlementState = {
  hasAccess: false,
  tier: null,
  source: null,
  canCreateStudio: true,
  canManageStudio: false,
  canAnnounce: false,
  canManageMemberships: false,
  includedSeats: 0,
  usedSeats: 0,
  extraSeats: 0,
};

type EntitlementSnapshot = { entitlement: EntitlementState };

const RC_ENTITLEMENT_ID = 'Sparr Pro';

export function useEntitlement(refetchTrigger = 0): {
  entitlement: EntitlementState;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<void>;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const cacheKey = userId === null ? null : `useEntitlement:${userId}`;
  const cached = cacheKey ? getCached<EntitlementSnapshot>(cacheKey) : undefined;
  const [entitlement, setEntitlement] = useState<EntitlementState>(() => cached?.entitlement ?? DEFAULT_ENTITLEMENT);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);

  const refetch = useCallback(async (): Promise<void> => {
    if (userId === null) {
      setEntitlement(DEFAULT_ENTITLEMENT);
      setError(false);
      setResolvedUserId(null);
      setLoading(false);
      return;
    }

    await loginRevenueCat(userId).catch(() => undefined);

    const [rcInfo, supaResult] = await Promise.all([
      Purchases.getCustomerInfo().catch(() => null),
      supabase.rpc('get_my_entitlement'),
    ]);

    const rcHasAccess =
      rcInfo !== null && rcInfo.entitlements.active[RC_ENTITLEMENT_ID] !== undefined;

    const { data, error } = supaResult;

    if (error !== null || data === null || data.length === 0) {
      if (error !== null) reportNetworkError(error);
      setError(!rcHasAccess);
      if (rcHasAccess) setEntitlement({ ...DEFAULT_ENTITLEMENT, hasAccess: true });
      setResolvedUserId(userId);
      setLoading(false);
      return;
    }
    reportNetworkSuccess();

    const row = data[0];
    const dbHasAccess: boolean = row.has_access;

    // Parse tier — accept the three new strings, fall back to null for unknowns.
    const validTiers: ReadonlyArray<EntitlementTier> = [
      'individual',
      'studio_visibility',
      'studio_suite',
    ];
    const parsedTier: EntitlementTier | null =
      validTiers.includes(row.tier as EntitlementTier) ? (row.tier as EntitlementTier) : null;

    const newEntitlement: EntitlementState = {
      hasAccess: rcHasAccess || dbHasAccess,
      tier: parsedTier,
      source: row.source === 'direct' || row.source === 'studio' ? row.source : null,
      canCreateStudio: row.can_create_studio,
      canManageStudio: row.can_manage_studio,
      canAnnounce: row.can_announce,
      canManageMemberships: row.can_manage_memberships,
      includedSeats: row.included_seats,
      usedSeats: row.used_seats,
      extraSeats: row.extra_seats,
    };
    setEntitlement(newEntitlement);
    setError(false);
    setResolvedUserId(userId);
    if (cacheKey) setCached<EntitlementSnapshot>(cacheKey, { entitlement: newEntitlement });
    setLoading(false);
  }, [userId, cacheKey]);

  useEffect(() => {
    void refetch();
  }, [refetch, refetchTrigger]);

  return {
    entitlement: resolvedUserId === userId ? entitlement : DEFAULT_ENTITLEMENT,
    loading: loading || resolvedUserId !== userId,
    error,
    refetch,
  };
}
