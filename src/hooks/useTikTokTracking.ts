import { useEffect } from 'react';
import { AppState } from 'react-native';
import { startTikTok } from '../lib/tiktok';

// Starts TikTok tracking (ATT prompt) once the user is fully inside the app.
// ATT cannot show while another system prompt (e.g. push permission) is open;
// it then reports "notDetermined" and is retried when the app is active again.
export function useTikTokTracking(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    void startTikTok();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void startTikTok();
    });
    return () => subscription.remove();
  }, [enabled]);
}
