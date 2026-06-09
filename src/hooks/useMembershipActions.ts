import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

interface UseMembershipActionsResult {
  loading:             boolean;
  signMembership:      (planId: string)                    => Promise<{ id: string | null; error: string | null }>;
  requestCancellation: (contractId: string)                => Promise<{ error: string | null }>;
  respondMembership:   (contractId: string, confirm: boolean) => Promise<{ error: string | null }>;
  confirmEnd:          (contractId: string)                => Promise<{ error: string | null }>;
}

// Wraps all membership RPC calls with loading state and error handling.
export function useMembershipActions(): UseMembershipActionsResult {
  const [loading, setLoading] = useState(false);

  async function signMembership(planId: string): Promise<{ id: string | null; error: string | null }> {
    setLoading(true);
    const { data, error } = await supabase.rpc('sign_membership', { p_plan_id: planId });
    setLoading(false);
    if (error !== null) {
      reportNetworkError(error);
      return { id: null, error: error.message };
    }
    reportNetworkSuccess();
    return { id: data as string, error: null };
  }

  async function requestCancellation(contractId: string): Promise<{ error: string | null }> {
    setLoading(true);
    const { error } = await supabase.rpc('request_membership_cancellation', {
      p_contract_id: contractId,
    });
    setLoading(false);
    if (error !== null) {
      reportNetworkError(error);
      return { error: error.message };
    }
    reportNetworkSuccess();
    return { error: null };
  }

  async function respondMembership(
    contractId: string,
    confirm: boolean,
  ): Promise<{ error: string | null }> {
    setLoading(true);
    const { error } = await supabase.rpc('respond_membership_request', {
      p_id:      contractId,
      p_confirm: confirm,
    });
    setLoading(false);
    if (error !== null) {
      reportNetworkError(error);
      return { error: error.message };
    }
    reportNetworkSuccess();
    return { error: null };
  }

  async function confirmEnd(contractId: string): Promise<{ error: string | null }> {
    setLoading(true);
    const { error } = await supabase.rpc('confirm_membership_end', {
      p_contract_id: contractId,
    });
    setLoading(false);
    if (error !== null) {
      reportNetworkError(error);
      return { error: error.message };
    }
    reportNetworkSuccess();
    return { error: null };
  }

  return { loading, signMembership, requestCancellation, respondMembership, confirmEnd };
}
