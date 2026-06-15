import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  FlatList,
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
import { supabase } from '../../lib/supabase';
import { useStudioCoaches } from '../../hooks/useStudioCoaches';
import type { RootStackParamList } from '../../navigation/types';

const CARD_SIZE = 80;

interface StudioMember {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

// "pick member" step vs. "set role" step inside the picker modal
type PickerStep = 'member' | 'role';

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
  const { coaches, loading, addCoach, removeCoach } = useStudioCoaches(studioId);

  // Picker modal state
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerStep, setPickerStep] = useState<PickerStep>('member');
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [selectedMember, setSelectedMember] = useState<StudioMember | null>(null);
  const [roleText, setRoleText] = useState('');
  const [adding, setAdding] = useState(false);

  const alreadyCoachIds = new Set(coaches.map((c) => c.userId));

  const loadMembers = useCallback(async (): Promise<void> => {
    setMembersLoading(true);
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, avatar_url')
      .eq('studio_id', studioId);
    if (error !== null) {
      Alert.alert('Fehler', 'Mitglieder konnten nicht geladen werden.');
    }
    setMembers((data ?? []) as StudioMember[]);
    setMembersLoading(false);
  }, [studioId]);

  function openPicker(): void {
    setPickerStep('member');
    setSelectedMember(null);
    setRoleText('');
    setPickerVisible(true);
    void loadMembers();
  }

  function closePicker(): void {
    setPickerVisible(false);
    setPickerStep('member');
    setSelectedMember(null);
    setRoleText('');
  }

  function handleSelectMember(member: StudioMember): void {
    setSelectedMember(member);
    setPickerStep('role');
  }

  async function handleAddCoach(): Promise<void> {
    if (selectedMember === null) return;
    setAdding(true);
    const role = roleText.trim().length > 0 ? roleText.trim() : null;
    const { error } = await addCoach(selectedMember.id, role);
    setAdding(false);
    if (error !== null) {
      Alert.alert('Fehler', error);
      return;
    }
    closePicker();
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

  const pickableMembers = members.filter((m) => !alreadyCoachIds.has(m.id));

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
              {coach.role !== null && (
                <Text style={styles.coachRole} numberOfLines={1}>{coach.role}</Text>
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
            onPress={openPicker}
          >
            <View style={styles.addIconWrap}>
              <Ionicons name="add" size={28} color={colors.accentBlue} />
            </View>
            <Text style={styles.addLabel}>Coach{'\n'}hinzufügen</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Picker Modal */}
      <Modal
        visible={pickerVisible}
        animationType="slide"
        transparent
        onRequestClose={closePicker}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={closePicker}
        />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.sheetWrapper}
        >
          <View style={styles.pickerSheet}>
            <View style={styles.pickerHandle} />

            {pickerStep === 'member' ? (
              <>
                <Text style={styles.pickerTitle}>Coach hinzufügen</Text>
                {membersLoading ? (
                  <ActivityIndicator color={colors.accentBlue} style={styles.pickerLoader} />
                ) : pickableMembers.length === 0 ? (
                  <Text style={styles.emptyText}>Keine weiteren Mitglieder verfügbar.</Text>
                ) : (
                  <FlatList
                    data={pickableMembers}
                    keyExtractor={(item) => item.id}
                    style={styles.memberList}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.memberRow}
                        activeOpacity={0.8}
                        onPress={() => handleSelectMember(item)}
                      >
                        {item.avatar_url !== null ? (
                          <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                        ) : (
                          <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                            <Text style={styles.memberInitials}>
                              {getInitials(item.name)}
                            </Text>
                          </View>
                        )}
                        <Text style={styles.memberName}>{item.name ?? 'Unbekannt'}</Text>
                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                      </TouchableOpacity>
                    )}
                  />
                )}
              </>
            ) : (
              <>
                {/* Role step */}
                <TouchableOpacity onPress={() => setPickerStep('member')} style={styles.backRow}>
                  <Ionicons name="chevron-back" size={18} color={colors.accentBlue} />
                  <Text style={styles.backText}>Zurück</Text>
                </TouchableOpacity>
                <Text style={styles.pickerTitle}>Rolle festlegen</Text>

                {selectedMember !== null && (
                  <View style={styles.selectedMemberRow}>
                    {selectedMember.avatar_url !== null ? (
                      <Image source={{ uri: selectedMember.avatar_url }} style={styles.memberAvatar} />
                    ) : (
                      <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                        <Text style={styles.memberInitials}>
                          {getInitials(selectedMember.name)}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.memberName}>{selectedMember.name ?? 'Unbekannt'}</Text>
                  </View>
                )}

                <Text style={styles.roleLabel}>Rolle (optional)</Text>
                <TextInput
                  style={styles.roleInput}
                  value={roleText}
                  onChangeText={setRoleText}
                  placeholder="z.B. Head Coach"
                  placeholderTextColor={colors.textSecondary}
                  returnKeyType="done"
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.addBtn, adding && styles.addBtnDisabled]}
                  onPress={() => { void handleAddCoach(); }}
                  disabled={adding}
                  activeOpacity={0.85}
                >
                  {adding ? (
                    <ActivityIndicator size="small" color={colors.card} />
                  ) : (
                    <Text style={styles.addBtnText}>Hinzufügen</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
  },
  // Modal
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  sheetWrapper: {
    // allows KeyboardAvoidingView to push sheet up
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '65%',
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
  pickerLoader: {
    marginVertical: 24,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 16,
  },
  memberList: {
    maxHeight: 320,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  memberAvatarPlaceholder: {
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memberInitials: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  memberName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  // Role step
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  backText: {
    fontSize: 14,
    color: colors.accentBlue,
    fontWeight: '500',
  },
  selectedMemberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  roleLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
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
