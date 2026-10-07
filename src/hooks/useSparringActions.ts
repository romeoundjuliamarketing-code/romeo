import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';
import { SPARRING_RULES_VERSION } from '../data/sparringRules';
import type { Database } from '../types/database.types';
import { sparringInsertErrorCode } from '../utils/subscriptionPlans';
import i18n from '../i18n';
import { serverErrorText } from '../utils/serverErrorText';

type JoinSparringStatus   = Database['public']['Functions']['join_sparring']['Returns']
type CancelSparringStatus = Database['public']['Functions']['cancel_sparring_signup']['Returns']
export type UpdateSparringResult = Database['public']['Functions']['update_sparring']['Returns']

/** Full set of editable fields; the RPC detects what changed. */
export interface UpdateSparringInput {
  title:        string;
  notes:        string;
  discipline:   string;
  address:      string;
  /** Unchanged address: pass the stored coordinates (null if none). */
  lat:          number | null;
  lng:          number | null;
  /** true when the address was edited and lat/lng are not from the map picker */
  geocode:      boolean;
  scheduledAt:  string;
  durationMin:  number;
  maxSlots:     number;
  verifiedOnly: boolean;
  /** Gym link + access note; only sent when changed (descriptive, no notification). */
  gym?: { gymId: string | null; accessNote: string | null };
}

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
      verifiedOnly?: boolean;
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
      /** Gym the sparring takes place at (location only, no studio offer). */
      gymId?: string;
      /** Optional short access hint, e.g. "Gäste nach Absprache". */
      accessNote?: string;
      title: string;
      discipline: string;
      scheduledAt: string;
      durationMin: number;
      maxSlots: number;
      notes: string;
      verifiedOnly?: boolean;
    };

