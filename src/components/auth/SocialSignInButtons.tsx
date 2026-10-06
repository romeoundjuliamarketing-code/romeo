import React, { useEffect, useRef, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { colors } from '../../theme/colors';
import {
  isAppleSignInAvailable, isGoogleSignInAvailable, signInWithApple, signInWithGoogle,
} from '../../lib/socialAuth';
import type { SocialResult } from '../../lib/socialAuth';

interface Props {
  /** Same best-effort Turnstile token as the email login (undefined = none yet). */
  captchaToken: string | undefined;
  /** A token is single-use: called after every finished attempt that used it. */
  onCaptchaUsed: () => void;
}

const BUTTON_HEIGHT = 48;

// "oder" + Sign in with Apple (iOS, system button as Apple requires) and
// "Mit Google fortfahren" (official G). Hidden entirely when neither is
// available (e.g. a build without the native modules or no client IDs yet).
// On success the session change in AuthContext navigates, like the email login.
export default function SocialSignInButtons({ captchaToken, onCaptchaUsed }: Props) {
  const [appleAvailable, setAppleAvailable] = useState(false);
  const googleAvailable = isGoogleSignInAvailable();
  const [busy, setBusy] = useState<'apple' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Blocks a second attempt from a double tap before the busy state renders.
  const running = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void isAppleSignInAvailable().then((ok) => { if (!cancelled) setAppleAvailable(ok); });
    return () => { cancelled = true; };
  }, []);

  if (!appleAvailable && !googleAvailable) return null;

  async function run(provider: 'apple' | 'google'): Promise<void> {
    if (running.current) return;
    running.current = true;
    setBusy(provider);
    setError(null);
    const result: SocialResult = provider === 'apple'
      ? await signInWithApple(captchaToken)
      : await signInWithGoogle(captchaToken);
    running.current = false;
    setBusy(null);
    if (result.status === 'cancelled') return;
    onCaptchaUsed();
    if (result.status === 'error') setError(result.message);
  }

  return (
    <View style={styles.wrap}>
      <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>oder</Text>
        <View style={styles.dividerLine} />
      </View>

      {appleAvailable && (
        <View pointerEvents={busy !== null ? 'none' : 'auto'} style={busy !== null && styles.busy}>
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={12}
            style={styles.appleButton}
            onPress={() => { void run('apple'); }}
          />
        </View>
      )}

      {googleAvailable && (
        <TouchableOpacity
          style={[styles.googleButton, busy !== null && styles.busy]}
          onPress={() => { void run('google'); }}
          disabled={busy !== null}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Mit Google fortfahren"
          accessibilityState={{ busy: busy === 'google', disabled: busy !== null }}
        >
          {busy === 'google' ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <>
              <Image
                // Official Google "G" (Google Sign-In branding assets).
                // eslint-disable-next-line @typescript-eslint/no-require-imports
                source={require('../../../assets/images/google-g.png')}
                style={styles.googleLogo}
                accessible={false}
              />
              <Text style={styles.googleText}>Mit Google fortfahren</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {error !== null && <Text style={styles.error} accessibilityLiveRegion="polite">{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 8,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.fieldBorder,
  },
  dividerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  appleButton: {
    width: '100%',
    height: BUTTON_HEIGHT,
  },
  // Google's light button: white fill, grey outline, dark label.
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: BUTTON_HEIGHT,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.textMuted,
    backgroundColor: colors.card,
  },
  googleLogo: {
    width: 20,
    height: 20,
  },
  googleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  busy: {
    opacity: 0.6,
  },
  error: {
    fontSize: 14,
    color: colors.deleteRed,
  },
});
