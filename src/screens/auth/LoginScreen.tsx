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
import { useCaptcha } from '../../hooks/useCaptcha';
import type { AuthStackParamList } from '../../navigation/types';
import TurnstileWidget from '../../components/auth/TurnstileWidget';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export default function LoginScreen() {
  const { signIn } = useAuth();
  const navigation = useNavigation<Nav>();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { captchaToken, setCaptchaToken, captchaKey, resetCaptcha } = useCaptcha();
  const [captchaError, setCaptchaError] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Bitte E-Mail und Passwort eingeben.');
      return;
    }
    if (captchaToken === null) {
      setError('Bitte bestätige, dass du kein Roboter bist.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: authError } = await signIn(email.trim(), password, captchaToken);
    setLoading(false);
    if (authError) {
      setError('E-Mail oder Passwort falsch.');
      resetCaptcha();
    }
    // On success, session change in AuthContext triggers navigation automatically
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
            <Text style={styles.appName}>Kombat</Text>
            <Text style={styles.headerSubtitle}>Anmelden</Text>
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
                  placeholder="Passwort"
                  placeholderTextColor={colors.inactive}
                  secureTextEntry={!showPassword}
                  autoComplete="password"
                  textContentType="password"
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

            {/* Fehler */}
            {error !== null && (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={15} color={styles.errorText.color} />
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <TurnstileWidget
              key={captchaKey}
              onToken={(t) => { setCaptchaError(false); setCaptchaToken(t); }}
              onError={() => { setCaptchaError(true); setCaptchaToken(null); }}
            />
            {captchaError && (
              <View style={styles.captchaErrorRow}>
                <Text style={styles.captchaErrorText}>Sicherheitsprüfung konnte nicht geladen werden.</Text>
                <TouchableOpacity onPress={() => { setCaptchaError(false); resetCaptcha(); }}>
                  <Text style={styles.captchaRetryLink}>Erneut versuchen</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Anmelden-Button */}
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.headerTextPrimary} />
                : <Text style={styles.buttonText}>Anmelden</Text>
              }
            </TouchableOpacity>

            {/* Link zu Registrierung */}
            <View style={styles.footerRow}>
              <Text style={styles.footerText}>Noch kein Konto? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.footerLink}>Registrieren</Text>
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
    paddingTop: 48,
    paddingBottom: 40,
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
  captchaErrorRow: {
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  captchaErrorText: {
    fontSize: 13,
    color: colors.deleteRed,
    textAlign: 'center',
  },
  captchaRetryLink: {
    fontSize: 13,
    color: colors.accentBlue,
    fontWeight: '600',
  },
});
