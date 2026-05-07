import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';

export interface CreateSparringParams {
  studioId: string;
  title: string;
  discipline: string;
  address: string;
  scheduledAt: string;
  durationMin: number;
  maxSlots: number;
  notes: string;
}

export function useSparringActions(): {
  signUp: (sparringId: string) => Promise<{ error: string | null }>;
  cancelSignup: (sparringId: string) => Promise<{ error: string | null }>;
  createSparring: (params: CreateSparringParams) => Promise<{ error: string | null }>;
  deactivateSparring: (sparringId: string) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();

  const signUp = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('sparring_signups')
      .insert({ sparring_id: sparringId, user_id: user.id });
    return { error: error?.message ?? null };
  }, [user]);

  const cancelSignup = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('sparring_signups')
      .delete()
      .eq('sparring_id', sparringId)
      .eq('user_id', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  const createSparring = useCallback(async (params: CreateSparringParams): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };

    const coords = await geocodeAddress(params.address);

    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: params.studioId,
      created_by: user.id,
      title: params.title,
      discipline: params.discipline,
      address: params.address,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      scheduled_at: params.scheduledAt,
      duration_min: params.durationMin,
      max_slots: params.maxSlots,
      notes: params.notes.trim() || null,
    });
    return { error: error?.message ?? null };
  }, [user]);

  const deactivateSparring = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase
      .from('open_sparrings')
      .update({ is_active: false })
      .eq('id', sparringId)
      .eq('created_by', user.id);
    return { error: error?.message ?? null };
  }, [user]);

  return { signUp, cancelSignup, createSparring, deactivateSparring };
}
