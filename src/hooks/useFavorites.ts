import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'favorite_workouts';

export function useFavorites(): {
  favoriteIds: Set<string>;
  isFavorite: (id: string) => boolean;
  toggleFavorite: (id: string) => Promise<void>;
} {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw !== null) {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavoriteIds(new Set(parsed as string[]));
      }
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const isFavorite = useCallback((id: string) => favoriteIds.has(id), [favoriteIds]);

  const toggleFavorite = useCallback(async (id: string) => {
    setFavoriteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }, []);

  return { favoriteIds, isFavorite, toggleFavorite };
}
