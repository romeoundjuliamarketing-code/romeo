import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { checkText, filterErrorMessage } from '../../utils/contentFilter';
import { useBannedWords } from '../../hooks/useBannedWords';
import DisciplinePickerCard from './DisciplinePickerCard';
import type { Profile, ProfileUpdate } from '../../types/database.types';
import type { Discipline } from '../../data/disciplines';

const WEIGHT_CLASSES = [
  'Strawweight',
  'Flyweight',
  'Bantamweight',
  'Featherweight',
  'Lightweight',
  'Welterweight',
  'Middleweight',
  'Light Heavyweight',
  'Heavyweight',
  'Super Heavyweight',
] as const;

interface ProfileDetailsFormProps {
  profile: Profile | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
}

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

function FieldLabel({ icon, text }: { icon: IconName; text: string }): React.ReactElement {
  return (
    <View style={styles.fieldLabelRow}>
      <MaterialCommunityIcons name={icon} size={13} color={colors.textSecondary} />
      <Text style={styles.fieldLabelText}>{text}</Text>
    </View>
  );
}

export default function ProfileDetailsForm({
  profile,
  updateProfile,
}: ProfileDetailsFormProps): React.ReactElement {
  // Draft state for all fields — synced from profile via useEffect (handles async load)
  const [name,         setName]         = useState(profile?.name           ?? '');
  const [nickname,     setNickname]     = useState(profile?.nickname        ?? '');
  const [heightCm,     setHeightCm]     = useState(
    profile?.height_cm != null ? String(profile.height_cm) : '',
  );
  const [ageYears,     setAgeYears]     = useState(
    profile?.age_years != null ? String(profile.age_years) : '',
  );
  const [armSpanCm,    setArmSpanCm]    = useState(
    profile?.arm_span_cm != null ? String(profile.arm_span_cm) : '',
  );
  const [weightKg,     setWeightKg]     = useState(
    profile?.weight_kg != null ? String(profile.weight_kg) : '',
  );
  const [weightClass,  setWeightClass]  = useState(profile?.weight_class    ?? '');
  const [nationality,  setNationality]  = useState(profile?.nationality      ?? '');
  const [hometown,     setHometown]     = useState(profile?.hometown          ?? '');
  const [disciplines,  setDisciplines]  = useState<string[]>(profile?.disciplines ?? []);
  const [stance,       setStance]       = useState<'orthodox' | 'southpaw' | null>(
    profile?.stance ?? null,
  );
  const [bio,          setBio]          = useState(profile?.bio              ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url    ?? '');
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [saving,       setSaving]       = useState(false);
  const { bannedWords } = useBannedWords();
  const [filterError, setFilterError] = useState<string | null>(null);

  // Sync draft state when profile loads asynchronously after mount
  useEffect(() => {
    if (profile === null) return;
    setName(profile.name              ?? '');
    setNickname(profile.nickname       ?? '');
    setHeightCm(profile.height_cm != null  ? String(profile.height_cm)  : '');
    setAgeYears(profile.age_years != null  ? String(profile.age_years)  : '');
    setArmSpanCm(profile.arm_span_cm != null ? String(profile.arm_span_cm) : '');
    setWeightKg(profile.weight_kg != null  ? String(profile.weight_kg)  : '');
    setWeightClass(profile.weight_class    ?? '');
    setNationality(profile.nationality     ?? '');
    setHometown(profile.hometown            ?? '');
    setDisciplines(profile.disciplines      ?? []);
    setStance(profile.stance               ?? null);
    setBio(profile.bio                     ?? '');
    setInstagramUrl(profile.instagram_url  ?? '');
  }, [profile]);

  function handleToggleDiscipline(discipline: Discipline): void {
    setDisciplines((prev) =>
      prev.includes(discipline)
        ? prev.filter((d) => d !== discipline)
        : [...prev, discipline],
    );
  }

  async function handleSave(): Promise<void> {
    // Numeric field validation
    const heightVal = heightCm.trim() ? parseInt(heightCm.trim(), 10) : null;
    if (heightVal !== null && (isNaN(heightVal) || heightVal < 100 || heightVal > 250)) {
      Alert.alert('Ungültig', 'Körpergrösse muss zwischen 100 und 250 cm liegen.');
      return;
    }

    const ageVal = ageYears.trim() ? parseInt(ageYears.trim(), 10) : null;
    if (ageVal !== null && (isNaN(ageVal) || ageVal < 14 || ageVal > 99)) {
      Alert.alert('Ungültig', 'Alter muss zwischen 14 und 99 Jahren liegen.');
      return;
    }

    const armSpanVal = armSpanCm.trim() ? parseInt(armSpanCm.trim(), 10) : null;
    if (armSpanVal !== null && (isNaN(armSpanVal) || armSpanVal < 100 || armSpanVal > 250)) {
      Alert.alert('Ungültig', 'Spannweite muss zwischen 100 und 250 cm liegen.');
      return;
    }

    const str = (v: string): string | null => v.trim() || null;
    const num = (v: string): number | null => v.trim() ? parseFloat(v.replace(',', '.')) : null;

    setFilterError(null);
    const bioVerdict = checkText(bio, bannedWords, { allowContactInfo: true });
    if (!bioVerdict.ok) {
      setFilterError(filterErrorMessage(bioVerdict.category));
      return;
    }

    setSaving(true);
    await updateProfile({
      name:          str(name),
      nickname:      str(nickname),
      height_cm:     heightVal,
      age_years:     ageVal,
      arm_span_cm:   armSpanVal,
      weight_kg:     num(weightKg),
      weight_class:  weightClass || null,
      nationality:   str(nationality),
      hometown:      str(hometown),
      disciplines,
      stance:        stance ?? null,
      bio:           bio.trim() ? bio.trim().slice(0, 300) : null,
      instagram_url: str(instagramUrl),
    });
    setSaving(false);
    Alert.alert('Gespeichert', 'Profil wurde aktualisiert.');
  }

  return (
    <View style={styles.container}>

      {/* ── Name + Kampfname ── */}
      <View style={styles.field}>
        <FieldLabel icon="account-outline" text="NAME" />
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Dein Name"
          placeholderTextColor={colors.textSecondary}
          maxLength={40}
        />
      </View>

      <View style={styles.field}>
        <FieldLabel icon="star-outline" text="KAMPFNAME" />
        <TextInput
          style={styles.input}
          value={nickname}
          onChangeText={setNickname}
          placeholder='"The Hammer"'
          placeholderTextColor={colors.textSecondary}
          maxLength={50}
        />
      </View>

      {/* ── Körpergrösse + Alter (2 Spalten) ── */}
      <View style={styles.row}>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="human-male-height" text="KÖRPERGRÖSSE" />
          <TextInput
            style={styles.input}
            value={heightCm}
            onChangeText={setHeightCm}
            placeholder="182 cm"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={3}
          />
        </View>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="calendar-account-outline" text="ALTER" />
          <TextInput
            style={styles.input}
            value={ageYears}
            onChangeText={setAgeYears}
            placeholder="27"
            placeholderTextColor={colors.textSecondary}
            keyboardType="number-pad"
            maxLength={2}
          />
        </View>
      </View>

      {/* ── Spannweite ── */}
      <View style={styles.field}>
        <FieldLabel icon="arrow-left-right" text="SPANNWEITE" />
        <TextInput
          style={styles.input}
          value={armSpanCm}
          onChangeText={setArmSpanCm}
          placeholder="185 cm"
          placeholderTextColor={colors.textSecondary}
          keyboardType="number-pad"
          maxLength={3}
        />
      </View>

      {/* ── Kampfgewicht + Gewichtsklasse (2 Spalten) ── */}
      <View style={styles.row}>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="weight-kilogram" text="KAMPFGEWICHT" />
          <TextInput
            style={styles.input}
            value={weightKg}
            onChangeText={setWeightKg}
            placeholder="70 kg"
            placeholderTextColor={colors.textSecondary}
            keyboardType="decimal-pad"
            maxLength={6}
          />
        </View>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="trophy-outline" text="KLASSE" />
          <TouchableOpacity
            style={[styles.input, styles.pickerBtn]}
            onPress={() => setPickerOpen((v) => !v)}
            activeOpacity={0.7}
          >
            <Text
              style={[styles.pickerBtnText, weightClass.length === 0 && styles.placeholder]}
              numberOfLines={1}
            >
              {weightClass.length > 0 ? weightClass : 'Wählen...'}
            </Text>
            <MaterialCommunityIcons
              name={pickerOpen ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {pickerOpen && (
        <View style={styles.pickerList}>
          {WEIGHT_CLASSES.map((wc) => (
            <TouchableOpacity
              key={wc}
              style={[styles.pickerItem, weightClass === wc && styles.pickerItemActive]}
              onPress={() => { setWeightClass(wc); setPickerOpen(false); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerItemText, weightClass === wc && styles.pickerItemTextActive]}>
                {wc}
              </Text>
              {weightClass === wc && (
                <MaterialCommunityIcons name="check" size={14} color={colors.accentBlue} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* ── Nationalität + Heimatstadt (2 Spalten) ── */}
      <View style={styles.row}>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="flag-outline" text="NATIONALITÄT" />
          <TextInput
            style={styles.input}
            value={nationality}
            onChangeText={setNationality}
            placeholder="Deutsch"
            placeholderTextColor={colors.textSecondary}
            maxLength={50}
          />
        </View>
        <View style={[styles.field, styles.col]}>
          <FieldLabel icon="map-marker-outline" text="HEIMATSTADT" />
          <TextInput
            style={styles.input}
            value={hometown}
            onChangeText={setHometown}
            placeholder="München"
            placeholderTextColor={colors.textSecondary}
            maxLength={100}
          />
        </View>
      </View>

      {/* ── Disziplinen ── */}
      <View style={styles.field}>
        <FieldLabel icon="shield-sword-outline" text="DISZIPLINEN" />
        <DisciplinePickerCard
          selected={disciplines}
          saving={false}
          onToggle={handleToggleDiscipline}
          inline
        />
      </View>

      {/* ── Stance / Auslage ── */}
      <View style={styles.field}>
        <FieldLabel icon="boxing-glove" text="AUSLAGE" />
        <View style={styles.stanceRow}>
          {(['orthodox', 'southpaw'] as const).map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.stanceChip, stance === s && styles.stanceChipActive]}
              onPress={() => setStance((prev) => (prev === s ? null : s))}
              activeOpacity={0.7}
            >
              <Text style={[styles.stanceChipText, stance === s && styles.stanceChipTextActive]}>
                {s === 'orthodox' ? 'Rechtshänder' : 'Linkshänder'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Bio ── */}
      <View style={styles.field}>
        <FieldLabel icon="text-account" text="ÜBER MICH" />
        <TextInput
          style={[styles.input, styles.bioInput]}
          value={bio}
          onChangeText={(t) => setBio(t.slice(0, 300))}
          placeholder="Kampfstil, Erfahrung, Ziele..."
          placeholderTextColor={colors.textSecondary}
          multiline
          maxLength={300}
          textAlignVertical="top"
        />
        <Text style={styles.charCount}>{bio.length}/300</Text>
        {filterError !== null && <Text style={styles.filterError}>{filterError}</Text>}
      </View>

      {/* ── Instagram ── */}
      <View style={styles.field}>
        <FieldLabel icon="instagram" text="INSTAGRAM" />
        <View style={styles.inputWithIcon}>
          <MaterialCommunityIcons
            name="at"
            size={16}
            color={colors.textSecondary}
            style={styles.inputIcon}
          />
          <TextInput
            style={[styles.input, styles.inputInner]}
            value={instagramUrl}
            onChangeText={setInstagramUrl}
            placeholder="dein.profil"
            placeholderTextColor={colors.textSecondary}
            autoCapitalize="none"
            keyboardType="url"
            maxLength={200}
          />
        </View>
      </View>

      {/* ── Speichern ── */}
      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => { void handleSave(); }}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving ? (
          <ActivityIndicator color={colors.card} />
        ) : (
          <View style={styles.saveBtnInner}>
            <MaterialCommunityIcons name="content-save-outline" size={18} color={colors.card} />
            <Text style={styles.saveBtnText}>Speichern</Text>
          </View>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: 16,
  },
  field: {
    gap: 6,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  fieldLabelText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  col: {
    flex: 1,
  },
  input: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
  },
  bioInput: {
    minHeight: 88,
    lineHeight: 20,
  },
  charCount: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'right',
    marginTop: -4,
  },
  filterError: {
    fontFamily: 'Inter',
    fontSize: 13,
    color: colors.deleteRed,
    marginTop: 8,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  pickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: 10,
  },
  pickerBtnText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
  },
  pickerList: {
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    marginTop: -8,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerItemActive: {
    backgroundColor: colors.accentBlueSoft,
  },
  pickerItemText: {
    fontSize: 14,
    color: colors.text,
  },
  pickerItemTextActive: {
    color: colors.accentBlue,
    fontWeight: '600',
  },
  inputWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 6,
  },
  inputInner: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 10,
  },
  stanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  stanceChip: {
    flex: 1,
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stanceChipActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  stanceChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  stanceChipTextActive: {
    color: colors.card,
  },
  saveBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius: 12,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  saveBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  saveBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
