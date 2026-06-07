import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { useAuth } from '../../context/AuthContext';
import type { AuthStackParamList } from '../../navigation/types';
import TurnstileWidget from '../../components/auth/TurnstileWidget';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export default function RegisterScreen() {
  const { signUp } = useAuth();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Turnstile tokens are single-use; bump this to remount the widget for a fresh token.
  const [captchaKey, setCaptchaKey] = useState(0);

  const resetCaptcha = () => {
    setCaptchaToken(null);
    setCaptchaKey(k => k + 1);
  };

  const handleRegister = async () => {
    if (!email.trim() || !password) {
      setError('Bitte alle Felder ausfullen.');
      return;
    }
    if (password.length < 6) {
      setError('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }
    if (password !== passwordConfirm) {
      setError('Passworter stimmen nicht uberein.');
      return;
    }
    if (captchaToken === null) {
      setError('Bitte bestätige, dass du kein Roboter bist.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await signUp(email.trim(), password, captchaToken);
    setLoading(false);
    if (authError) {
      console.error('[RegisterScreen] signUp error:', authError.message, authError.status);
      if (authError.message === 'User already registered') {
        setError('Diese E-Mail-Adresse ist bereits registriert. Bitte melde dich an.');
      } else {
        setError('Registrierung fehlgeschlagen. Bitte versuche es erneut.');
      }
      resetCaptcha();
    } else {
      navigation.navigate('VerifyEmail', { email: email.trim() });
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* ── Dark header ── */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={22} color={colors.headerTextPrimary} />
            </TouchableOpacity>
            <Text style={styles.appName}>Kombat</Text>
            <Text style={styles.headerSubtitle}>Konto erstellen</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Email */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>E-Mail</Text>
              <View style={styles.inputRow}>
                <Ionicons name="mail-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="deine@email.de"
                  placeholderTextColor={colors.inactive}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  textContentType="emailAddress"
                />
              </View>
            </View>

            {/* Passwort */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Passwort</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mindestens 6 Zeichen"
                  placeholderTextColor={colors.inactive}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
                <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeButton}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.inactive}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Passwort bestatigen */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Passwort bestatigen</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={passwordConfirm}
                  onChangeText={setPasswordConfirm}
                  placeholder="Passwort wiederholen"
                  placeholderTextColor={colors.inactive}
                  secureTextEntry={!showPassword}
                  autoComplete="new-password"
                  textContentType="newPassword"
                />
              </View>
            </View>

            {/* Fehler */}
            {error !== null && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={styles.errorText.color} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TurnstileWidget key={captchaKey} onToken={setCaptchaToken} />

            {/* Registrieren-Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.headerTextPrimary} />
                : <Text style={styles.buttonText}>Konto erstellen</Text>
              }
            </TouchableOpacity>

            {/* Link zu Login */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Bereits registriert? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Login')}>
                <Text style={styles.footerLink}>Anmelden</Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.headerBg,
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },

  // Dark header
  header: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  backButton: {
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: colors.headerTextPrimary,
    letterSpacing: -1,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },

  // Form card (light)
  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },

  // Field
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
  },
  eyeButton: {
    padding: 4,
  },

  // Error
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 13,
    color: colors.deleteRed,
    flex: 1,
  },

  // Button
  button: {
    backgroundColor: colors.headerBg,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 24,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.headerTextPrimary,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // Footer
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  footerLink: {
    fontSize: 14,
    color: colors.accentBlue,
    fontWeight: '600',
  },
});
