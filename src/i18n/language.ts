import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTranslation } from 'react-i18next';
import i18n from './index';
import { supabase } from '../lib/supabase';
import {
  decideProfileSync, parseLanguage, resolveStartupLanguage, type AppLanguage,
} from '../utils/language';
import { localized, type LocalizedText } from '../utils/localized';

// Device-level choice; survives sign-out like the welcome-intro flag.
const STORAGE_KEY = 'sparr.language.v1';
// Set while a manual choice has not been confirmed by the server yet.
const PENDING_KEY = 'sparr.languagePending.v1';

// Hermes resolves the default Intl locale from the device settings, so no
// native module (and no dev rebuild / OTA runtime bump) is needed.
function readDeviceLanguageTag(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return null;
  }
}

let bootstrapped = false;
let bootstrapPromise: Promise<void> | null = null;

function bootstrap(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = AsyncStorage.getItem(STORAGE_KEY)
      .catch(() => null)
      .then((stored) => {
        const deviceTag = readDeviceLanguageTag();
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

async function setPending(pending: boolean): Promise<void> {
  try {
    if (pending) await AsyncStorage.setItem(PENDING_KEY, '1');
    else await AsyncStorage.removeItem(PENDING_KEY);
  } catch (e) {
    console.warn('[i18n] could not persist pending flag', e);
  }
}

async function readPending(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(PENDING_KEY)) === '1';
  } catch {
    return false;
  }
}

// Uploads run strictly in order so rapid taps end with the last choice on the
// server. The pending flag is cleared only when the uploaded value is still the
// active one; a failed upload leaves it set and the next sync retries.
let uploadQueue: Promise<void> = Promise.resolve();

function enqueueUpload(userId: string, next: AppLanguage): Promise<void> {
  uploadQueue = uploadQueue.then(async () => {
    const { error } = await supabase.from('profiles').update({ language: next }).eq('id', userId);
    if (error) {
      console.warn('[i18n] could not save language to profile', error.message);
      return;
    }
    if (i18n.language === next) await setPending(false);
  }).catch((e: unknown) => {
    // Keep the chain alive; the pending flag stays set for the next sync.
    console.warn('[i18n] language upload failed', e);
  });
  return uploadQueue;
}

export async function syncLanguageWithProfile(userId: string): Promise<void> {
  const startLanguage = i18n.language;
  const pending = await readPending();
  const { data, error } = await supabase.from('profiles').select('language').eq('id', userId).maybeSingle();
  if (error || !data) return;
  // The user changed the language while the profile was loading: their choice
  // is newer than the fetched value and already queued for upload.
  if (i18n.language !== startLanguage) return;
  const current = parseLanguage(i18n.language) ?? 'de';
  const { apply, upload } = decideProfileSync(data.language, current, pending);
  if (apply) await applyLocally(apply);
  if (upload) await enqueueUpload(userId, upload);
}

export function useLanguage(): { language: AppLanguage; setLanguage: (next: AppLanguage) => Promise<void> } {
  const { i18n: instance } = useTranslation();
  const language = parseLanguage(instance.language) ?? 'de';
  const setLanguage = useCallback(async (next: AppLanguage): Promise<void> => {
    await applyLocally(next);
    await setPending(true);
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (userId) await enqueueUpload(userId, next);
  }, []);
  return { language, setLanguage };
}

// Picks the active language from a bilingual content field (src/data/).
export function useLocalized(): (text: LocalizedText) => string {
  const { language } = useLanguage();
  return useCallback((text: LocalizedText) => localized(text, language), [language]);
}