export function useSparringActions(): {
  signUp: (sparringId: string, rulesVersion: number) => Promise<{ error: string | null; status: JoinSparringStatus | null }>;
  cancelSignup: (sparringId: string) => Promise<{ error: string | null; status: CancelSparringStatus | null }>;
  confirmSparring: (sparringId: string) => Promise<{ error: string | null }>;
  markAttendance: (sparringId: string, userId: string, present: boolean) => Promise<{ error: string | null }>;
  createSparring: (params: CreateSparringInput) => Promise<{ error: string | null; sparringId?: string; code?: 'subscription_required' }>;
  deactivateSparring: (sparringId: string) => Promise<{ error: string | null }>;
  updateSparring: (sparringId: string, input: UpdateSparringInput) => Promise<{ error: string | null; result: UpdateSparringResult | null }>;
  countEditAffected: (sparringId: string) => Promise<number>;
  setSparringGym: (sparringId: string, gymId: string | null, accessNote: string | null) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();

  const signUp = useCallback(async (
    sparringId: string,
    rulesVersion: number,
  ): Promise<{ error: string | null; status: JoinSparringStatus | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn'), status: null };
    // The signup is only valid together with the accepted rules version — the
    // RPC rejects anything below the current one, but check early so we don't
    // round-trip for an obviously stale consent.
    if (rulesVersion < SPARRING_RULES_VERSION) {
      return { error: i18n.t('sparring.actions.rulesRequired'), status: null };
    }
    const { data, error } = await supabase.rpc('join_sparring', {
      p_sparring_id:   sparringId,
      p_rules_version: rulesVersion,
    });
    if (error !== null) return { error: serverErrorText(error.message), status: null };
    return { error: null, status: data };
  }, [user]);

  const cancelSignup = useCallback(async (
    sparringId: string,
  ): Promise<{ error: string | null; status: CancelSparringStatus | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn'), status: null };
    const { data, error } = await supabase.rpc('cancel_sparring_signup', { p_sparring_id: sparringId });
    if (error !== null) return { error: serverErrorText(error.message), status: null };
    return { error: null, status: data };
  }, [user]);

  const confirmSparring = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn') };
    const { error } = await supabase.rpc('confirm_sparring', { p_sparring_id: sparringId });
    return { error: (error ? serverErrorText(error.message) : null) };
  }, [user]);

  const markAttendance = useCallback(async (
    sparringId: string,
    userId: string,
    present: boolean,
  ): Promise<{ error: string | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn') };
    const { error } = await supabase.rpc('mark_sparring_attendance', {
      p_sparring_id: sparringId,
      p_user_id:     userId,
      p_present:     present,
    });
    return { error: (error ? serverErrorText(error.message) : null) };
  }, [user]);

  const createSparring = useCallback(async (params: CreateSparringInput): Promise<{ error: string | null; sparringId?: string; code?: 'subscription_required' }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn') };

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
        return { error: i18n.t('sparring.actions.gymNotFound') };
      }
      if (studio.address === null || studio.address.trim().length === 0) {
        return { error: i18n.t('sparring.actions.gymNoAddress') };
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

    // Gym columns only when a gym was chosen, so creating keeps working on a
    // backend without the gym migration.
    const gymFields = params.studioId === undefined && params.gymId !== undefined
      ? { gym_id: params.gymId, access_note: params.accessNote?.trim() || null }
      : {};
    const insertStudioId = params.studioId !== undefined ? studioId : (params.isAtStudio === true ? (params.atStudioId ?? null) : null);
    const { data: newSparring, error } = await supabase
      .from('open_sparrings')
      .insert({
        studio_id:     insertStudioId,
        is_at_studio:  params.studioId !== undefined ? true : (params.isAtStudio === true),
        created_by:    user.id,
        title:         params.title,
        discipline:    params.discipline,
        address:       resolvedAddress,
        lat,
        lng,
        scheduled_at:  params.scheduledAt,
        duration_min:  params.durationMin,
        max_slots:     params.maxSlots,
        notes:         params.notes.trim() || null,
        verified_only: params.verifiedOnly === true,
        ...gymFields,
      })
      .select('id')
      .single();

    if (error !== null || newSparring === null) {
      if (sparringInsertErrorCode(error?.code, insertStudioId) === 'subscription_required') {
        return { error: i18n.t('sparring.actions.subscriptionRequired'), code: 'subscription_required' };
      }
      return { error: (error ? serverErrorText(error.message) : i18n.t('sparring.actions.createFailed')) };
    }

    const { error: settingsError } = await supabase
      .from('sparring_chat_settings')
      .upsert({ sparring_id: newSparring.id }, { onConflict: 'sparring_id', ignoreDuplicates: true });

    if (settingsError !== null) {
      await supabase.from('open_sparrings').delete().eq('id', newSparring.id);
      return { error: settingsError.message };
    }

    return { error: null, sparringId: newSparring.id };
  }, [user]);

  const deactivateSparring = useCallback(async (sparringId: string): Promise<{ error: string | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn') };
    const { error } = await supabase.rpc('deactivate_sparring', { p_id: sparringId });
    return { error: (error ? serverErrorText(error.message) : null) };
  }, [user]);

  // Links/unlinks the gym of an own sparring (location label only).
  const setSparringGym = useCallback(async (
    sparringId: string,
    gymId: string | null,
    accessNote: string | null,
  ): Promise<{ error: string | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn') };
    const { error } = await supabase.rpc('set_sparring_gym', {
      p_id:          sparringId,
      p_gym_id:      gymId,
      p_access_note: accessNote,
    });
    return { error: error !== null ? i18n.t('sparring.actions.gymSaveFailed') : null };
  }, [user]);

  const updateSparring = useCallback(async (
    sparringId: string,
    input: UpdateSparringInput,
  ): Promise<{ error: string | null; result: UpdateSparringResult | null }> => {
    if (user === null) return { error: i18n.t('sparring.actions.notLoggedIn'), result: null };

    let { lat, lng } = input;
    if (input.geocode) {
      const coords = await geocodeAddress(input.address);
      lat = coords?.lat ?? null;
      lng = coords?.lng ?? null;
    }

    const { data, error } = await supabase.rpc('update_sparring', {
      p_id:            sparringId,
      p_title:         input.title,
      p_notes:         input.notes.trim() || null,
      p_discipline:    input.discipline,
      p_address:       input.address,
      p_lat:           lat,
      p_lng:           lng,
      p_scheduled_at:  input.scheduledAt,
      p_duration_min:  input.durationMin,
      p_max_slots:     input.maxSlots,
      p_verified_only: input.verifiedOnly,
    });
    if (error !== null) {
      // The server-side word filter raises a code, not a sentence.
      if (error.message.includes('CONTENT_FILTER_BLOCKED')) {
        return { error: i18n.t('sparring.actions.contentBlocked'), result: null };
      }
      return { error: serverErrorText(error.message), result: null };
    }
    if (input.gym !== undefined) {
      const { error: gymError } = await setSparringGym(sparringId, input.gym.gymId, input.gym.accessNote);
      if (gymError !== null) {
        return { error: i18n.t('sparring.actions.partialSave'), result: data };
      }
    }
    return { error: null, result: data };
  }, [user, setSparringGym]);

  // People a material edit notifies (slot holders + waitlist, organizer excluded).
  // Only drives the confirmation dialog; the RPC decides on its own.
  const countEditAffected = useCallback(async (sparringId: string): Promise<number> => {
    if (user === null) return 0;
    const { count } = await supabase
      .from('sparring_signups')
      .select('id', { count: 'exact', head: true })
      .eq('sparring_id', sparringId)
      .in('status', ['pending', 'confirmed', 'waitlisted'])
      .neq('user_id', user.id);
    return count ?? 0;
  }, [user]);

  return {
    signUp, cancelSignup, confirmSparring, markAttendance, createSparring, deactivateSparring,
    updateSparring, countEditAffected, setSparringGym,
  };
}
