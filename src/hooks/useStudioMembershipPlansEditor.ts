import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import type { MembershipPlan, MembershipPlanInsert } from '../types/database.types';

export interface MembershipPlanValues {
  name:            string;
  priceCents:      number;
  billingInterval: 'monthly' | 'yearly';
  minTermMonths:   number;
  description:     string | null;
}

interface UseStudioMembershipPlansEditorResult {
  plans:          MembershipPlan[];
  loading:        boolean;
  saving:         boolean;
  refetch:        () => void;
  addPlan:        (values: MembershipPlanValues) => Promise<{ error: string | null }>;
  deactivatePlan: (id: string)                  => Promise<{ error: string | null }>;
}

// Staff: load all plans (incl. inactive) for a studio and manage them.
// Modeled after useStudioScheduleEditor.
export function useStudioMembershipPlansEditor(studioId: string): UseStudioMembershipPlansEditorResult {
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [trigger, setTrigger] = useState(0);

  const refetch = useCallback(() => setTrigger((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    void (async () => {
      const { data, error } = await supabase
        .from('studio_membership_plans')
        .select('*')
        .eq('studio_id', studioId)
        .order('created_at', { ascending: true });

      if (cancelled) return;

      if (error !== null) {
        reportNetworkError(error);
        setLoading(false);
        return;
      }

      reportNetworkSuccess();
      setPlans((data ?? []) as MembershipPlan[]);
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [studioId, trigger]);

  const addPlan = useCallback(
    async (values: MembershipPlanValues): Promise<{ error: string | null }> => {
      setSaving(true);
      const insert: MembershipPlanInsert = {
        studio_id:        studioId,
        name:             values.name,
        price_cents:      values.priceCents,
        billing_interval: values.billingInterval,
        min_term_months:  values.minTermMonths,
        description:      values.description,
        is_active:        true,
      };
      const { error } = await supabase.from('studio_membership_plans').insert(insert);
      setSaving(false);
      if (error !== null) {
        reportNetworkError(error);
        return { error: error.message };
      }
      reportNetworkSuccess();
      refetch();
      return { error: null };
    },
    [studioId, refetch],
  );

  const deactivatePlan = useCallback(
    async (id: string): Promise<{ error: string | null }> => {
      const { error } = await supabase
        .from('studio_membership_plans')
        .update({ is_active: false })
        .eq('id', id);
      if (error !== null) {
        reportNetworkError(error);
        return { error: error.message };
      }
      reportNetworkSuccess();
      refetch();
      return { error: null };
    },
    [refetch],
  );

  return { plans, loading, saving, refetch, addPlan, deactivatePlan };
}
