import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';

export type CreateSparringInput =
  | {
      studioId: string;
      address?: never;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    }
  | {
      address: string;
      /** Pre-resolved coordinates from map picker — skips geocoding when set */
      lat?: number;
      lng?: number;
      studioId?: never;
      /** true when a coach registers this sparring at their own studio location */
      isAtStudio?: boolean;
      /** studio_id to link — required when isAtStudio = true */
      atStudioId?: string;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
    };

export function useSparringActions(): {
  signUp: (sparringId: string) => Promise<{ error: string | null }>;
  cancelSignup: (sparringId: string) => Promise<{ error: string | null }>;
  createSparring: (params: CreateSparringInput) => Promise<{ error: string | null }>;
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

  const createSparring = useCallback(async (params: CreateSparringInput): Promise<{ error: string | null }> => {
    if (user === null) return { error: 'Nicht eingeloggt' };

    let resolvedAddress: string;
    let studioId: string | null = null;
    let lat: number | null = null;
    let lng: number | null = null;

    if (params.studioId !== undefined) {
      // Coach flow: fetch address from studio
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

      resolvedAddress = studio.address;
      studioId = params.studioId;
      lat = studio.lat;
      lng = studio.lng;

      if (lat === null || lng === null) {
        const coords = await geocodeAddress(resolvedAddress);
        lat = coords?.lat ?? null;
        lng = coords?.lng ?? null;
      }
    } else {
      // User flow: use pre-resolved coords from map picker, or geocode the typed address
      resolvedAddress = params.address;
      if (params.lat !== undefined && params.lng !== undefined) {
        lat = params.lat;
        lng = params.lng;
      } else {
        const coords = await geocodeAddress(resolvedAddress);
        lat = coords?.lat ?? null;
        lng = coords?.lng ?? null;
      }
    }

    const { error } = await supabase.from('open_sparrings').insert({
      studio_id: params.studioId !== undefined ? studioId : (params.isAtStudio === true ? (params.atStudioId ?? null) : null),
      is_at_studio: params.studioId !== undefined ? true : (params.isAtStudio === true),
      created_by: user.id,
      title: params.title,
      discipline: params.discipline,
      address: resolvedAddress,
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
