import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';

export interface CreateSparringParams {
  studioId: string;
  title: string;
  discipline: string;
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

    const { data: studio, error: studioError } = await supabase
      .from('studios')
      .select('address, lat, lng')
      .eq('id', params.studioId)
      .single();

    if (studioError !== null || studio === null) {
      return { error: 'Studio nicht gefunden.' };
    }
    if (studio.address === null || studio.address.trim().length === 0) {
      return { error: 'Das Studio hat noch keine Adresse hinterlegt. Bitte zuerst die Studio-Adresse setzen.' };
    }

    let lat = studio.lat;
    let lng = studio.lng;
    if (lat === null || lng === null) {
      const coords = await geocodeAddress(studio.address);
      lat = coords?.lat ?? null;
      lng = coords?.lng ?? null;
    }

    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: params.studioId,
      created_by: user.id,
      title: params.title,
      discipline: params.discipline,
      address: studio.address,
      lat,
      lng,
      scheduled_at: params.scheduledAt,
      duration_min: params.durationMin,
      max_slots: params.maxSlots,
      notes: params.notes.trim() || null,
    });
    return { error: error?.message ?? null };
  }, [user]);

  const deactivateSparring = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };
    const { error } = await supabase.rpc('deactivate_sparring', { p_id: sparringId });
    return { error: error?.message ?? null };
  }, [user]);

  return { signUp, cancelSignup, createSparring, deactivateSparring };
}
