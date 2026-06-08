import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a ~2 KB value limit per key.
// Large JWTs are split into numbered chunks (e.g. key__chunk_0, key__chunk_1, …)
// so that ALL auth data stays in the iOS Keychain — never in plaintext AsyncStorage.
const CHUNK_SIZE = 1800;
const CHUNK_COUNT_SUFFIX = '__chunkCount';

const largeSecureStore: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countStr !== null) {
      // Chunked value — reassemble from Keychain
      const count = parseInt(countStr, 10);
      const chunks: string[] = [];
      for (let i = 0; i < count; i++) {
        const chunk = await SecureStore.getItemAsync(`${key}__chunk_${i}`);
        if (chunk === null) return null;
        chunks.push(chunk);
      }
      return chunks.join('');
    }

    // Check single-chunk Keychain entry
    const keychainValue = await SecureStore.getItemAsync(key);
    if (keychainValue !== null) return keychainValue;

    // One-time migration: if value was previously stored in AsyncStorage (old fallback),
    // transparently move it to Keychain so the user does not need to re-login.
    const isLarge = await AsyncStorage.getItem(`${key}_isLarge`);
    const asyncValue = isLarge === 'true'
      ? await AsyncStorage.getItem(key)
      : null;
    if (asyncValue !== null) {
      // Migrate to Keychain and clean up AsyncStorage
      await largeSecureStore.setItem(key, asyncValue);
      await AsyncStorage.removeItem(`${key}_isLarge`);
      await AsyncStorage.removeItem(key);
      return asyncValue;
    }

    return null;
  },

  async setItem(key: string, value: string): Promise<void> {
    // Clean up any previous chunked remnants
    const oldCountStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (oldCountStr !== null) {
      const oldCount = parseInt(oldCountStr, 10);
      for (let i = 0; i < oldCount; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`).catch(() => undefined);
      }
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX).catch(() => undefined);
    }

    if (value.length > CHUNK_SIZE) {
      // Delete any stale single-key entry from a previous unchunked write.
      await SecureStore.deleteItemAsync(key).catch(() => undefined);
      // Split into chunks and store each in Keychain
      const count = Math.ceil(value.length / CHUNK_SIZE);
      for (let i = 0; i < count; i++) {
        await SecureStore.setItemAsync(
          `${key}__chunk_${i}`,
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        );
      }
      await SecureStore.setItemAsync(key + CHUNK_COUNT_SUFFIX, String(count));
    } else {
      await SecureStore.setItemAsync(key, value);
    }
  },

  async removeItem(key: string): Promise<void> {
    const countStr = await SecureStore.getItemAsync(key + CHUNK_COUNT_SUFFIX);
    if (countStr !== null) {
      const count = parseInt(countStr, 10);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__chunk_${i}`).catch(() => undefined);
      }
      await SecureStore.deleteItemAsync(key + CHUNK_COUNT_SUFFIX).catch(() => undefined);
    }
    await SecureStore.deleteItemAsync(key).catch(() => undefined);
  },
};

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: largeSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
