import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  ScrollView,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useProfile } from '../hooks/useProfile';
import { useAvatarUpload } from '../hooks/useAvatarUpload';
import { useBannedWords } from '../hooks/useBannedWords';
import { checkText, filterErrorMessage } from '../utils/contentFilter';
import {
  TEXT_LIMITS,
  toDraft,
  draftToUpdate,
  changedFields,
  isDraftDirty,
  normalizeInstagramHandle,
} from '../utils/profileDraft';
import type { ProfileDraft, DraftField, DraftErrors } from '../utils/profileDraft';
import type { Stance } from '../utils/stance';
import ProfilePhoto from '../components/profil/ProfilePhoto';
import EditField from '../components/profil/edit/EditField';
import { DisciplineSelector, StanceSelector } from '../components/profil/edit/SportSelectors';
import { PrimaryButton, SecondaryButton } from '../components/profil/ProfileParts';
import CoverEditorModal from '../components/profil/CoverEditorModal';
import GymPickerSheet from '../components/gym/GymPickerSheet';
import CountryPickerSheet from '../components/profil/CountryPickerSheet';
import CountryFlag from '../components/common/CountryFlag';
import { countryByCode } from '../utils/countries';
import { useGym } from '../hooks/useGyms';
import type { Gym } from '../hooks/useGyms';
import * as ImagePicker from 'expo-image-picker';
import type { Focus } from '../utils/coverLayout';

type Nav = NativeStackNavigationProp<RootStackParamList>;

