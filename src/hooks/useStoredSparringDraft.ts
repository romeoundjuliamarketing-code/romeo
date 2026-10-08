import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';
import { useAuth } from '../context/AuthContext';

// Keeps the unpublished "Sparring erstellen" draft on the device, per account,
// so a failed publication (no location, network, too far, limit) never loses
// the input. Drafts are never public and never count as a planned sparring.
// The request id makes repeated publish attempts of the same draft idempotent
// on the server; it is renewed only after a successful publication.

const KEY_PREFIX = 'sparr.sparringDraft.v1:';

export interface StoredDraft<T> {
  requestId: string;
  savedAt: number;
  draft: T;
}

export function newPublishRequestId(): string {
  return randomUUID();
}

export function useStoredSparringDraft<T>(): {
  load: () => Promise<StoredDraft<T> | null>;
  save: (draft: T, requestId: string) => Promise<void>;
  clear: () => Promise<void>;
} {
  const { user } = useAuth();
  const key = user?.id ? `${KEY_PREFIX}${user.id}` : null;

  const load = useCallback(async (): Promise<StoredDraft<T> | null> => {
    if (key === null) return null;
    try {
      const raw = await AsyncStorage.getItem(key);
      if (raw === null) return null;
      const parsed = JSON.parse(raw) as Partial<StoredDraft<T>>;
      if (typeof parsed.requestId !== 'string' || parsed.draft === undefined) return null;
      return { requestId: parsed.requestId, savedAt: parsed.savedAt ?? 0, draft: parsed.draft };
    } catch {
      return null;
    }
  }, [key]);

  const save = useCallback(async (draft: T, requestId: string): Promise<void> => {
    if (key === null) return;
    try {
      await AsyncStorage.setItem(key, JSON.stringify({ requestId, savedAt: Date.now(), draft }));
    } catch {
      // Storage full/unavailable: the in-memory draft still exists.
    }
  }, [key]);

  const clear = useCallback(async (): Promise<void> => {
    if (key === null) return;
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      // ignore
    }
  }, [key]);

  return { load, save, clear };
}
