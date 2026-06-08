import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import type { BannedWord, FilterCategory } from '../utils/contentFilter';

const CACHE_KEY = 'banned_words_cache_v1';

// Loads the banned-words list once: seeds from AsyncStorage for instant
// availability, then refreshes from Supabase and re-caches. Falls back to an
// empty list when offline with no cache (server trigger remains the barrier).
export function useBannedWords(): { bannedWords: BannedWord[] } {
  const [bannedWords, setBannedWords] = useState<BannedWord[]>([]);

  useEffect(() => {
    let active = true;

    (async () => {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached && active) {
        try {
          setBannedWords(JSON.parse(cached) as BannedWord[]);
        } catch {
          // ignore corrupt cache
        }
      }

      const { data, error } = await supabase
        .from('banned_words')
        .select('word, category');
      if (error || data === null || !active) return;

      const list: BannedWord[] = data.map((r) => ({
        word: r.word,
        category: r.category as FilterCategory,
      }));
      setBannedWords(list);
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(list));
    })();

    return () => {
      active = false;
    };
  }, []);

  return { bannedWords };
}
