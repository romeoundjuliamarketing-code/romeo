import { supabase } from '../lib/supabase';

interface BookTrialParams {
  studioId: string;
  scheduleId: string | null;
  requestedDate: string;
  note: string | null;
}

interface UseTrialBookingResult {
  bookTrial: (params: BookTrialParams) => Promise<{ error: string | null }>;
}

export function useTrialBooking(): UseTrialBookingResult {
  async function bookTrial(params: BookTrialParams): Promise<{ error: string | null }> {
    const { error } = await supabase.rpc('request_trial_booking', {
      p_studio_id:   params.studioId,
      p_schedule_id: params.scheduleId,
      p_date:        params.requestedDate,
      p_note:        params.note,
    });

    if (error !== null) {
      return { error: error.message };
    }
    return { error: null };
  }

  return { bookTrial };
}
