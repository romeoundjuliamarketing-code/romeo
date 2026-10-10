import { useCallback, useState } from 'react';
import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SparringPlace } from '../types/sparringTrust';
import type { AppLanguage } from '../utils/language';

export type PlaceSearchError = 'quota' | 'network';

type PlaceOutcome = { places: SparringPlace[]; error: PlaceSearchError | null };

async function invokeResolver(body: Record<string, unknown>): Promise<PlaceOutcome> {
  try {
    const { data, error } = await supabase.functions.invoke<{ places: SparringPlace[] }>(
      'resolve-sparring-place',
      { body },
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
  }
}

// Server-side place search (Edge Function resolve-sparring-place). Results are
// stored as server places; publishing only accepts their ids, so target
// coordinates never come from the device. `near` (e.g. the search city) only
// biases the search. `resolvePin` turns a map tap into a server place (the
// server describes and stores the point; no result = no locality there).
export function usePlaceSearch(): {
  searching: boolean;
  search: (query: string, near: { lat: number; lng: number } | null, lang: AppLanguage)
    => Promise<PlaceOutcome>;
  resolvePin: (lat: number, lng: number, lang: AppLanguage) => Promise<PlaceOutcome>;
} {
  const [searching, setSearching] = useState(false);

  const search = useCallback(async (
    query: string,
    near: { lat: number; lng: number } | null,
    lang: AppLanguage,
  ): Promise<PlaceOutcome> => {
    setSearching(true);
    try {
      return await invokeResolver({ query, near, lang });
    } finally {
      setSearching(false);
    }
  }, []);

  const resolvePin = useCallback(async (lat: number, lng: number, lang: AppLanguage): Promise<PlaceOutcome> => {
    setSearching(true);
    try {
      return await invokeResolver({ pin: { lat, lng }, lang });
    } finally {
      setSearching(false);
    }
  }, []);

  return { searching, search, resolvePin };
}
