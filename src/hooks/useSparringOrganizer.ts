import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { getCached, setCached } from '../lib/queryCache';

export interface SparringOrganizer {
  name:       string | null;
  avatar_url: string | null;
}

// Public name + avatar of a sparring's organizer (same columns the public
// profile reads). Cached per user so reopening a sparring shows it at once.
export function useSparringOrganizer(userId: string | null): SparringOrganizer | null {
  const key = userId !== null ? `sparring_organizer:${userId}` : null;
  const [organizer, setOrganizer] = useState<SparringOrganizer | null>(
    key !== null ? getCached<SparringOrganizer>(key) ?? null : null,
  );

  useEffect(() => {
    if (userId === null || key === null) {
      setOrganizer(null);
      return;
    }
    setOrganizer(getCached<SparringOrganizer>(key) ?? null);
    let cancelled = false;
    void supabase
      .from('profiles')
      .select('name, avatar_url')
      .eq('id', userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled || error !== null || data === null) return;
        const next: SparringOrganizer = { name: data.name, avatar_url: data.avatar_url };
        setCached(key, next);
        setOrganizer(next);
      });
    return () => { cancelled = true; };
  }, [userId, key]);

  return organizer;
}
