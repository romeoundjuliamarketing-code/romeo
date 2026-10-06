import React, { useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import { useCaptcha } from '../../hooks/useCaptcha';
import { requestPasswordReset } from '../../lib/passwordReset';
import type { AuthStackParamList } from '../../navigation/types';
import TurnstileWidget from '../../components/auth/TurnstileWidget';
import SocialSignInButtons from '../../components/auth/SocialSignInButtons';
import AuthTextField from '../../components/auth/AuthTextField';
import { AuthCaptchaNotice } from '../../components/auth/AuthScaffold';
import LoginScaffold, { LoginNotice, LoginSwitch } from '../../components/auth/LoginScaffold';
import LoginButton from '../../components/auth/LoginButton';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<Nav>();
  const passwordRef = useRef<TextInput>(null);
  // Blocks a second sign-in from a double tap before the busy state renders.
  const signingIn = useRef(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [resetSending, setResetSending] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { captchaToken, setCaptchaToken, captchaKey, resetCaptcha } = useCaptcha();
  const [captchaError, setCaptchaError] = useState(false);

  const handleLogin = async () => {
    const missingEmail = !email.trim();
    const missingPassword = !password;
    setEmailError(missingEmail ? 'Bitte gib deine E-Mail-Adresse ein.' : null);
    setPasswordError(missingPassword ? 'Bitte gib dein Passwort ein.' : null);
    setFormError(null);
    if (missingEmail || missingPassword) return;
    if (signingIn.current) return;

    signingIn.current = true;
    setLoading(true);
    // Captcha is best-effort: pass the token if the widget produced one, but
    // never block the login when it failed to load (e.g. datacenter networks).
    const { error: authError } = await signIn(email.trim(), password, captchaToken ?? undefined);
    signingIn.current = false;
    setLoading(false);
    if (authError) {
      setFormError('E-Mail oder Passwort falsch.');
      resetCaptcha();
    }
    // On success, session change in AuthContext triggers navigation automatically
  };

  // Same reset flow as in the settings (sparr://reset-password is handled by
  // RootNavigator's recovery screen). The reply never reveals whether an
  // account exists.
  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setEmailError('Gib deine E-Mail-Adresse ein, dann schicken wir dir einen Link.');
      return;
    }
    setEmailError(null);
    setFormError(null);
    setResetSending(true);
    const { error } = await requestPasswordReset(email.trim(), captchaToken ?? undefined);
    setResetSending(false);
    resetCaptcha();
    if (error !== null) {
      setFormError('Der Link konnte gerade nicht gesendet werden. Bitte versuche es gleich noch einmal.');
      return;
    }
    setResetSent(true);
  };

  return (
    <LoginScaffold
      titleLead="Bereit für die"
      titleAccent="nächste Runde?"
      subtitle="Melde dich an und finde dein nächstes Sparring."
    >
      <AuthTextField
        variant="warm"
        label="E-Mail"
        icon="mail-outline"
        value={email}
        onChangeText={(v) => { setEmail(v); setEmailError(null); setResetSent(false); }}
        error={emailError}
        placeholder="deine@email.de"
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />

      <View style={styles.passwordBlock}>
        <AuthTextField
          variant="warm"
          inputRef={passwordRef}
          label="Passwort"
          icon="lock-closed-outline"
          isPassword
          value={password}
          onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
          error={passwordError}
          placeholder="Dein Passwort"
          autoComplete="password"
          textContentType="password"
          returnKeyType="go"
          onSubmitEditing={() => { void handleLogin(); }}
        />
        <TouchableOpacity
          style={styles.forgot}
          onPress={() => { void handleForgotPassword(); }}
          disabled={resetSending}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
        >
          {resetSending
            ? <ActivityIndicator size="small" color={colors.accentBlueText} />
            : <Text style={styles.forgotText}>Passwort vergessen?</Text>}
        </TouchableOpacity>
      </View>

      {resetSent && (
        <LoginNotice
          tone="info"
          text={`Falls ein Konto zu ${email.trim()} existiert, haben wir dir einen Link zum Zurücksetzen geschickt.`}
        />
      )}
      {formError !== null && <LoginNotice tone="error" text={formError} />}

      {/* Visible security check: it produces the token the sign-in sends, so it
          sits right before the button. Best-effort — never blocks the login. */}
      <TurnstileWidget
        key={captchaKey}
        size="flexible"
        containerStyle={styles.captcha}
        onToken={(t) => { setCaptchaError(false); setCaptchaToken(t); }}
        onError={() => { setCaptchaError(true); setCaptchaToken(null); }}
      />
      {captchaError && (
        <AuthCaptchaNotice actionLabel="anmelden" onRetry={() => { setCaptchaError(false); resetCaptcha(); }} />
      )}

      <View style={styles.actions}>
        <LoginButton label="Anmelden" loading={loading} onPress={() => { void handleLogin(); }} />
        <SocialSignInButtons captchaToken={captchaToken ?? undefined} onCaptchaUsed={resetCaptcha} />
        <LoginSwitch text="Neu bei Sparr?" link="Registrieren" onPress={() => navigation.navigate('Register')} />
      </View>
    </LoginScaffold>
  );
}

const styles = StyleSheet.create({
  captcha: {
    // Spacing comes from the form gap.
    marginBottom: 0,
  },
  passwordBlock: {
    gap: 8,
  },
  forgot: {
    alignSelf:       'flex-end',
    minHeight:       44,
    justifyContent:  'center',
  },
  forgotText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlueText,
  },
  actions: {
    gap: 8,
  },
});
