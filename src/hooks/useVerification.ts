import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';
import { computeVerificationTier, type VerificationFlags, type VerificationTier } from '../utils/verificationTier';

const EMPTY_FLAGS: VerificationFlags = {
  email_verified: false,
  address_verified: false,
  studio_verified: false,
  coach_vouched: false,
  phone_verified: false,
};

export function useVerification(refetchTrigger = 0): {
  flags: VerificationFlags;
  tier: VerificationTier;
  loading: boolean;
  refetch: () => void;
  updateAddress: (address: string) => Promise<{ error: string | null }>;
  updatePhone: (phone: string) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();
  const [flags, setFlags] = useState<VerificationFlags>(EMPTY_FLAGS);
  const [loading, setLoading] = useState(true);
  const [localTrigger, setLocalTrigger] = useState(0);

  const refetch = useCallback(() => setLocalTrigger(v => v + 1), []);

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('get_my_verification');
      if (active) {
        if (error === null && data !== null) {
          setFlags(data as VerificationFlags);
        }
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refetchTrigger, localTrigger]);

  const updateAddress = useCallback(async (address: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'not_authenticated' };
    const trimmed = address.trim();
    const coords = await geocodeAddress(trimmed);
    const { error } = await supabase
      .from('profiles')
      .update({ address: trimmed, address_lat: coords?.lat ?? null, address_lng: coords?.lng ?? null })
      .eq('id', user.id);
    if (error === null) refetch();
    return { error: error?.message ?? null };
  }, [user, refetch]);

  const updatePhone = useCallback(async (phone: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'not_authenticated' };
    // Phone is stored but NOT verified (SMS disabled, cost). phone_verified_at stays null.
    const { error } = await supabase.from('profiles').update({ phone: phone.trim() }).eq('id', user.id);
    if (error === null) refetch();
    return { error: error?.message ?? null };
  }, [user, refetch]);

  return { flags, tier: computeVerificationTier(flags), loading, refetch, updateAddress, updatePhone };
}