// "Profil bearbeiten": one calm page grouped into sections, a fixed save bar at
// the bottom. The draft is initialised once from the profile — later profile
// updates never overwrite what the user is typing. Only changed columns are
// written; leaving with unsaved changes asks first.
export default function EditProfileScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const insets = useSafeAreaInsets();
  const { profile, uploadAvatar, updateProfile, uploadCover, removeCover } = useProfile();
  const { bannedWords } = useBannedWords();
  const avatar = useAvatarUpload(uploadAvatar);

  const [draft, setDraft] = useState<ProfileDraft | null>(null);
  const [baseline, setBaseline] = useState<ProfileDraft | null>(null);
  const [errors, setErrors] = useState<DraftErrors>({});
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);

  // Cover photo and home gym are saved right away (like the avatar), not
  // through the draft.
  const [coverEditor, setCoverEditor] = useState<{ uri: string; focus: Focus; isNew: boolean } | null>(null);
  const [coverSaving, setCoverSaving] = useState(false);
  const [gymPickerVisible, setGymPickerVisible] = useState(false);
  const [countryPickerVisible, setCountryPickerVisible] = useState(false);
  const { gym: homeGym } = useGym(profile?.home_gym_id ?? null);

  async function pickCover(): Promise<void> {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Zugriff erforderlich', 'Bitte erlaube den Zugriff auf deine Fotos in den Einstellungen, um ein Titelbild zu wählen.');
        return;
      }
      // No system crop: the framing is chosen in the cover editor, in the
      // exact proportions of the profile.
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', allowsEditing: false, quality: 0.8 });
      if (result.canceled || result.assets.length === 0) return;
      setCoverEditor({ uri: result.assets[0].uri, focus: { x: 0.5, y: 0.5 }, isNew: true });
    } catch (e) {
      Alert.alert('Fehler', e instanceof Error ? e.message : 'Unbekannter Fehler.');
    }
  }

  async function saveCover(focus: Focus): Promise<void> {
    if (coverEditor === null) return;
    setCoverSaving(true);
    const { error } = coverEditor.isNew
      ? await uploadCover(coverEditor.uri, focus)
      : await updateProfile({ cover_focus_x: focus.x, cover_focus_y: focus.y });
    setCoverSaving(false);
    if (error !== null) {
      Alert.alert('Titelbild nicht gespeichert', 'Bitte versuche es erneut.');
      return;
    }
    setCoverEditor(null);
  }

  function confirmRemoveCover(): void {
    Alert.alert('Titelbild entfernen?', 'Dein Profil zeigt dann wieder die Sparr-Grafik.', [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Entfernen',
        style: 'destructive',
        onPress: () => {
          void removeCover().then(({ error }) => {
            if (error !== null) Alert.alert('Nicht entfernt', 'Bitte versuche es erneut.');
          });
        },
      },
    ]);
  }

  async function selectHomeGym(gym: Gym): Promise<boolean> {
    const { error } = await updateProfile({ home_gym_id: gym.id });
    if (error !== null) {
      Alert.alert('Nicht gespeichert', 'Dein Gym konnte nicht gespeichert werden. Bitte versuche es erneut.');
      return false;
    }
    return true;
  }

  async function clearHomeGym(): Promise<boolean> {
    const { error } = await updateProfile({ home_gym_id: null });
    if (error !== null) {
      Alert.alert('Nicht gespeichert', 'Bitte versuche es erneut.');
      return false;
    }
    return true;
  }

  useEffect(() => {
    if (profile !== null && draft === null) {
      const initial = toDraft(profile);
      setDraft(initial);
      setBaseline(initial);
    }
  }, [profile, draft]);

  const dirty = draft !== null && baseline !== null && isDraftDirty(draft, baseline);

  // Stable handler so memoized fields don't re-render on every keystroke.
  const onField = useCallback((field: DraftField, value: string) => {
    setDraft((d) => (d !== null ? { ...d, [field]: value } : d));
    setErrors((e) => (e[field] !== undefined ? { ...e, [field]: undefined } : e));
    setJustSaved(false);
  }, []);
  const setDisciplines = useCallback((next: string[]) => {
    setDraft((d) => (d !== null ? { ...d, disciplines: next } : d));
    setJustSaved(false);
  }, []);
  const setStance = useCallback((next: Stance | null) => {
    setDraft((d) => (d !== null ? { ...d, stance: next } : d));
    setJustSaved(false);
  }, []);

  // Unsaved changes: confirm on back/hardware back; the native iOS swipe can't
  // be intercepted by beforeRemove, so it is disabled while there are changes.
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);
  useEffect(() => navigation.addListener('beforeRemove', (e) => {
    if (!dirtyRef.current) return;
    e.preventDefault();
    Alert.alert(
      'Änderungen verwerfen?',
      'Du hast Änderungen, die noch nicht gespeichert sind.',
      [
        { text: 'Weiter bearbeiten', style: 'cancel' },
        { text: 'Verwerfen', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
      ],
    );
  }), [navigation]);

  async function handleSave(): Promise<void> {
    if (draft === null || profile === null || saving || !dirty) return;
    const { update, errors: nextErrors } = draftToUpdate(draft);
    const bioVerdict = checkText(draft.bio, bannedWords, { allowContactInfo: true });
    if (!bioVerdict.ok) nextErrors.bio = filterErrorMessage(bioVerdict.category);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      Alert.alert('Bitte prüfen', 'Einige Angaben sind noch nicht korrekt. Die Hinweise stehen direkt am Feld.');
      return;
    }
    const cleaned: ProfileDraft = { ...draft, instagram: normalizeInstagramHandle(draft.instagram) };
    const changes = changedFields(update, profile);
    if (Object.keys(changes).length === 0) {
      setDraft(cleaned);
      setBaseline(cleaned);
      return;
    }
    setSaving(true);
    const { error } = await updateProfile(changes);
    setSaving(false);
    if (error !== null) {
      // Keep every input; the user can simply try again.
      Alert.alert('Speichern fehlgeschlagen', 'Deine Eingaben bleiben erhalten. Bitte versuche es erneut.');
      return;
    }
    setDraft(cleaned);
    setBaseline(cleaned);
    setJustSaved(true);
  }

  if (draft === null) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={colors.accentBlue} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel="Zurück">
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.topTitle} accessibilityRole="header">Profil bearbeiten</Text>
      </View>

      {/* Edge-to-edge (SDK 55): padding on both platforms keeps the focused
          field and the save bar above the keyboard. */}
      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.page}>
            {/* ── Dein Auftritt ── */}
            <View style={styles.intro}>
              <View>
                <ProfilePhoto uri={avatar.localUri ?? profile?.avatar_url ?? null} name={draft.name} size={88} />
                {avatar.uploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color={colors.card} />
                  </View>
                )}
              </View>
              <View style={styles.introText}>
                <Text style={styles.introTitle}>Dein Auftritt</Text>
                <SecondaryButton
                  icon="camera-outline"
                  label={avatar.uploading ? 'Wird hochgeladen …' : 'Foto ändern'}
                  onPress={() => { void avatar.pick(); }}
                />
                <Text style={styles.introHint}>So sehen dich andere auf Sparr.</Text>
              </View>
            </View>

            {/* ── Titelbild (optional) ── */}
            <Section title="Titelbild">
              <Text style={styles.introHint}>
                {profile?.cover_url != null
                  ? 'Ein Trainingsfoto oben in deinem Profil.'
                  : 'Optional: ein Trainingsfoto oben in deinem Profil. Ohne Foto zeigt dein Profil die Sparr-Grafik.'}
              </Text>
              <View style={styles.buttonRow}>
                <SecondaryButton
                  icon="image-outline"
                  label={profile?.cover_url != null ? 'Neues Foto' : 'Foto wählen'}
                  onPress={() => { void pickCover(); }}
                />
                {profile?.cover_url != null && (
                  <SecondaryButton
                    icon="move-outline"
                    label="Ausschnitt"
                    onPress={() => setCoverEditor({
                      uri: profile.cover_url as string,
                      focus: { x: profile.cover_focus_x, y: profile.cover_focus_y },
                      isNew: false,
                    })}
                  />
                )}
                {profile?.cover_url != null && (
                  <SecondaryButton icon="trash-outline" label="Entfernen" onPress={confirmRemoveCover} />
                )}
              </View>
            </Section>

            {/* ── Hier trainiere ich (optional, self-declaration) ── */}
            <Section title="Hier trainiere ich">
              {homeGym !== null ? (
                <View style={styles.gymRow}>
                  <View style={styles.flex}>
                    <Text style={styles.gymName}>{homeGym.name}</Text>
                    <Text style={styles.introHint}>{homeGym.city}</Text>
                  </View>
                  <SecondaryButton icon="swap-horizontal" label="Ändern" onPress={() => setGymPickerVisible(true)} />
                </View>
              ) : (
                <SecondaryButton icon="add" label="Gym auswählen" onPress={() => setGymPickerVisible(true)} />
              )}
              <Text style={styles.introHint}>
                Freiwillig. Andere sehen dein Gym in deinem Profil; es ist keine bestätigte Mitgliedschaft.
              </Text>
            </Section>

            {/* ── Das bist du ── */}
            <Section title="Das bist du">
              <EditField field="name" label="Name" value={draft.name} onChange={onField}
                placeholder="z. B. Romeo Georgiadis" maxLength={TEXT_LIMITS.name} autoCapitalize="words" />
              <EditField field="nickname" label="Kampfname" optional value={draft.nickname} onChange={onField}
                placeholder="z. B. The Hammer" maxLength={TEXT_LIMITS.nickname} autoCapitalize="words" />
              <EditField field="bio" label="Über mich" optional value={draft.bio} onChange={onField} multiline
                placeholder="Kampfstil, Erfahrung, Ziele …" maxLength={TEXT_LIMITS.bio} error={errors.bio} />
            </Section>

            {/* ── Dein Kampfsport ── */}
            <Section title="Dein Kampfsport">
              <DisciplineSelector selected={draft.disciplines} onChange={setDisciplines} />
              <StanceSelector value={draft.stance} onChange={setStance} />
              <EditField field="favoriteMove" label="Lieblingsmove" optional value={draft.favoriteMove} onChange={onField}
                placeholder="z. B. Linker Haken zum Körper" maxLength={TEXT_LIMITS.favoriteMove} />
            </Section>

            {/* ── Deine Eckdaten ── */}
            <Section title="Deine Eckdaten">
              <View style={styles.pair}>
                <View style={styles.pairItem}>
                  <EditField field="heightCm" label="Körpergröße" optional value={draft.heightCm} onChange={onField}
                    placeholder="182" suffix="cm" keyboardType="number-pad" maxLength={3} error={errors.heightCm} />
                </View>
                <View style={styles.pairItem}>
                  <EditField field="armSpanCm" label="Spannweite" optional value={draft.armSpanCm} onChange={onField}
                    placeholder="185" suffix="cm" keyboardType="number-pad" maxLength={3} error={errors.armSpanCm} />
                </View>
              </View>
              <View style={styles.pair}>
                <View style={styles.pairItem}>
                  <EditField field="weightKg" label="Kampfgewicht" optional value={draft.weightKg} onChange={onField}
                    placeholder="72,5" suffix="kg" keyboardType="decimal-pad" maxLength={6} error={errors.weightKg} />
                </View>
              </View>
              <View style={styles.pair}>
                <View style={styles.pairItem}>
                  <EditField field="ageYears" label="Alter" optional value={draft.ageYears} onChange={onField}
                    placeholder="27" suffix="Jahre" keyboardType="number-pad" maxLength={2} error={errors.ageYears} />
                </View>
              </View>
              <CountryField code={draft.countryCode} onPress={() => setCountryPickerVisible(true)} />
              <EditField field="hometown" label="Heimatstadt" optional value={draft.hometown} onChange={onField}
                placeholder="z. B. München" maxLength={TEXT_LIMITS.hometown} autoCapitalize="words" />
            </Section>

            {/* ── Mehr von dir ── */}
            <Section title="Mehr von dir">
              <EditField field="motto" label="Motto" optional value={draft.motto} onChange={onField}
                placeholder="z. B. Hart trainieren, fair sparren" maxLength={TEXT_LIMITS.motto} />
              <EditField field="instagram" label="Instagram" optional value={draft.instagram} onChange={onField}
                prefix="@" placeholder="dein.profil" maxLength={TEXT_LIMITS.instagram} autoCapitalize="none" />
            </Section>

            <Text style={styles.cardHint}>
              Den Rahmen deiner teilbaren Kämpferkarte gestaltest du im Profil unter „Profil teilen“.
            </Text>
          </View>
        </ScrollView>

        <CoverEditorModal
          visible={coverEditor !== null}
          uri={coverEditor?.uri ?? null}
          initialFocus={coverEditor?.focus ?? { x: 0.5, y: 0.5 }}
          saving={coverSaving}
          onCancel={() => setCoverEditor(null)}
          onSave={(focus) => { void saveCover(focus); }}
        />
        <GymPickerSheet
          visible={gymPickerVisible}
          title="Wo trainierst du?"
          currentGymId={profile?.home_gym_id ?? null}
          onClose={() => setGymPickerVisible(false)}
          onSelect={selectHomeGym}
          removeLabel="Gym aus dem Profil entfernen"
          onRemove={clearHomeGym}
        />
        <CountryPickerSheet
          visible={countryPickerVisible}
          selected={draft.countryCode.length > 0 ? draft.countryCode : null}
          onClose={() => setCountryPickerVisible(false)}
          onSelect={(code) => onField('countryCode', code ?? '')}
        />

        {/* ── Fixed save bar ── */}
        <View style={[styles.saveBar, { paddingBottom: Math.max(insets.bottom, 8) + 8 }]}>
          {justSaved && !dirty && (
            <View style={styles.savedRow} accessibilityLiveRegion="polite">
              <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} />
              <Text style={styles.savedText}>Gespeichert</Text>
            </View>
          )}
          <PrimaryButton
            icon="checkmark"
            label="Änderungen speichern"
            loading={saving}
            disabled={!dirty}
            onPress={() => { void handleSave(); }}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Flag under the profile name; opens the country picker.
