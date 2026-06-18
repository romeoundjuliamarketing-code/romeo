import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';
import { useStudioRequests } from '../../hooks/useStudioRequests';
import { useAnnouncement } from '../../hooks/useAnnouncement';
import { useSparringActions } from '../../hooks/useSparringActions';
import CreateSparringSheet from '../sparring/CreateSparringSheet';

// ── Announcement duration helpers (ported from TeamScreen) ────────────────────

type AnnouncementDuration = '1d' | '3d' | '1w' | 'forever';

type AnnouncementDurationOption = {
  value: AnnouncementDuration;
  label: string;
};

const ANNOUNCEMENT_DURATION_OPTIONS: AnnouncementDurationOption[] = [
  { value: '1d', label: '1 Tag' },
  { value: '3d', label: '3 Tage' },
  { value: '1w', label: '1 Woche' },
  { value: 'forever', label: 'Dauerhaft' },
];

function durationToExpiresAt(duration: AnnouncementDuration): string | null {
  if (duration === 'forever') return null;
  const daysByDuration: Record<Exclude<AnnouncementDuration, 'forever'>, number> = {
    '1d': 1, '3d': 3, '1w': 7,
  };
  return new Date(Date.now() + daysByDuration[duration] * 24 * 60 * 60 * 1000).toISOString();
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  studioId: string;
  studioName: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function StudioOwnerBar({ studioId, studioName }: Props): React.ReactElement {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  // Requests badge count
  const requests = useStudioRequests(studioId);
  const requestCount =
    requests.trialBookings.length +
    requests.dropInBookings.length +
    requests.membershipRequests.length +
    requests.cancellationRequests.length +
    requests.joinRequests.length;

  // Announcement modal
  const { announcement, postAnnouncement, deleteAnnouncement } = useAnnouncement();
  const [announcementVisible, setAnnouncementVisible] = useState(false);
  const [announcementDraft, setAnnouncementDraft] = useState('');
  const [announcementDuration, setAnnouncementDuration] = useState<AnnouncementDuration>('forever');
  const [announcementPosting, setAnnouncementPosting] = useState(false);

  // Sparring sheet
  const { createSparring } = useSparringActions();
  const [sparringSheetVisible, setSparringSheetVisible] = useState(false);

  async function handlePostAnnouncement(): Promise<void> {
    if (announcementDraft.trim().length === 0) return;
    setAnnouncementPosting(true);
    const result = await postAnnouncement(announcementDraft, durationToExpiresAt(announcementDuration));
    setAnnouncementPosting(false);
    if (result.error !== null) { Alert.alert('Fehler', result.error); return; }
    setAnnouncementDraft('');
    setAnnouncementDuration('forever');
    setAnnouncementVisible(false);
  }

  async function handleDeleteAnnouncement(): Promise<void> {
    const result = await deleteAnnouncement();
    if (result.error !== null) Alert.alert('Fehler', result.error);
  }

  return (
    <View style={styles.container}>
      {/* Anfragen */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('StudioRequests', { studioId })}
      >
        <MaterialCommunityIcons name="inbox-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Anfragen</Text>
        {requestCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{requestCount}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Mitglieder */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('StudioMembers', { studioId, studioName })}
      >
        <MaterialCommunityIcons name="account-group-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Mitglieder</Text>
      </TouchableOpacity>

      {/* Code */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={() => navigation.navigate('StudioInvite', { studioId })}
      >
        <MaterialCommunityIcons name="key-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Code</Text>
      </TouchableOpacity>

      {/* Ankündigung */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={() => setAnnouncementVisible(true)}
      >
        <MaterialCommunityIcons name="bullhorn-outline" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Ankündigung</Text>
      </TouchableOpacity>

      {/* Sparring planen */}
      <TouchableOpacity
        style={styles.chip}
        activeOpacity={0.8}
        onPress={() => setSparringSheetVisible(true)}
      >
        <MaterialCommunityIcons name="calendar-plus" size={16} color={colors.textPrimary} />
        <Text style={styles.chipLabel}>Sparring planen</Text>
      </TouchableOpacity>

      {/* ── Announcement Modal ──────────────────────────────────────────────── */}
      <Modal
        visible={announcementVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAnnouncementVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => setAnnouncementVisible(false)}
          />
          <View style={styles.sheet}>
            <View style={styles.announcementHeader}>
              <Text style={styles.sheetTitle}>Ankündigung</Text>
              {announcement !== null && (
                <TouchableOpacity
                  onPress={() => {
                    void handleDeleteAnnouncement();
                    setAnnouncementVisible(false);
                  }}
                >
                  <Text style={styles.deleteAnnouncementLabel}>Löschen</Text>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={styles.announcementInput}
              placeholder="Nachricht für dein Team..."
              placeholderTextColor={colors.textSecondary}
              value={announcementDraft}
              onChangeText={setAnnouncementDraft}
              multiline
              maxLength={500}
              autoFocus
            />
            <View style={styles.durationSection}>
              <Text style={styles.durationLabel}>Sichtbar für</Text>
              <View style={styles.durationRow}>
                {ANNOUNCEMENT_DURATION_OPTIONS.map((option) => {
                  const selected = option.value === announcementDuration;
                  return (
                    <TouchableOpacity
                      key={option.value}
                      style={[styles.durationChip, selected && styles.durationChipActive]}
                      onPress={() => setAnnouncementDuration(option.value)}
                      activeOpacity={0.8}
                    >
                      <Text style={[styles.durationChipLabel, selected && styles.durationChipLabelActive]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={styles.charCount}>{announcementDraft.length}/500</Text>
            <TouchableOpacity
              style={[styles.postBtn, announcementDraft.trim().length === 0 && styles.postBtnDisabled]}
              onPress={() => { void handlePostAnnouncement(); }}
              disabled={announcementPosting || announcementDraft.trim().length === 0}
              activeOpacity={0.8}
            >
              {announcementPosting ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.postBtnLabel}>Veröffentlichen</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Sparring Sheet ──────────────────────────────────────────────────── */}
      <CreateSparringSheet
        visible={sparringSheetVisible}
        studioId={studioId}
        onClose={() => setSparringSheetVisible(false)}
        onCreate={async (params) => {
          const { error } = await createSparring(params);
          if (error !== null) Alert.alert('Fehler', error);
        }}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },

  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },

  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.deleteRed,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.card,
  },

  // Modal overlay
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 10,
  },
  sheetTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },

  // Announcement modal
  announcementHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  deleteAnnouncementLabel: { fontSize: 14, fontWeight: '600', color: colors.deleteRed },
  announcementInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    color: colors.textPrimary,
    minHeight: 96,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: colors.border,
  },
  durationSection: { gap: 8, marginTop: 16 },
  durationLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  durationRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  durationChip: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  durationChipActive: { backgroundColor: colors.dark, borderColor: colors.dark },
  durationChipLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  durationChipLabelActive: { color: colors.card },
  charCount: { fontSize: 11, color: colors.textSecondary, textAlign: 'right', marginTop: 4 },
  postBtn: {
    height: 52,
    borderRadius: 14,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  postBtnDisabled: { opacity: 0.4 },
  postBtnLabel: { fontSize: 15, fontWeight: '700', color: colors.card },
});
