import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import type { SupportedStorage } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// SecureStore has a 2 KB value limit — fall back to AsyncStorage for larger tokens (e.g. JWT)
const largeSecureStore: SupportedStorage = {
  async getItem(key: string): Promise<string | null> {
    const isLarge = await AsyncStorage.getItem(`${key}_isLarge`);
    if (isLarge === 'true') return AsyncStorage.getItem(key);
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string): Promise<void> {
    if (value.length > 1800) {
      await AsyncStorage.setItem(`${key}_isLarge`, 'true');
      await AsyncStorage.setItem(key, value);
    } else {
      await AsyncStorage.removeItem(`${key}_isLarge`);
      await SecureStore.setItemAsync(key, value);
    }
  },
  async removeItem(key: string): Promise<void> {
    await AsyncStorage.removeItem(`${key}_isLarge`);
    await AsyncStorage.removeItem(key);
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
