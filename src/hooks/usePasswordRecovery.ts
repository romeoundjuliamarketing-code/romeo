import { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { supabase } from '../lib/supabase';

/** Parse a key=value&key=value fragment — handles = signs inside values. */
function parseParams(fragment: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const pair of fragment.split('&')) {
    const idx = pair.indexOf('=');
    if (idx === -1) continue;
    const key = decodeURIComponent(pair.slice(0, idx));
    const value = decodeURIComponent(pair.slice(idx + 1));
    result[key] = value;
  }
  return result;
}

/**
 * Handles the Supabase password-recovery deep link (sparr://reset-password).
 *
 * Supports both auth flows:
 * - PKCE  (default in supabase-js v2): URL contains ?code=XXX
 * - Implicit: URL fragment contains access_token + refresh_token + type=recovery
 */
export function usePasswordRecovery(): {
  recoveryActive: boolean;
  endRecovery: () => void;
} {
  const [recoveryActive, setRecoveryActive] = useState(false);

  const handleUrl = useCallback(async (url: string | null): Promise<void> => {
    if (url === null) return;
    if (!url.startsWith('sparr://reset-password')) return;

    const queryString = url.includes('?') ? url.split('?')[1] : undefined;
    const fragmentString = url.includes('#') ? url.split('#')[1] : undefined;

    // --- PKCE flow: ?code=XXX ---
    if (queryString !== undefined) {
      const queryParams = parseParams(queryString);
      if (queryParams.error_description !== undefined) {
        Alert.alert('Link ungültig', 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.');
        return;
      }
      if (queryParams.code !== undefined) {
        const { error } = await supabase.auth.exchangeCodeForSession(queryParams.code);
        if (error !== null) {
          Alert.alert('Link ungültig', 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.');
          return;
        }
        setRecoveryActive(true);
        return;
      }
    }

    // --- Implicit flow: #access_token=XXX&refresh_token=XXX&type=recovery ---
    if (fragmentString !== undefined) {
      const fragmentParams = parseParams(fragmentString);
      if (fragmentParams.error_description !== undefined) {
        Alert.alert('Link ungültig', 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.');
        return;
      }
      const { access_token, refresh_token, type } = fragmentParams;
      if (type !== 'recovery') return;
      if (access_token === undefined || refresh_token === undefined) return;
      const { error } = await supabase.auth.setSession({ access_token, refresh_token });
      if (error !== null) {
        Alert.alert('Link ungültig', 'Der Link ist abgelaufen oder ungültig. Bitte fordere einen neuen an.');
        return;
      }
      setRecoveryActive(true);
    }
  }, []);

  useEffect(() => {
    void Linking.getInitialURL().then(handleUrl);
    const subscription = Linking.addEventListener('url', (event) => {
      void handleUrl(event.url);
    });
    return () => subscription.remove();
  }, [handleUrl]);

  const endRecovery = useCallback(() => setRecoveryActive(false), []);

  return { recoveryActive, endRecovery };
}
