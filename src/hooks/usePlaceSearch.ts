import { useCallback, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SparringPlace } from '../types/sparringTrust';
import type { AppLanguage } from '../utils/language';

export type PlaceSearchError = 'quota' | 'network';

// Server-side place search (Edge Function resolve-sparring-place). Results are
// stored as server places; publishing only accepts their ids, so target
// coordinates never come from the device. `near` (e.g. the search city) only
// biases the search.
export function usePlaceSearch(): {
  searching: boolean;
  search: (query: string, near: { lat: number; lng: number } | null, lang: AppLanguage)
    => Promise<{ places: SparringPlace[]; error: PlaceSearchError | null }>;
} {
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (
    query: string,
    near: { lat: number; lng: number } | null,
    lang: AppLanguage,
  ): Promise<{ places: SparringPlace[]; error: PlaceSearchError | null }> => {
    setSearching(true);
    try {
      const { data, error } = await supabase.functions.invoke<{ places: SparringPlace[] }>(
        'resolve-sparring-place',
        { body: { query, near, lang } },
      );
      if (error !== null) {
        if (error instanceof FunctionsHttpError && error.context instanceof Response && error.context.status === 429) {
          return { places: [], error: 'quota' };
        }
        return { places: [], error: 'network' };
      }
      return { places: data?.places ?? [], error: null };
    } catch {
      return { places: [], error: 'network' };
    } finally {
      setSearching(false);
    }
  }, []);

  return { searching, search };
}
