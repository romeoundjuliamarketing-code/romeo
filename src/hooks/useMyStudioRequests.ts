import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { getCached, setCached } from '../lib/queryCache';
import type { TrialBookingWithStudio, MembershipContractWithStudio, StudioJoinRequestWithStudio } from '../types/database.types';

type MyStudioRequestsSnapshot = {
  trialBookings: TrialBookingWithStudio[];
  contracts: MembershipContractWithStudio[];
  joinRequests: StudioJoinRequestWithStudio[];
};

interface UseMyStudioRequestsResult {
  trialBookings: TrialBookingWithStudio[];
  contracts:     MembershipContractWithStudio[];
  joinRequests:  StudioJoinRequestWithStudio[];
  loading: boolean;
  refetch: () => void;
  cancelTrial: (id: string) => Promise<{ error: string | null }>;
  cancelJoinRequest: (id: string) => Promise<{ error: string | null }>;
}

// Loads the current user's own trial_bookings and membership contracts, each
// joined with studio name/city. Designed to be extensible: add more request
// types in future phases as additional fields.
export function useMyStudioRequests(refetchTrigger = 0): UseMyStudioRequestsResult {
  const { user } = useAuth();
  const cacheKey = user ? `useMyStudioRequests:${user.id}` : null;
  const cached = cacheKey ? getCached<MyStudioRequestsSnapshot>(cacheKey) : undefined;
  const [trialBookings, setTrialBookings] = useState<TrialBookingWithStudio[]>(() => cached?.trialBookings ?? []);
  const [contracts, setContracts] = useState<MembershipContractWithStudio[]>(() => cached?.contracts ?? []);
  const [joinRequests, setJoinRequests] = useState<StudioJoinRequestWithStudio[]>(() => cached?.joinRequests ?? []);
  const [loading, setLoading] = useState(cached === undefined);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setTrialBookings([]);
      setContracts([]);
      setJoinRequests([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      // Fetch all in parallel to reduce latency
      const [trialResult, contractResult, joinResult] = await Promise.all([
        supabase
          .from('trial_bookings')
          .select('*, studios(name, city)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('studio_member_contracts')
          .select('*, studios(name, city)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('studio_join_requests')
          .select('*, studios(name, city)')
          .eq('user_id', user.id)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

      if (cancelled) return;

      if (trialResult.error !== null) {
        reportNetworkError(trialResult.error);
        setLoading(false);
        return;
      }

      if (contractResult.error !== null) {
        reportNetworkError(contractResult.error);
        setLoading(false);
        return;
      }

      if (joinResult.error !== null) {
        reportNetworkError(joinResult.error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();

      const trialRows: TrialBookingWithStudio[] = (trialResult.data ?? []).map((row) => {
        // Supabase returns the joined studio as a nested object
        const studio = row.studios as { name: string; city: string } | null;
        return {
          id:             row.id,
          user_id:        row.user_id,
          studio_id:      row.studio_id,
          schedule_id:    row.schedule_id,
          requested_date: row.requested_date,
          note:           row.note,
          status:         row.status,
          booking_type:   row.booking_type,
          created_at:     row.created_at,
          updated_at:     row.updated_at,
          responded_at:   row.responded_at,
          responded_by:   row.responded_by,
          studio_name:    studio?.name ?? '',
          studio_city:    studio?.city ?? '',
        };
      });

      const contractRows: MembershipContractWithStudio[] = (contractResult.data ?? []).map((row) => {
        const studio = row.studios as { name: string; city: string } | null;
        return {
          id:                        row.id,
          user_id:                   row.user_id,
          studio_id:                 row.studio_id,
          plan_id:                   row.plan_id,
          plan_name_snapshot:        row.plan_name_snapshot,
          price_cents_snapshot:      row.price_cents_snapshot,
          billing_interval_snapshot: row.billing_interval_snapshot,
          min_term_months_snapshot:  row.min_term_months_snapshot,
          status:                    row.status,
          signed_at:                 row.signed_at,
          start_date:                row.start_date,
          cancel_requested_at:       row.cancel_requested_at,
          ended_at:                  row.ended_at,
          created_at:                row.created_at,
          updated_at:                row.updated_at,
          responded_by:              row.responded_by,
          studio_name:               studio?.name ?? '',
          studio_city:               studio?.city ?? '',
        };
      });

      const joinRequestRows: StudioJoinRequestWithStudio[] = (joinResult.data ?? []).map((row) => {
        const studio = row.studios as { name: string; city: string } | null;
        return {
          id:           row.id,
          user_id:      row.user_id,
          studio_id:    row.studio_id,
          status:       row.status as 'pending' | 'approved' | 'rejected' | 'cancelled',
          created_at:   row.created_at,
          responded_at: row.responded_at,
          responded_by: row.responded_by,
          studio_name:  studio?.name ?? '',
          studio_city:  studio?.city ?? '',
        };
      });

      setTrialBookings(trialRows);
      setContracts(contractRows);
      setJoinRequests(joinRequestRows);
      if (cacheKey) setCached<MyStudioRequestsSnapshot>(cacheKey, { trialBookings: trialRows, contracts: contractRows, joinRequests: joinRequestRows });
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [user, refetchTrigger, localTrigger]);

  async function cancelTrial(id: string): Promise<{ error: string | null }> {
    // Only cancel own pending bookings; RLS prevents touching others
    const { error } = await supabase
      .from('trial_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user?.id ?? '')
      .eq('status', 'pending');

    if (error !== null) {
      return { error: error.message };
    }
    refetch();
    return { error: null };
  }

  async function cancelJoinRequest(id: string): Promise<{ error: string | null }> {
    // RLS policy allows cancelling own pending requests
    const { error } = await supabase
      .from('studio_join_requests')
      .update({ status: 'cancelled' })
      .eq('id', id)
      .eq('user_id', user?.id ?? '');

    if (error !== null) {
      return { error: error.message };
    }
    refetch();
    return { error: null };
  }

  return { trialBookings, contracts, joinRequests, loading, refetch, cancelTrial, cancelJoinRequest };
}
