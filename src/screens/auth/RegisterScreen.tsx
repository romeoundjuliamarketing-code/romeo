import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
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
    const nextEmailError = !email.trim() ? t('auth.register.errorEmailMissing') : null;
    const nextPasswordError = !password
      ? t('auth.register.errorPasswordMissing')
      : password.length < 6 ? t('auth.register.errorPasswordShort') : null;
    const nextConfirmError = nextPasswordError === null && password !== passwordConfirm
      ? t('auth.register.errorMismatch')
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
        setEmailError(t('auth.register.errorEmailTaken'));
      } else {
        setFormError(t('auth.register.errorFailed'));
      }
      resetCaptcha();
    } else {
      navigation.navigate('VerifyEmail', { email: email.trim() });
    }
  };

  return (
    <AuthScaffold
      title={t('auth.register.title')}
      subtitle={t('auth.register.subtitle')}
      onBack={() => navigation.goBack()}
      footer={(
        <AuthSwitch text={t('auth.register.alreadyRegistered')} link={t('auth.register.login')} onPress={() => navigation.navigate('Login')} />
      )}
    >
      <AuthTextField
        label={t('auth.register.emailLabel')}
        icon="mail-outline"
        value={email}
        onChangeText={(v) => { setEmail(v); setEmailError(null); }}
        error={emailError}
        placeholder={t('auth.register.emailPlaceholder')}
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
        label={t('auth.register.passwordLabel')}
        icon="lock-closed-outline"
        isPassword
        value={password}
        onChangeText={(v) => { setPassword(v); setPasswordError(null); }}
        error={passwordError}
        placeholder={t('auth.register.passwordPlaceholder')}
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        submitBehavior="submit"
      />

      <AuthTextField
        inputRef={confirmRef}
        label={t('auth.register.confirmLabel')}
        icon="lock-closed-outline"
        isPassword
        value={passwordConfirm}
        onChangeText={(v) => { setPasswordConfirm(v); setConfirmError(null); }}
        error={confirmError}
        placeholder={t('auth.register.confirmPlaceholder')}
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
        <AuthCaptchaNotice actionLabel={t('auth.register.captchaAction')} onRetry={() => { setCaptchaError(false); resetCaptcha(); }} />
      )}

      <AuthButton label={t('auth.register.submit')} loading={loading} onPress={() => { void handleRegister(); }} />
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
