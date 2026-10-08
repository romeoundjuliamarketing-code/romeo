import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';
import { useAuth } from '../context/AuthContext';
import type {
  CheckinResult, CheckinSessionResult, DeviceFix, EligibilityResult, FeedbackResult,
  JoinV2Result, MeetingAnswer, PlaceSuggestionResult, PublishResult, TrustRefusal,
} from '../types/sparringTrust';
import { fixToRpcArgs } from '../utils/sparringTrust';
import { acquireDeviceFix, clearDeviceFix, type FixError } from './useDeviceFix';

// Every binding action resolves to one of these. 'network' never pretends
// success: the UI keeps the draft / shows retry, nothing is assumed.
export type TrustOutcome<T> =
  | { kind: 'ok'; data: T }
  | { kind: 'refused'; refusal: TrustRefusal }
  | { kind: 'location'; error: FixError }
  | { kind: 'network' };

type Ok<R> = Extract<R, { ok: true }>;

function settle<R extends { ok: boolean }>(data: R | null, error: unknown): TrustOutcome<Ok<R>> {
  if (error !== null || data === null) {
    if (error !== null) reportNetworkError(error);
    return { kind: 'network' };
  }
  reportNetworkSuccess();
  if (!data.ok) return { kind: 'refused', refusal: data as unknown as TrustRefusal };
  return { kind: 'ok', data: data as Ok<R> };
}

export interface PublishInput {
  requestId: string;
  placeId: string;
  placeLabel: string | null;
  title: string;
  discipline: string;
  notes: string | null;
  scheduledAt: string;
  durationMin: number;
  maxSlots: number;
  verifiedOnly: boolean;
  permissionConfirmed: boolean;
  gymId: string | null;
  studioId: string | null;
  accessNote: string | null;
}

async function withFix<T>(
  askPermission: boolean,
  run: (fix: DeviceFix) => Promise<TrustOutcome<T>>,
): Promise<TrustOutcome<T>> {
  const fixed = await acquireDeviceFix(askPermission);
  if (!fixed.ok) return { kind: 'location', error: fixed.error };
  return run(fixed.fix);
}

// RPC wrappers for reliable sparrings. Location is measured right before each
// binding call; the server re-checks everything.
export function useSparringTrustActions() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  // Early, non-binding check. Without fix: slot/rate only (no distance shown).
  const checkEligibility = useCallback(async (
    action: 'publish' | 'join',
    opts: { sparringId?: string; placeId?: string; fix?: DeviceFix | null },
  ): Promise<TrustOutcome<Ok<EligibilityResult>>> => {
    if (userId === null) return { kind: 'network' };
    const fixArgs = opts.fix ? fixToRpcArgs(opts.fix, Date.now()) : {};
    const { data, error } = await supabase.rpc('check_sparring_eligibility', {
      p_action: action,
      p_sparring_id: opts.sparringId ?? null,
      p_place_id: opts.placeId ?? null,
      ...fixArgs,
    });
    return settle<EligibilityResult>(data, error);
  }, [userId]);

  const publish = useCallback(async (input: PublishInput, askPermission: boolean): Promise<TrustOutcome<Ok<PublishResult>>> =>
    withFix(askPermission, async (fix) => {
      const { data, error } = await supabase.rpc('publish_sparring', {
        p_request_id: input.requestId,
        p_place_id: input.placeId,
        p_title: input.title,
        p_discipline: input.discipline,
        p_notes: input.notes,
        p_scheduled_at: input.scheduledAt,
        p_duration_min: input.durationMin,
        p_max_slots: input.maxSlots,
        p_verified_only: input.verifiedOnly,
        p_permission_confirmed: input.permissionConfirmed,
        p_gym_id: input.gymId,
        p_studio_id: input.studioId,
        p_access_note: input.accessNote,
        p_place_label: input.placeLabel,
        ...fixToRpcArgs(fix, Date.now()),
      });
      return settle<PublishResult>(data, error);
    }), []);

  const join = useCallback(async (sparringId: string, rulesVersion: number, askPermission: boolean): Promise<TrustOutcome<Ok<JoinV2Result>>> =>
    withFix(askPermission, async (fix) => {
      const { data, error } = await supabase.rpc('join_sparring_v2', {
        p_sparring_id: sparringId,
        p_rules_version: rulesVersion,
        ...fixToRpcArgs(fix, Date.now()),
      });
      return settle<JoinV2Result>(data, error);
    }), []);

  // Organizer: new QR token. A renewal always measures again.
  const startCheckinSession = useCallback(async (sparringId: string, renew: boolean): Promise<TrustOutcome<Ok<CheckinSessionResult>>> => {
    if (renew) clearDeviceFix();
    return withFix(true, async (fix) => {
      const { data, error } = await supabase.rpc('start_checkin_session', {
        p_sparring_id: sparringId,
        ...fixToRpcArgs(fix, Date.now()),
      });
      return settle<CheckinSessionResult>(data, error);
    });
  }, []);

  const checkIn = useCallback(async (sparringId: string, token: string): Promise<TrustOutcome<Ok<CheckinResult>>> =>
    withFix(true, async (fix) => {
      const { data, error } = await supabase.rpc('check_in_sparring', {
        p_sparring_id: sparringId,
        p_token: token,
        ...fixToRpcArgs(fix, Date.now()),
      });
      return settle<CheckinResult>(data, error);
    }), []);

  const submitFeedback = useCallback(async (sparringId: string, answer: MeetingAnswer, note: string | null): Promise<TrustOutcome<Ok<FeedbackResult>>> => {
    const { data, error } = await supabase.rpc('submit_meeting_feedback', {
      p_sparring_id: sparringId,
      p_answer: answer,
      p_note: note,
    });
    return settle<FeedbackResult>(data, error);
  }, []);

  const suggestPlace = useCallback(async (name: string, address: string, note: string | null): Promise<TrustOutcome<Ok<PlaceSuggestionResult>>> => {
    const { data, error } = await supabase.rpc('submit_place_suggestion', {
      p_name: name, p_address: address, p_note: note,
    });
    return settle<PlaceSuggestionResult>(data, error);
  }, []);

  return { checkEligibility, publish, join, startCheckinSession, checkIn, submitFeedback, suggestPlace };
}
