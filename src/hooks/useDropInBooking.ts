import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabase';
import { reportNetworkError, reportNetworkSuccess } from '../lib/networkStatus';

interface UseDropInBookingResult {
  booking:    boolean;
  bookDropIn: (studioId: string, scheduleId: string, date: string) => Promise<{ error: string | null }>;
}

export function useDropInBooking(): UseDropInBookingResult {
  const [booking, setBooking] = useState(false);

  const bookDropIn = useCallback(
    async (studioId: string, scheduleId: string, date: string): Promise<{ error: string | null }> => {
      setBooking(true);
      const { error } = await supabase.rpc('create_drop_in_booking', {
        p_studio_id:      studioId,
        p_schedule_id:    scheduleId,
        p_requested_date: date,
      });
      setBooking(false);
      if (error !== null) { reportNetworkError(error); return { error: error.message }; }
      reportNetworkSuccess();
      return { error: null };
    },
    [],
  );

  return { booking, bookDropIn };
}
