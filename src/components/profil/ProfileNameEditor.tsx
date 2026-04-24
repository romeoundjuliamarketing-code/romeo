import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface ProfileNameEditorProps {
  name: string | null;
  onSave: (name: string) => Promise<void>;
}

export default function ProfileNameEditor({ name, onSave }: ProfileNameEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  function startEdit(): void {
    setDraft(name ?? '');
    setEditing(true);
  }

  function cancel(): void {
    setEditing(false);
  }

  async function save(): Promise<void> {
    const trimmed = draft.trim();
    if (trimmed.length === 0) return;
    setSaving(true);
    await onSave(trimmed);
    setSaving(false);
    setEditing(false);
  }

  if (editing) {
    return (
      <View style={styles.editRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          autoFocus
          returnKeyType="done"
          onSubmitEditing={save}
          maxLength={40}
          placeholder="Dein Name"
          placeholderTextColor={colors.inactive}
        />
        <TouchableOpacity onPress={cancel} style={styles.actionButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="close" size={20} color={colors.inactive} />
        </TouchableOpacity>
        <TouchableOpacity onPress={save} style={styles.actionButton} activeOpacity={0.7} disabled={saving}>
          {saving ? (
            <ActivityIndicator size={18} color={colors.accentBlue} />
          ) : (
            <MaterialCommunityIcons name="check" size={20} color={colors.accentBlue} />
          )}
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.displayRow}>
      <Text style={styles.nameText} numberOfLines={1}>
        {name ?? 'Name hinzufügen'}
      </Text>
      <TouchableOpacity onPress={startEdit} activeOpacity={0.7} style={styles.pencilButton}>
        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.inactive} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  displayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    flexShrink: 1,
  },
  pencilButton: {
    padding: 4,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.3,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.accentBlue,
    paddingVertical: 2,
  },
  actionButton: {
    padding: 4,
  },
});
