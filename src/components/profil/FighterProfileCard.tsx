import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import { colors } from '../../theme/colors';
import type { Profile, ProfileUpdate } from '../../types/database.types';

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

interface FighterProfileCardProps {
  profile:       Profile | null;
  updateProfile: (updates: ProfileUpdate) => Promise<void>;
}

export default function FighterProfileCard({
  profile,
  updateProfile,
}: FighterProfileCardProps): React.ReactElement {
  const [nickname,     setNickname]     = useState(profile?.nickname      ?? '');
  const [weightClass,  setWeightClass]  = useState(profile?.weight_class  ?? '');
  const [weightKg,     setWeightKg]     = useState(
    profile?.weight_kg !== null && profile?.weight_kg !== undefined
      ? String(profile.weight_kg)
      : '',
  );
  const [nationality,  setNationality]  = useState(profile?.nationality   ?? '');
  const [hometown,     setHometown]     = useState(profile?.hometown       ?? '');
  const [bio,          setBio]          = useState(profile?.bio            ?? '');
  const [instagramUrl, setInstagramUrl] = useState(profile?.instagram_url  ?? '');
  const [pickerOpen,   setPickerOpen]   = useState(false);
  const [saving,       setSaving]       = useState(false);

  async function handleSave(): Promise<void> {
    setSaving(true);
    await updateProfile({
      nickname:      nickname.trim().length     > 0 ? nickname.trim()                         : null,
      weight_class:  weightClass.length         > 0 ? weightClass                             : null,
      weight_kg:     weightKg.trim().length     > 0 ? parseFloat(weightKg.replace(',', '.'))  : null,
      nationality:   nationality.trim().length  > 0 ? nationality.trim()                      : null,
      hometown:      hometown.trim().length     > 0 ? hometown.trim()                         : null,
      bio:           bio.trim().length          > 0 ? bio.trim().slice(0, 300)                : null,
      instagram_url: instagramUrl.trim().length > 0 ? instagramUrl.trim()                     : null,
    });
    setSaving(false);
    Alert.alert('Gespeichert', 'Kämpferprofil wurde aktualisiert.');
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Kämpferprofil</Text>

      <Text style={styles.label}>Kampfname</Text>
      <TextInput
        style={styles.input}
        value={nickname}
        onChangeText={setNickname}
        placeholder='z.B. "The Hammer"'
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
      />

      <Text style={styles.label}>Gewichtsklasse</Text>
      <TouchableOpacity
        style={styles.pickerBtn}
        onPress={() => setPickerOpen((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={[styles.pickerBtnText, weightClass.length === 0 && styles.placeholder]}>
          {weightClass.length > 0 ? weightClass : 'Auswählen...'}
        </Text>
      </TouchableOpacity>
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
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={styles.label}>Kampfgewicht (kg)</Text>
      <TextInput
        style={styles.input}
        value={weightKg}
        onChangeText={setWeightKg}
        placeholder="z.B. 70"
        placeholderTextColor={colors.textSecondary}
        keyboardType="decimal-pad"
        maxLength={6}
      />

      <Text style={styles.label}>Nationalität</Text>
      <TextInput
        style={styles.input}
        value={nationality}
        onChangeText={setNationality}
        placeholder="z.B. Deutsch"
        placeholderTextColor={colors.textSecondary}
        maxLength={50}
      />

      <Text style={styles.label}>Heimatstadt</Text>
      <TextInput
        style={styles.input}
        value={hometown}
        onChangeText={setHometown}
        placeholder="z.B. München"
        placeholderTextColor={colors.textSecondary}
        maxLength={100}
      />

      <Text style={styles.label}>Über mich</Text>
      <TextInput
        style={[styles.input, styles.bioInput]}
        value={bio}
        onChangeText={(t) => setBio(t.slice(0, 300))}
        placeholder="Kurze Vorstellung, Kampfstil, Ziele..."
        placeholderTextColor={colors.textSecondary}
        multiline
        maxLength={300}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{bio.length}/300</Text>

      <Text style={styles.label}>Instagram-Link</Text>
      <TextInput
        style={styles.input}
        value={instagramUrl}
        onChangeText={setInstagramUrl}
        placeholder="https://instagram.com/username"
        placeholderTextColor={colors.textSecondary}
        autoCapitalize="none"
        keyboardType="url"
        maxLength={200}
      />

      <TouchableOpacity
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={() => { void handleSave(); }}
        disabled={saving}
        activeOpacity={0.8}
      >
        {saving
          ? <ActivityIndicator color={colors.card} />
          : <Text style={styles.saveBtnText}>Speichern</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius:    16,
    padding:         16,
    gap:             8,
  },
  title: {
    fontSize:     15,
    fontWeight:   '700',
    color:        colors.text,
    marginBottom: 8,
  },
  label: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textSecondary,
    marginTop:  8,
  },
  input: {
    backgroundColor:   colors.background,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   10,
    fontSize:          14,
    color:             colors.text,
  },
  bioInput: {
    minHeight: 80,
  },
  charCount: {
    fontSize:  11,
    color:     colors.textSecondary,
    textAlign: 'right',
    marginTop: -4,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  pickerBtn: {
    backgroundColor:   colors.background,
    borderRadius:      10,
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  pickerBtnText: {
    fontSize: 14,
    color:    colors.text,
  },
  pickerList: {
    backgroundColor: colors.background,
    borderRadius:    10,
    overflow:        'hidden',
  },
  pickerItem: {
    paddingHorizontal: 12,
    paddingVertical:   10,
  },
  pickerItemActive: {
    backgroundColor: colors.accentBlueSoft,
  },
  pickerItemText: {
    fontSize: 14,
    color:    colors.text,
  },
  pickerItemTextActive: {
    color:      colors.accentBlue,
    fontWeight: '600',
  },
  saveBtn: {
    backgroundColor: colors.accentBlue,
    borderRadius:    12,
    height:          48,
    alignItems:      'center',
    justifyContent:  'center',
    marginTop:       8,
  },
  saveBtnDisabled: {
    backgroundColor: colors.accentBlueMuted,
  },
  saveBtnText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
