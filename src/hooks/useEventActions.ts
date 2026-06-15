import { useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

export interface CreateEventParams {
  title:       string;
  fightCard:   string;
  venueName:   string;
  address:     string;
  lat:         number;
  lng:         number;
  scheduledAt: string;
  durationMin: number;
  maxSlots:    number;
  notes:       string;
}

export function useEventActions(): {
  createEvent:     (params: CreateEventParams) => Promise<{ error: string | null; eventId?: string }>;
  signUp:          (eventId: string) => Promise<{ error: string | null }>;
  cancelSignup:    (eventId: string) => Promise<{ error: string | null }>;
  deactivateEvent: (eventId: string) => Promise<{ error: string | null }>;
} {
  const { user } = useAuth();

  const createEvent = useCallback(
    async (params: CreateEventParams): Promise<{ error: string | null; eventId?: string }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };

      const { data, error } = await supabase.rpc('create_event', {
        p_title:        params.title,
        p_fight_card:   params.fightCard,
        p_venue_name:   params.venueName,
        p_address:      params.address,
        p_lat:          params.lat,
        p_lng:          params.lng,
        p_scheduled_at: params.scheduledAt,
        p_duration_min: params.durationMin,
        p_max_slots:    params.maxSlots,
        p_notes:        params.notes,
      });

      if (error !== null) return { error: error.message };

      const eventId = typeof data === 'string' ? data : (data as { id?: string } | null)?.id;
      return { error: null, eventId };
    },
    [user],
  );

  const signUp = useCallback(
    async (eventId: string): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };
      const { error } = await supabase.rpc('signup_event', { p_event_id: eventId });
      if (error !== null) return { error: error.message };
      return { error: null };
    },
    [user],
  );

  const cancelSignup = useCallback(
    async (eventId: string): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };
      const { error } = await supabase.rpc('cancel_event_signup', { p_event_id: eventId });
      if (error !== null) return { error: error.message };
      return { error: null };
    },
    [user],
  );

  const deactivateEvent = useCallback(
    async (eventId: string): Promise<{ error: string | null }> => {
      if (user === null) return { error: 'Nicht eingeloggt' };
      const { error } = await supabase.rpc('deactivate_event', { p_event_id: eventId });
      return { error: error?.message ?? null };
    },
    [user],
  );

  return { createEvent, signUp, cancelSignup, deactivateEvent };
}