function CountryField({ code, onPress }: { code: string; onPress: () => void }): React.ReactElement {
  const country = countryByCode(code);
  return (
    <View style={styles.fieldGroup}>
      <View style={styles.fieldLabelRow}>
        <Text style={styles.fieldLabel}>Flagge</Text>
        <Text style={styles.fieldOptional}>optional</Text>
      </View>
      <TouchableOpacity
        style={styles.pickerBox}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={country !== null ? `Flagge, ${country.name}, ändern` : 'Flagge wählen, optional'}
      >
        {country !== null && <CountryFlag code={country.code} width={28} />}
        <Text style={[styles.pickerText, country === null && styles.pickerPlaceholder]} numberOfLines={1}>
          {country !== null ? country.name : 'Land wählen'}
        </Text>
        <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
      </TouchableOpacity>
      <Text style={styles.introHint}>Erscheint unter deinem Namen im Profil.</Text>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} accessibilityRole="header">{title}</Text>
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  center: {
    alignItems:     'center',
    justifyContent: 'center',
  },
  flex: {
    flex: 1,
  },
  topBar: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
    minHeight:         48,
    gap:               8,
  },
  backBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  topTitle: {
    fontSize:   20,
    fontWeight: '900',
    color:      colors.text,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop:        8,
    paddingBottom:     32,
  },
  page: {
    width:     '100%',
    maxWidth:  600,
    alignSelf: 'center',
    gap:       40,
  },
  intro: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  uploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius:    22,
    backgroundColor: colors.mapOverlay,
    alignItems:      'center',
    justifyContent:  'center',
  },
  introText: {
    flex: 1,
    gap:  8,
  },
  introTitle: {
    fontSize:   22,
    fontWeight: '900',
    color:      colors.text,
  },
  introHint: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  section: {
    gap: 16,
  },
  sectionTitle: {
    fontSize:      22,
    fontWeight:    '900',
    letterSpacing: -0.3,
    color:         colors.text,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.hairline,
  },
  sectionBody: {
    gap: 16,
  },
  pair: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           16,
  },
  pairItem: {
    flexGrow:  1,
    flexBasis: 144,
  },
  buttonRow: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
  },
  fieldLabel: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  fieldOptional: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  pickerBox: {
    flexDirection:     'row',
    alignItems:        'center',
    minHeight:         52,
    paddingHorizontal: 16,
    gap:               8,
    borderRadius:      12,
    borderWidth:       1.5,
    borderColor:       colors.hairline,
    backgroundColor:   colors.card,
  },
  pickerText: {
    flex:     1,
    fontSize: 16,
    color:    colors.text,
  },
  pickerPlaceholder: {
    color: colors.textSecondary,
  },
  gymRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  gymName: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.text,
  },
  cardHint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
  },
  saveBar: {
    paddingHorizontal: 16,
    paddingTop:        8,
    gap:               8,
    borderTopWidth:    1,
    borderTopColor:    colors.hairline,
    backgroundColor:   colors.background,
  },
  savedRow: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    gap:            8,
  },
  savedText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
});
