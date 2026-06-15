import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { TrialBookingWithUser, MembershipContractWithUser, StudioJoinRequestWithUser } from '../types/database.types';

interface UseStudioRequestsResult {
  trialBookings:        TrialBookingWithUser[];         // booking_type = 'trial', status = 'pending'
  dropInBookings:       TrialBookingWithUser[];         // booking_type = 'drop_in', status = 'pending'
  membershipRequests:   MembershipContractWithUser[];   // status = 'pending'
  cancellationRequests: MembershipContractWithUser[];   // status = 'cancellation_requested'
  joinRequests:         StudioJoinRequestWithUser[];    // status = 'pending'
  loading:     boolean;
  refetch:     () => void;
  respondTrial: (id: string, confirm: boolean) => Promise<{ error: string | null }>;
  respondJoin:  (id: string, approve: boolean) => Promise<{ error: string | null }>;
}

// Loads pending trial_bookings and open membership contracts for a studio (staff view).
// Profile names are joined via a two-step query (same pattern as the original).
export function useStudioRequests(studioId: string): UseStudioRequestsResult {
  const [trialBookings, setTrialBookings] = useState<TrialBookingWithUser[]>([]);
  const [dropInBookings, setDropInBookings] = useState<TrialBookingWithUser[]>([]);
  const [membershipRequests, setMembershipRequests] = useState<MembershipContractWithUser[]>([]);
  const [cancellationRequests, setCancellationRequests] = useState<MembershipContractWithUser[]>([]);
  const [joinRequests, setJoinRequests] = useState<StudioJoinRequestWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      // Fetch all sources in parallel
      const [trialResult, contractResult, joinResult] = await Promise.all([
        supabase
          .from('trial_bookings')
          .select('*')
          .eq('studio_id', studioId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
        supabase
          .from('studio_member_contracts')
          .select('*')
          .eq('studio_id', studioId)
          .in('status', ['pending', 'cancellation_requested'])
          .order('created_at', { ascending: true }),
        supabase
          .from('studio_join_requests')
          .select('*')
          .eq('studio_id', studioId)
          .eq('status', 'pending')
          .order('created_at', { ascending: true }),
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

      const bookings      = trialResult.data ?? [];
      const contracts     = contractResult.data ?? [];
      const joinRows      = joinResult.data ?? [];

      // Collect all unique user IDs from all sources for a single profiles fetch
      const allUserIds = [
        ...new Set([
          ...bookings.map((b) => b.user_id),
          ...contracts.map((c) => c.user_id),
          ...joinRows.map((j) => j.user_id),
        ]),
      ];

      const nameMap: Record<string, string | null> = {};
      if (allUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', allUserIds);
        for (const p of profiles ?? []) {
          nameMap[p.id] = p.name;
        }
      }

      const allRows: TrialBookingWithUser[] = bookings.map((row) => ({
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
        user_name:      nameMap[row.user_id] ?? null,
      }));

      const contractRows: MembershipContractWithUser[] = contracts.map((row) => ({
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
        user_name:                 nameMap[row.user_id] ?? null,
      }));

      const joinRequestRows: StudioJoinRequestWithUser[] = joinRows.map((row) => ({
        id:           row.id,
        user_id:      row.user_id,
        studio_id:    row.studio_id,
        status:       row.status as 'pending' | 'approved' | 'rejected' | 'cancelled',
        created_at:   row.created_at,
        responded_at: row.responded_at,
        responded_by: row.responded_by,
        user_name:    nameMap[row.user_id] ?? null,
      }));

      setTrialBookings(allRows.filter((r) => r.booking_type === 'trial'));
      setDropInBookings(allRows.filter((r) => r.booking_type === 'drop_in'));
      setMembershipRequests(contractRows.filter((c) => c.status === 'pending'));
      setCancellationRequests(contractRows.filter((c) => c.status === 'cancellation_requested'));
      setJoinRequests(joinRequestRows);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger]);

  async function respondTrial(id: string, confirm: boolean): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('respond_trial_booking', {
      p_id:      id,
      p_confirm: confirm,
    });

    if (error !== null) {
      return { error: error.message };
    }
    refetch();
    return { error: null };
  }

  async function respondJoin(id: string, approve: boolean): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('respond_studio_join', {
      p_id:      id,
      p_approve: approve,
    });

    if (error !== null) {
      return { error: error.message };
    }
    refetch();
    return { error: null };
  }

  return {
    trialBookings,
    dropInBookings,
    membershipRequests,
    cancellationRequests,
    joinRequests,
    loading,
    refetch,
    respondTrial,
    respondJoin,
  };
}
