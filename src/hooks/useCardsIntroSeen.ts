import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../context/AuthContext';

const keyFor = (userId: string): string => `sparr.cards.introSeen.v1:${userId}`;

interface UseCardsIntroSeenResult {
  // null while the stored value is still being read — callers keep their loading state
  // so the cards area never flashes before the intro.
  seen:     boolean | null;
  markSeen: () => void;
}

// Whether the card game intro was dismissed on this device for the signed-in user.
// Stored locally like the card game hint (CardGameHint); there is no synced user
// settings table, and one would touch the Supabase contract shared with the website.
export function useCardsIntroSeen(): UseCardsIntroSeenResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    if (userId === null) return;
    let active = true;
    setSeen(null);
    AsyncStorage.getItem(keyFor(userId))
      .then((value) => { if (active) setSeen(value === 'true'); })
      // Unreadable storage must not lock the cards area behind the intro.
      .catch(() => { if (active) setSeen(true); });
    return () => { active = false; };
  }, [userId]);

  const markSeen = useCallback((): void => {
    setSeen(true);
    if (userId === null) return;
    void AsyncStorage.setItem(keyFor(userId), 'true').catch(() => undefined);
  }, [userId]);

  return { seen, markSeen };
}
