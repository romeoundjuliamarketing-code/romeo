import React, { useRef, useState } from 'react';
import { TextInput, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../../context/AuthContext';
import { useCaptcha } from '../../hooks/useCaptcha';
import type { AuthStackParamList } from '../../navigation/types';
import TurnstileWidget from '../../components/auth/TurnstileWidget';
import SocialSignInButtons from '../../components/auth/SocialSignInButtons';
import AuthTextField from '../../components/auth/AuthTextField';
import AuthScaffold, { AuthButton, AuthCaptchaNotice, AuthNotice, AuthSwitch } from '../../components/auth/AuthScaffold';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const navigation = useNavigation<Nav>();
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const { captchaToken, setCaptchaToken, captchaKey, resetCaptcha } = useCaptcha();
  const [captchaError, setCaptchaError] = useState(false);

  const handleRegister = async () => {
    // Same checks as before, now shown at the field they belong to.
    const nextEmailError = !email.trim() ? 'Bitte gib deine E-Mail-Adresse ein.' : null;
    const nextPasswordError = !password
      ? 'Bitte wähle ein Passwort.'
      : password.length < 6 ? 'Das Passwort muss mindestens 6 Zeichen haben.' : null;
    const nextConfirmError = nextPasswordError === null && password !== passwordConfirm
      ? 'Die Passwörter stimmen nicht überein.'
      : null;
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setConfirmError(nextConfirmError);
    setFormError(null);
    if (nextEmailError !== null || nextPasswordError !== null || nextConfirmError !== null) return;

    setLoading(true);
    // Captcha is best-effort: pass the token if the widget produced one, but
    // never block registration when it failed to load (e.g. datacenter networks).
    const { error: authError } = await signUp(email.trim(), password, captchaToken ?? undefined);
    setLoading(false);
    if (authError) {
      console.error('[RegisterScreen] signUp error:', authError.message, authError.status);
      if (authError.message === 'User already registered') {
        setEmailError('Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.');
      } else {
        setFormError('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      }
      resetCaptcha();
    } else {
      navigation.navigate('VerifyEmail', { email: email.trim() });
    }
  };

  return (
    <AuthScaffold
      title="Konto erstellen"
      subtitle="In einer Minute bist du dabei – finde Sparrings und trainiere mit anderen."
      onBack={() => navigation.goBack()}
      footer={(
        <AuthSwitch text="Bereits registriert?" link="Anmelden" onPress={() => navigation.navigate('Login')} />
      )}
    >
      <AuthTextField
        label="E-Mail"
        icon="mail-outline"
        value={email}
        onChangeText={(v) => { setEmail(v); setEmailError(null); }}
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

      <AuthTextField
        inputRef={passwordRef}
        label="Passwort"
        icon="lock-closed-outline"
        isPassword
        value={password}
        onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
        error={passwordError}
        placeholder="Mindestens 6 Zeichen"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />

      <AuthTextField
        inputRef={confirmRef}
        label="Passwort bestätigen"
        icon="lock-closed-outline"
        isPassword
        value={passwordConfirm}
        onChangeText={(v) => { setPasswordConfirm(v); setConfirmError(null); }}
        error={confirmError}
        placeholder="Passwort wiederholen"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={() => { void handleRegister(); }}
      />

      {formError !== null && <AuthNotice tone="error" text={formError} />}

      <TurnstileWidget
        key={captchaKey}
        size="flexible"
        containerStyle={styles.captcha}
        onToken={(t) => { setCaptchaError(false); setCaptchaToken(t); }}
        onError={() => { setCaptchaError(true); setCaptchaToken(null); }}
      />
      {captchaError && (
        <AuthCaptchaNotice actionLabel="registrieren" onRetry={() => { setCaptchaError(false); resetCaptcha(); }} />
      )}

      <AuthButton label="Konto erstellen" loading={loading} onPress={() => { void handleRegister(); }} />
      <SocialSignInButtons captchaToken={captchaToken ?? undefined} onCaptchaUsed={resetCaptcha} />
    </AuthScaffold>
  );
}

const styles = StyleSheet.create({
  captcha: {
    // Spacing comes from the form gap.
    marginBottom: 0,
  },
});
