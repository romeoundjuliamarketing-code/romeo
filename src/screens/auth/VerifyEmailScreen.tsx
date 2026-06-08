import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import type { AuthStackParamList } from '../../navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'VerifyEmail'>;
type Rt = RouteProp<AuthStackParamList, 'VerifyEmail'>;

export default function VerifyEmailScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Rt>();
  const { email } = route.params;

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  const handleVerify = async () => {
    if (code.trim().length !== 6) {
      setError('Bitte gib den 6-stelligen Code ein.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: otpError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'signup',
    });
    setLoading(false);
    if (otpError) {
      setError('Code ungültig oder abgelaufen. Bitte erneut versuchen.');
    }
    // On success the auth state listener establishes the session and navigates onward.
  };

  const handleResend = async () => {
    setError(null);
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email });
    if (resendError) {
      setError('Code konnte nicht erneut gesendet werden. Bitte kurz warten.');
    } else {
      setResent(true);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={22} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>E-Mail bestätigen</Text>
          <Text style={styles.subtitle}>Wir haben einen 6-stelligen Code an {email} geschickt.</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Bestätigungscode</Text>
            <View style={styles.inputRow}>
              <Ionicons name="shield-checkmark-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={setCode}
                placeholder="123456"
                placeholderTextColor={colors.inactive}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
            </View>
          </View>

          {error !== null && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.deleteRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            activeOpacity={0.8}
            disabled={loading}
          >
            {loading
              ? <ActivityIndicator color={colors.headerTextPrimary} />
              : <Text style={styles.buttonText}>Bestätigen</Text>}
          </TouchableOpacity>

          <TouchableOpacity onPress={handleResend} style={styles.resendButton}>
            <Text style={styles.resendText}>{resent ? 'Code erneut gesendet' : 'Code erneut senden'}</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.headerBg },
  flex: { flex: 1 },
  header: { paddingHorizontal: 24, paddingTop: 40, paddingBottom: 40 },
  backButton: { marginBottom: 16, alignSelf: 'flex-start' },
  title: { fontSize: 28, fontWeight: '800', color: colors.headerTextPrimary, letterSpacing: -0.5, marginBottom: 8 },
  subtitle: { fontSize: 15, color: colors.headerTextSecondary, lineHeight: 22 },
  card: {
    flex: 1, backgroundColor: colors.background,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingTop: 32, paddingBottom: 48,
  },
  fieldGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.text, marginBottom: 8 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 16, height: 52,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 18, color: colors.text, letterSpacing: 4 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 16 },
  errorText: { fontSize: 13, color: colors.deleteRed, flex: 1 },
  button: {
    backgroundColor: colors.headerBg, borderRadius: 12, height: 52,
    alignItems: 'center', justifyContent: 'center', marginTop: 8, marginBottom: 16,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: colors.headerTextPrimary, fontSize: 15, fontWeight: '700', letterSpacing: 0.2 },
  resendButton: { alignItems: 'center', paddingVertical: 8 },
  resendText: { fontSize: 14, color: colors.accentBlue, fontWeight: '600' },
});
