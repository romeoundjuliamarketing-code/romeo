import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { TrialBookingWithStudio, MembershipContractWithStudio } from '../types/database.types';

interface UseMyStudioRequestsResult {
  trialBookings: TrialBookingWithStudio[];
  contracts:     MembershipContractWithStudio[];
  loading: boolean;
  refetch: () => void;
  cancelTrial: (id: string) => Promise<{ error: string | null }>;
}

// Loads the current user's own trial_bookings and membership contracts, each
// joined with studio name/city. Designed to be extensible: add more request
// types in future phases as additional fields.
export function useMyStudioRequests(refetchTrigger = 0): UseMyStudioRequestsResult {
  const { user } = useAuth();
  const [trialBookings, setTrialBookings] = useState<TrialBookingWithStudio[]>([]);
  const [contracts, setContracts] = useState<MembershipContractWithStudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger((n) => n + 1), []);

  useEffect(() => {
    if (user === null) {
      setTrialBookings([]);
      setContracts([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void (async () => {
      // Fetch both in parallel to reduce latency
      const [trialResult, contractResult] = await Promise.all([
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

      setTrialBookings(trialRows);
      setContracts(contractRows);
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

  return { trialBookings, contracts, loading, refetch, cancelTrial };
}
