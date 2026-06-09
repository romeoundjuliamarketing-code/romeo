import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as base64Decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { colors } from '../theme/colors';
import { supabase } from '../lib/supabase';
import { useStudioProfile } from '../hooks/useStudioProfile';
import { useFeaturedFighters } from '../hooks/useFeaturedFighters';

type Props = NativeStackScreenProps<RootStackParamList, 'StudioProfileEdit'>;

const ALL_DISCIPLINES = [
  'Boxen', 'Kickboxen', 'Muay Thai', 'BJJ', 'Wrestling',
  'MMA', 'Grappling', 'Judo', 'K-1', 'Freistil',
];

const MAX_DESCRIPTION = 300;

interface StudioMember {
  id: string;
  name: string | null;
  avatar_url: string | null;
}

async function uploadImage(
  localUri: string,
  bucket: string,
  path: string,
): Promise<{ url: string | null; error: string | null }> {
  const rawExt = localUri.split('.').pop()?.split('?')[0].toLowerCase() ?? '';
  const ext = rawExt === 'png' ? 'png' : 'jpg';
  const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fullPath = `${path}.${ext}`;

  const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const arrayBuffer = base64Decode(base64);

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fullPath, arrayBuffer, { upsert: true, contentType: mime });

  if (error !== null) return { url: null, error: error.message };

  const { data } = supabase.storage.from(bucket).getPublicUrl(fullPath);
  return { url: `${data.publicUrl}?t=${Date.now()}`, error: null };
}

