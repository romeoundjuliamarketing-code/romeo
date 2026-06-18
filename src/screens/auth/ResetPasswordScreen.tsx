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
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (): Promise<void> => {
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Das Passwort muss mindestens ${MIN_PASSWORD_LENGTH} Zeichen lang sein.`);
      return;
    }
    if (password !== confirm) {
      setError('Die Passwörter stimmen nicht überein.');
      return;
    }
    setError(null);
    setLoading(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setLoading(false);

    if (updateError !== null) {
      setError('Passwort konnte nicht geändert werden. Bitte fordere einen neuen Link an.');
      return;
    }

    Alert.alert(
      'Passwort geändert',
      'Dein Passwort wurde erfolgreich aktualisiert.',
      [{ text: 'OK', onPress: onDone }],
    );
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

          {/* Dark header */}
          <View style={styles.header}>
            <Text style={styles.appName}>Sparr</Text>
            <Text style={styles.headerSubtitle}>Neues Passwort festlegen</Text>
          </View>

          {/* Form card */}
          <View style={styles.card}>

            {/* Neues Passwort */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Neues Passwort</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Mindestens 8 Zeichen"
                  placeholderTextColor={colors.inactive}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

            {/* Bestätigen */}
            <View style={styles.fieldGroup}>
              <Text style={styles.label}>Passwort bestätigen</Text>
              <View style={styles.inputRow}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.inactive} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={confirm}
                  onChangeText={setConfirm}
                  placeholder="Passwort wiederholen"
                  placeholderTextColor={colors.inactive}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
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

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={() => { void handleSubmit(); }}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={colors.headerTextPrimary} />
                : <Text style={styles.buttonText}>Passwort speichern</Text>
              }
            </TouchableOpacity>

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

  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 48,
  },

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

  button: {
    backgroundColor: colors.headerBg,
    borderRadius: 12,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
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
});
