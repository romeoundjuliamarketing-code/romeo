import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { geocodeAddress } from '../utils/geocoding';
import { SPARRING_RULES_VERSION } from '../data/sparringRules';
import { SPARRING_TRUST } from '../data/sparringConfig';
import { formatTooFarKm, trustNoticeFor } from '../utils/sparringTrust';
import { localeFor, parseLanguage } from '../utils/language';
import { useSparringTrustActions } from './useSparringTrustActions';
import type { Database } from '../types/database.types';
import i18n from '../i18n';
import { serverErrorText } from '../utils/serverErrorText';

type JoinSparringStatus   = 'pending' | 'confirmed' | 'waitlisted'
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

// Dynamic notice keys: the typed t() cannot check a computed key.
const translate = i18n.t.bind(i18n) as (key: string, params: Record<string, string | number>) => string;
const currentLanguage = () => parseLanguage(i18n.language) ?? 'de';

export function useSparringActions(): {
  signUp: (sparringId: string, rulesVersion: number) => Promise<{ error: string | null; status: JoinSparringStatus | null }>;
  cancelSignup: (sparringId: string) => Promise<{ error: string | null; status: CancelSparringStatus | null }>;
  confirmSparring: (sparringId: string) => Promise<{ error: string | null }>;
  markAttendance: (sparringId: string, userId: string, present: boolean) => Promise<{ error: string | null }>;
  deactivateSparring: (sparringId: string) => Promise<{ error: string | null }>;
  updateSparring: (sparringId: string, input: UpdateSparringInput) => Promise<{ error: string | null; result: UpdateSparringResult | null }>;
  countEditAffected: (sparringId: string) => Promise<number>;
  setSparringGym: (sparringId: string, gymId: string | null, accessNote: string | null) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();
  const { join } = useSparringTrustActions();

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
    // Binding join: measures the device position and is checked by the server.
    const out = await join(sparringId, rulesVersion, true);
    if (out.kind === 'ok') return { error: null, status: out.data.status };
    if (out.kind === 'refused') {
      const radius = out.refusal.radius_km ?? SPARRING_TRUST.radiusBaseKm;
      if (out.refusal.reason === 'too_far') {
        // Never invent a distance: without one the radius-only text is used.
        const distance = formatTooFarKm(out.refusal.distance_m, radius, localeFor(currentLanguage()));
        const lines = [distance !== null
          ? translate('sparringTrust.notice.tooFar', { distance, radius })
          : translate('sparringTrust.notice.tooFarUnknown', { radius })];
        if (out.refusal.unlocked !== true) {
          lines.push(translate('sparringTrust.notice.tooFarHint', { km: SPARRING_TRUST.radiusUnlockedKm }));
        }
        return { error: lines.join(' '), status: null };
      }
      const key = `sparringTrust.notice.${trustNoticeFor(out.refusal.reason).key}` as const;
      const params: Record<string, string | number> = {
        radius, time: '', meters: SPARRING_TRUST.checkinRadiusM,
      };
      return { error: translate(key, params), status: null };
    }
    if (out.kind === 'location') return { error: i18n.t('sparringTrust.notice.locationMissing'), status: null };
    return { error: i18n.t('sparringTrust.notice.network'), status: null };
  }, [user, join]);

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
    signUp, cancelSignup, confirmSparring, markAttendance, deactivateSparring,
    updateSparring, countEditAffected, setSparringGym,
  };
}