export default function StudioProfileEditScreen({ route, navigation }: Props): React.ReactElement {
  const { studioId } = route.params;
  const { studio, loading: studioLoading, refetch: refetchStudio } = useStudioProfile(studioId);
  const { fighters, loading: fightersLoading, addFighter, removeFighter } =
    useFeaturedFighters(studioId);

  const [description, setDescription] = useState('');
  const [selectedDisciplines, setSelectedDisciplines] = useState<string[]>([]);
  const [bannerUri, setBannerUri] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [memberPickerVisible, setMemberPickerVisible] = useState(false);
  const [members, setMembers] = useState<StudioMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);

  useEffect(() => {
    if (studio === null) return;
    setDescription(studio.description ?? '');
    setSelectedDisciplines(studio.disciplines);
  }, [studio]);

  function toggleDiscipline(d: string): void {
    setSelectedDisciplines((prev) =>
      prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d],
    );
  }

  async function pickImage(aspect: [number, number]): Promise<string | null> {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Zugriff erforderlich', 'Bitte Foto-Zugriff in den Einstellungen erlauben.');
      return null;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect,
      quality: 0.85,
    });
    if (result.canceled || result.assets.length === 0) return null;
    return result.assets[0].uri;
  }

  async function handlePickBanner(): Promise<void> {
    const uri = await pickImage([16, 9]);
    if (uri !== null) setBannerUri(uri);
  }

  async function handlePickAvatar(): Promise<void> {
    const uri = await pickImage([1, 1]);
    if (uri !== null) setAvatarUri(uri);
  }

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

  async function handleSave(): Promise<void> {
    setSaving(true);
    try {
      const updates: Record<string, unknown> = {
        description: description.trim().length > 0 ? description.trim() : null,
        disciplines: selectedDisciplines,
      };

      if (bannerUri !== null) {
        const { url, error } = await uploadImage(bannerUri, 'studio-assets', `${studioId}/banner`);
        if (error !== null) {
          Alert.alert('Banner-Upload fehlgeschlagen', error);
          return;
        }
        updates.banner_url = url;
      }

      if (avatarUri !== null) {
        const { url, error } = await uploadImage(avatarUri, 'studio-assets', `${studioId}/avatar`);
        if (error !== null) {
          Alert.alert('Avatar-Upload fehlgeschlagen', error);
          return;
        }
        updates.avatar_url = url;
      }

      const { error } = await supabase
        .from('studios')
        .update(updates)
        .eq('id', studioId);

      if (error !== null) {
        Alert.alert('Fehler beim Speichern', error.message);
        return;
      }

      refetchStudio();
      setSaving(false);
      navigation.goBack();
    } finally {
      setSaving(false);
    }
  }

  const displayBanner = bannerUri ?? studio?.banner_url ?? null;
  const displayAvatar = avatarUri ?? studio?.avatar_url ?? null;
  const studioName = studio?.name ?? '';

  const alreadyFeaturedIds = new Set(fighters.map((f) => f.userId));
  const pickableMembers = members.filter((m) => !alreadyFeaturedIds.has(m.id));

  if (studioLoading) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <ActivityIndicator style={styles.loader} color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.cancelBtn}>
          <Text style={styles.cancelText}>Abbrechen</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profil bearbeiten</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator size="small" color={colors.accentBlue} />
            : <Text style={styles.saveText}>Speichern</Text>
          }
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={handlePickBanner} activeOpacity={0.85}>
            <ImageBackground
              source={displayBanner !== null ? { uri: displayBanner } : undefined}
              style={styles.banner}
              imageStyle={styles.bannerImage}
            >
              <View style={styles.bannerOverlay} />
              <View style={styles.bannerEditHint}>
                <Ionicons name="image-outline" size={22} color={colors.card} />
                <Text style={styles.bannerEditText}>Banner ändern</Text>
              </View>
            </ImageBackground>
          </TouchableOpacity>

          <View style={styles.avatarRow}>
            <TouchableOpacity onPress={handlePickAvatar} activeOpacity={0.85} style={styles.avatarWrap}>
              {displayAvatar !== null ? (
                <Image source={{ uri: displayAvatar }} style={styles.avatar} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Text style={styles.avatarInitials}>
                    {studioName.slice(0, 2).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.avatarBadge}>
                <Ionicons name="camera" size={14} color={colors.card} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Disziplinen</Text>
              <View style={styles.disciplinesGrid}>
                {ALL_DISCIPLINES.map((d) => {
                  const active = selectedDisciplines.includes(d);
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[styles.disciplineChip, active && styles.disciplineChipActive]}
                      onPress={() => toggleDiscipline(d)}
                      activeOpacity={0.75}
                    >
                      <Text style={[styles.disciplineText, active && styles.disciplineTextActive]}>
                        {d}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Über uns</Text>
                <Text style={styles.charCount}>
                  {description.length}/{MAX_DESCRIPTION}
                </Text>
              </View>
              <TextInput
                style={styles.descriptionInput}
                value={description}
                onChangeText={(t) => setDescription(t.slice(0, MAX_DESCRIPTION))}
                placeholder="Beschreibe dein Studio..."
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <Text style={styles.sectionLabel}>Featured Fighters</Text>
                <TouchableOpacity
                  onPress={async () => {
                    await loadMembers();
                    setMemberPickerVisible(true);
                  }}
                  style={styles.addBtn}
                >
                  <Ionicons name="add" size={18} color={colors.accentBlue} />
                  <Text style={styles.addBtnText}>Hinzufügen</Text>
                </TouchableOpacity>
              </View>

              {fightersLoading ? (
                <ActivityIndicator color={colors.accentBlue} />
              ) : fighters.length === 0 ? (
                <Text style={styles.emptyText}>Noch keine Featured Fighters.</Text>
              ) : (
                fighters.map((f) => (
                  <View key={f.id} style={styles.fighterRow}>
                    {f.avatarUrl !== null ? (
                      <Image source={{ uri: f.avatarUrl }} style={styles.fighterAvatar} />
                    ) : (
                      <View style={[styles.fighterAvatar, styles.fighterAvatarPlaceholder]}>
                        <Text style={styles.fighterInitials}>
                          {(f.name ?? '?').slice(0, 2).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={styles.fighterName}>{f.name ?? 'Unbekannt'}</Text>
                    <TouchableOpacity
                      onPress={async () => {
                        const { error } = await removeFighter(f.userId);
                        if (error !== null) Alert.alert('Fehler', error);
                      }}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Ionicons name="trash-outline" size={20} color={colors.deleteRed} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
          </View>

          <View style={styles.bottomPad} />
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={memberPickerVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setMemberPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => setMemberPickerVisible(false)}
        />
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHandle} />
          <Text style={styles.pickerTitle}>Mitglied hinzufügen</Text>
          {membersLoading ? (
            <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
          ) : pickableMembers.length === 0 ? (
            <Text style={styles.emptyText}>Keine weiteren Mitglieder verfügbar.</Text>
          ) : (
            <FlatList
              data={pickableMembers}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.memberRow}
                  activeOpacity={0.8}
                  onPress={async () => {
                    setMemberPickerVisible(false);
                    const { error } = await addFighter(item.id);
                    if (error !== null) Alert.alert('Fehler', error);
                  }}
                >
                  {item.avatar_url !== null ? (
                    <Image source={{ uri: item.avatar_url }} style={styles.memberAvatar} />
                  ) : (
                    <View style={[styles.memberAvatar, styles.memberAvatarPlaceholder]}>
                      <Text style={styles.memberInitials}>
                        {(item.name ?? '?').slice(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <Text style={styles.memberName}>{item.name ?? 'Unbekannt'}</Text>
                  <Ionicons name="add-circle-outline" size={22} color={colors.accentBlue} />
                </TouchableOpacity>
              )}
              showsVerticalScrollIndicator={false}
              style={styles.memberList}
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cancelBtn: {
    minWidth: 80,
  },
  cancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  saveBtn: {
    minWidth: 80,
    alignItems: 'flex-end',
  },
  saveText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  loader: {
    marginTop: 48,
  },
  scroll: {
    flex: 1,
  },
  banner: {
    height: 180,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    resizeMode: 'cover',
  },
  bannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.heroBannerScrim,
  },
  bannerEditHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.heroFloatingBtn,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bannerEditText: {
    color: colors.card,
    fontSize: 14,
    fontWeight: '600',
  },
  avatarRow: {
    paddingHorizontal: 16,
    marginTop: -36,
    marginBottom: 8,
  },
  avatarWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 3,
    borderColor: colors.card,
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  avatarPlaceholder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.card,
  },
  avatarBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.card,
  },
  content: {
    padding: 16,
    gap: 16,
  },
  section: {
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sectionLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  charCount: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  disciplinesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  disciplineChip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disciplineChipActive: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlue,
  },
  disciplineText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  disciplineTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  descriptionInput: {
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
    lineHeight: 20,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 8,
  },
  fighterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  fighterAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  fighterAvatarPlaceholder: {
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fighterInitials: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  fighterName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  backdrop: {
    flex: 1,
    backgroundColor: colors.mapOverlay,
  },
  pickerSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '60%',
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
  bottomPad: {
    height: 48,
  },
});
