import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getLocales } from 'expo-localization';
import { useTranslation } from 'react-i18next';
import i18n from './index';
import { supabase } from '../lib/supabase';
import {
  decideProfileSync, parseLanguage, resolveStartupLanguage, type AppLanguage,
} from '../utils/language';

// Device-level choice; survives sign-out like the welcome-intro flag.
const STORAGE_KEY = 'sparr.language.v1';

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

function bootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        const deviceTag = getLocales()[0]?.languageTag ?? null;
        return i18n.changeLanguage(resolveStartupLanguage(stored, deviceTag));
      })
      .then(() => { bootstrapped = true; });
  }
  return bootstrapPromise;
}

export function useLanguageBootstrap(): boolean {
  const [ready, setReady] = useState(bootstrapped);
  useEffect(() => {
    if (ready) return;
    let alive = true;
    void bootstrap().finally(() => { if (alive) setReady(true); });
    return () => { alive = false; };
  }, [ready]);
  return ready;
}

async function applyLocally(next: AppLanguage): Promise<void> {
  await i18n.changeLanguage(next);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, next);
  } catch (e) {
    console.warn('[i18n] could not persist language', e);
  }
}

async function uploadLanguage(userId: string, next: AppLanguage): Promise<void> {
  const { error } = await supabase.from('profiles').update({ language: next }).eq('id', userId);
  if (error) console.warn('[i18n] could not save language to profile', error.message);
}

export async function syncLanguageWithProfile(userId: string): Promise<void> {
  const { data, error } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  if (error || !data) return;
  const current = parseLanguage(i18n.language) ?? 'de';
  const { apply, upload } = decideProfileSync(data.language, current);
  if (apply) await applyLocally(apply);
  if (upload) await uploadLanguage(userId, upload);
}

export function useLanguage(): { language: AppLanguage; setLanguage: (next: AppLanguage) => Promise<void> } {
  const { i18n: instance } = useTranslation();
  const language = parseLanguage(instance.language) ?? 'de';
  const setLanguage = useCallback(async (next: AppLanguage): Promise<void> => {
    await applyLocally(next);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) await uploadLanguage(userId, next);
  }, []);
  return { language, setLanguage };
}
