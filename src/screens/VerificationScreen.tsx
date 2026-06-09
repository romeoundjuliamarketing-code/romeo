import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { useVerification } from '../hooks/useVerification';
import VerifiedBadge from '../components/common/VerifiedBadge';

export default function VerificationScreen(): React.ReactElement {
  const navigation = useNavigation();
  const { flags, tier, updateAddress } = useVerification();

  const [addressDraft, setAddressDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const nachweisDone =
    flags.studio_verified || flags.coach_vouched || flags.address_verified;

  async function handleSaveAddress(): Promise<void> {
    const trimmed = addressDraft.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    await updateAddress(trimmed);
    setSaving(false);
    setAddressDraft('');
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          activeOpacity={0.7}
        >
          <Ionicons name="close" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verifizierung</Text>
        {/* Spacer to center title */}
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tier === 'verified' ? (
          // Success view
          <View style={styles.successCard}>
            <Ionicons name="checkmark-circle" size={64} color={colors.accentBlue} />
            <Text style={styles.successTitle}>Du bist verifiziert</Text>
            <Text style={styles.successSubtitle}>
              Du kannst an Sparrings teilnehmen und eigene erstellen.
            </Text>
            <VerifiedBadge tier={tier} showLabel />
          </View>
        ) : (
          <>
            {/* Intro */}
            <View style={styles.introCard}>
              <Text style={styles.introText}>
                Damit deine Sparringspartner wissen, dass du eine echte, überprüfte Person bist. Nur verifizierte Mitglieder können an Sparrings teilnehmen und eigene erstellen.
              </Text>
            </View>

            {/* Step 1: Email */}
            <View style={styles.stepCard}>
              <View style={styles.stepRow}>
                <Ionicons
                  name={flags.email_verified ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={flags.email_verified ? colors.accentBlue : colors.inactive}
                />
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>Schritt 1 – E-Mail bestätigt</Text>
                  <Text style={styles.stepHint}>
                    {flags.email_verified ? 'Bestätigt' : 'Noch nicht bestätigt'}
                  </Text>
                </View>
              </View>
            </View>

            {/* Step 2: Nachweis */}
            <View style={styles.stepCard}>
              <View style={styles.stepRow}>
                <Ionicons
                  name={nachweisDone ? 'checkmark-circle' : 'ellipse-outline'}
                  size={24}
                  color={nachweisDone ? colors.accentBlue : colors.inactive}
                />
                <View style={styles.stepContent}>
                  <Text style={styles.stepLabel}>Schritt 2 – Echtheits-Nachweis</Text>
                  {nachweisDone ? (
                    <Text style={styles.stepHint}>Bestätigt</Text>
                  ) : (
                    <>
                      <Text style={styles.stepHint}>
                        Gib deine Adresse ein – oder tritt einem Studio bei bzw. lass dich von einem Coach bestätigen.
                      </Text>
                      <View style={styles.addressRow}>
                        <TextInput
                          style={styles.addressInput}
                          value={addressDraft}
                          onChangeText={setAddressDraft}
                          placeholder="Strasse, PLZ, Ort"
                          placeholderTextColor={colors.textSecondary}
                          autoCapitalize="words"
                          returnKeyType="done"
                          onSubmitEditing={() => { void handleSaveAddress(); }}
                        />
                        <TouchableOpacity
                          style={[
                            styles.saveBtn,
                            (addressDraft.trim().length === 0 || saving) && styles.saveBtnDisabled,
                          ]}
                          onPress={() => { void handleSaveAddress(); }}
                          disabled={addressDraft.trim().length === 0 || saving}
                          activeOpacity={0.8}
                        >
                          {saving
                            ? <ActivityIndicator size="small" color={colors.card} />
                            : <Text style={styles.saveBtnText}>Speichern</Text>
                          }
                        </TouchableOpacity>
                      </View>
                    </>
                  )}
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.card,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
  },
  headerSpacer: {
    width: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 48,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
    gap: 16,
  },
  successCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    gap: 16,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  successSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  introCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  introText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 22,
  },
  stepCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepContent: {
    flex: 1,
    gap: 8,
  },
  stepLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  stepHint: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  addressRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  addressInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  saveBtn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 88,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
});
