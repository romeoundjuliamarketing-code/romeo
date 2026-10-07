import { Platform, TurboModuleRegistry } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { supabase } from './supabase';
import i18n from '../i18n';

// Native Sign in with Apple (iOS) and Google (iOS + Android), both finished
// with supabase.auth.signInWithIdToken — the session then flows through
// AuthContext like an email login (onboarding, profile trigger unchanged).
// Client IDs are public identifiers from .env / EAS environment variables.

export type SocialResult = { status: 'success' } | { status: 'cancelled' } | { status: 'error'; message: string };

const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? '';
const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';

// Evaluated at call time so a language switch applies immediately.
const genericError = (): string => i18n.t('auth.social.genericError');

// ─── Apple ────────────────────────────────────────────────────────────────────

export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== 'ios') return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

function appleFullName(name: AppleAuthentication.AppleAuthenticationFullName | null): string | null {
  const full = [name?.givenName, name?.familyName].filter((p): p is string => typeof p === 'string' && p.length > 0).join(' ');
  return full.length > 0 ? full : null;
}

export async function signInWithApple(captchaToken: string | undefined): Promise<SocialResult> {
  // Loaded here, not at import: expo-crypto throws without its native module,
  // and this file is imported by screens that older dev builds also render.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  // Apple gets the SHA-256 of the nonce; Supabase checks the raw value against it.
  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);

  let credential: AppleAuthentication.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    });
  } catch (e) {
    const code = (e as { code?: string }).code;
    if (code === 'ERR_REQUEST_CANCELED') return { status: 'cancelled' };
    // Keep Apple's code/message visible: without it a failed request is undiagnosable.
    const detail = [code, (e as { message?: string }).message].filter((p): p is string => typeof p === 'string' && p.length > 0).join(': ');
    return { status: 'error', message: detail.length > 0 ? `${genericError()} (${detail})` : genericError() };
  }
  if (credential.identityToken === null) return { status: 'error', message: genericError() };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token:    credential.identityToken,
    nonce:    rawNonce,
    options:  captchaToken !== undefined ? { captchaToken } : undefined,
  });
  if (error !== null) return { status: 'error', message: error.message || genericError() };

  // Apple sends the name only on the very first sign-in: keep it so the
  // onboarding can prefill it instead of asking again.
  const fullName = appleFullName(credential.fullName);
  if (fullName !== null) void supabase.auth.updateUser({ data: { full_name: fullName } });

  // Store a refresh token server-side so account deletion can revoke the
  // Apple authorization (the code expires after 5 minutes).
  if (credential.authorizationCode !== null) {
    void supabase.functions
      .invoke('apple-auth', { body: { action: 'exchange', authorizationCode: credential.authorizationCode } })
      .then(({ error: fnError }) => {
        if (fnError !== null) console.warn('[socialAuth] apple token exchange failed:', fnError.message);
      });
  }
  return { status: 'success' };
}

// ─── Google ───────────────────────────────────────────────────────────────────

type GoogleModule = typeof import('@react-native-google-signin/google-signin');

let googleModule: GoogleModule | null = null;
let googleConfigured = false;

// The package throws on import when its native module is missing (e.g. a dev
// build from before it was added), so it is only required once present.
function loadGoogle(): GoogleModule | null {
  if (googleModule !== null) return googleModule;
  if (TurboModuleRegistry.get('RNGoogleSignin') === null) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  googleModule = require('@react-native-google-signin/google-signin') as GoogleModule;
  return googleModule;
}

export function isGoogleSignInAvailable(): boolean {
  if (GOOGLE_WEB_CLIENT_ID === '') return false;
  if (Platform.OS === 'ios' && GOOGLE_IOS_CLIENT_ID === '') return false;
  return loadGoogle() !== null;
}

export async function signInWithGoogle(captchaToken: string | undefined): Promise<SocialResult> {
  const google = loadGoogle();
  if (google === null) return { status: 'error', message: genericError() };
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } = google;

  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID !== '' ? GOOGLE_IOS_CLIENT_ID : undefined,
    });
    googleConfigured = true;
  }

  let idToken: string | null;
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) return { status: 'cancelled' };
    idToken = response.data.idToken;
  } catch (e) {
    if (isErrorWithCode(e) && (e.code === statusCodes.SIGN_IN_CANCELLED || e.code === statusCodes.IN_PROGRESS)) {
      return { status: 'cancelled' };
    }
    if (isErrorWithCode(e) && e.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      return { status: 'error', message: i18n.t('auth.social.googlePlayServices') };
    }
    return { status: 'error', message: genericError() };
  }
  if (idToken === null) return { status: 'error', message: genericError() };

  const { error } = await supabase.auth.signInWithIdToken({
    provider: 'google',
    token:    idToken,
    options:  captchaToken !== undefined ? { captchaToken } : undefined,
  });
  if (error !== null) return { status: 'error', message: error.message || genericError() };
  return { status: 'success' };
}

// ─── Account deletion ─────────────────────────────────────────────────────────

// Before delete_my_account: revokes a stored Apple authorization. Users who
// never signed in with Apple have no stored token — the function returns ok.
export async function revokeAppleAuthorization(): Promise<{ error: string | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  const usesApple = user?.identities?.some((i) => i.provider === 'apple') ?? false;
  if (!usesApple) return { error: null };
  const { error } = await supabase.functions.invoke('apple-auth', { body: { action: 'revoke' } });
  return { error: error !== null ? error.message : null };
}
