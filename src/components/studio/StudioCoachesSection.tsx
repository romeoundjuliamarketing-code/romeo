import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import { useStudioCoaches } from '../../hooks/useStudioCoaches';
import type { StudioCoach } from '../../hooks/useStudioCoaches';
import MemberMultiPickerSheet from './MemberMultiPickerSheet';
import type { RootStackParamList } from '../../navigation/types';

const CARD_SIZE = 80;

interface Props {
  studioId: string;
  canManage: boolean;
  currentUserId: string | null;
}

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function StudioCoachesSection({
  studioId,
  canManage,
  currentUserId,
}: Props): React.ReactElement | null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { coaches, loading, addCoaches, updateCoachRole, removeCoach } = useStudioCoaches(studioId);

  // Add-coaches picker
  const [pickerVisible, setPickerVisible] = useState(false);

  // Role-edit modal
  const [roleEditCoach, setRoleEditCoach] = useState<StudioCoach | null>(null);
  const [roleEditText, setRoleEditText] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  function openRoleEditor(coach: StudioCoach): void {
    setRoleEditCoach(coach);
    setRoleEditText(coach.role ?? '');
  }

  function closeRoleEditor(): void {
    setRoleEditCoach(null);
    setRoleEditText('');
  }

  async function handleSaveRole(): Promise<void> {
    if (roleEditCoach === null) return;
    setSavingRole(true);
    const role = roleEditText.trim().length > 0 ? roleEditText.trim() : null;
    const { error } = await updateCoachRole(roleEditCoach.userId, role);
    setSavingRole(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    closeRoleEditor();
  }

  function handleRemoveCoach(userId: string): void {
    Alert.alert(
      'Coach entfernen',
      'Möchtest du diesen Coach entfernen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Entfernen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await removeCoach(userId);
            if (error !== null) Alert.alert('Fehler', error);
          },
        },
      ],
    );
  }

  // Hide section from visitors when no coaches present
  if (coaches.length === 0 && !canManage) return null;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, styles.sectionLabelPad]}>Trainer</Text>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.row}
      >
        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={colors.accentBlue} />
          </View>
        ) : (
          coaches.map((coach) => (
            <TouchableOpacity
              key={coach.id}
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => navigation.navigate('PublicProfile', { userId: coach.userId })}
            >
              {coach.avatarUrl !== null ? (
                <Image source={{ uri: coach.avatarUrl }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.initials}>{getInitials(coach.name)}</Text>
                </View>
              )}
              <Text style={styles.coachName} numberOfLines={1}>
                {coach.name ?? 'Unbekannt'}
              </Text>
              {canManage ? (
                <TouchableOpacity
                  style={styles.rolePill}
                  activeOpacity={0.7}
                  onPress={() => openRoleEditor(coach)}
                >
                  <Text style={styles.rolePillText} numberOfLines={1}>
                    {coach.role !== null ? coach.role : '+ Rolle'}
                  </Text>
                  <Ionicons name="pencil" size={12} color={colors.accentBlue} />
                </TouchableOpacity>
              ) : (
                coach.role !== null && (
                  <Text style={styles.coachRole} numberOfLines={1}>{coach.role}</Text>
                )
              )}
              {canManage && (
                <TouchableOpacity
                  style={styles.removeBtn}
                  onPress={() => handleRemoveCoach(coach.userId)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close-circle" size={20} color={colors.deleteRed} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>
          ))
        )}

        {canManage && (
          <TouchableOpacity
            style={[styles.card, styles.addCard]}
            activeOpacity={0.75}
            onPress={() => setPickerVisible(true)}
          >
            <View style={styles.addIconWrap}>
              <Ionicons name="add" size={28} color={colors.accentBlue} />
            </View>
            <Text style={styles.addLabel}>Coaches{'\n'}hinzufügen</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      <MemberMultiPickerSheet
        visible={pickerVisible}
        studioId={studioId}
        excludeIds={coaches.map((c) => c.userId)}
        title="Coaches hinzufügen"
        onClose={() => setPickerVisible(false)}
        onConfirm={async (ids) => {
          const { error } = await addCoaches(ids);
          if (error !== null) Alert.alert('Fehler', error);
        }}
      />

      {/* Role-edit modal */}
      <Modal
        visible={roleEditCoach !== null}
        animationType="slide"
        transparent
        onRequestClose={closeRoleEditor}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.overlay}
        >
          <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={closeRoleEditor} />
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />
            <Text style={styles.pickerTitle}>Rolle festlegen</Text>
            <TextInput
              style={styles.roleInput}
              value={roleEditText}
              onChangeText={setRoleEditText}
              placeholder="z.B. Head Coach"
              placeholderTextColor={colors.textSecondary}
              returnKeyType="done"
              autoFocus
            />
            <TouchableOpacity
              style={[styles.addBtn, savingRole && styles.addBtnDisabled]}
              onPress={() => { void handleSaveRole(); }}
              disabled={savingRole}
              activeOpacity={0.85}
            >
              {savingRole ? (
                <ActivityIndicator size="small" color={colors.card} />
              ) : (
                <Text style={styles.addBtnText}>Speichern</Text>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabelPad: {
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loaderWrap: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: CARD_SIZE + 16,
    alignItems: 'center',
    gap: 6,
  },
  addCard: {
    justifyContent: 'center',
  },
  addIconWrap: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    borderWidth: 1.5,
    borderColor: colors.accentBlueMuted,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlueSoft,
  },
  addLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentBlue,
    textAlign: 'center',
    width: CARD_SIZE + 16,
  },
  avatar: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
  },
  avatarPlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  coachName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    width: CARD_SIZE + 16,
  },
  coachRole: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: CARD_SIZE + 16,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: colors.accentBlueSoft,
  },
  rolePillText: {
    flexShrink: 1,
    fontSize: 11,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
  },
  // Modal
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.mapOverlay,
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  pickerHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 16,
  },
  pickerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 16,
  },
  roleInput: {
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.background,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
  },
  addBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnDisabled: {
    opacity: 0.6,
  },
  addBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
