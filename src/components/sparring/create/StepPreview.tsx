import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, TouchableOpacity, StyleSheet, Platform, InputAccessoryView, Keyboard,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import { StepTitle, FieldError } from './FlowParts';

const NOTES_ACCESSORY_ID = 'create-sparring-notes-accessory';

// Quiet expandable row; the field only appears once opened.
function Expander({ label, open, onOpen, children }: {
  label: string; open: boolean; onOpen: () => void; children: React.ReactNode;
}): React.ReactElement {
  if (open) return <View style={styles.expanded}>{children}</View>;
  return (
    <Pressable
      style={({ pressed }) => [styles.expander, pressed && styles.expanderPressed]}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityState={{ expanded: false }}
    >
      <Ionicons name="add" size={20} color={colors.accentBlueText} />
      <Text style={styles.expanderText}>{label}</Text>
    </Pressable>
  );
}

function StepPreview({ preview, title, autoTitle, notes, titleError, notesError, onTitle, onNotes, onNotesFocus }: {
  preview:      React.ReactNode;
  title:        string;
  /** Automatic name used without an own title. */
  autoTitle:    string;
  notes:        string;
  titleError:   string | undefined;
  notesError:   string | undefined;
  onTitle:      (t: string) => void;
  onNotes:      (t: string) => void;
  onNotesFocus: () => void;
}): React.ReactElement {
  // Opened rows stay open while they hold text (also after going back).
  const [titleOpen, setTitleOpen] = useState(title.length > 0);
  const [notesOpen, setNotesOpen] = useState(notes.length > 0);
  // Focus only a row the user just opened, not one restored on remount.
  const [justOpened, setJustOpened] = useState<'title' | 'notes' | null>(null);

  return (
    <View>
      <StepTitle text="Dein Sparring steht." />
      {preview}

      <View style={styles.optional}>
        <Expander label="Eigenen Titel hinzufügen" open={titleOpen || titleError !== undefined} onOpen={() => { setTitleOpen(true); setJustOpened('title'); }}>
          <Text style={styles.fieldLabel}>Eigener Titel</Text>
          <TextInput
            style={styles.field}
            value={title}
            onChangeText={onTitle}
            placeholder={autoTitle}
            placeholderTextColor={colors.textMuted}
            returnKeyType="done"
            blurOnSubmit
            autoFocus={justOpened === 'title'}
            accessibilityLabel="Eigener Titel"
            accessibilityHint={`Ohne eigenen Titel heißt das Sparring ${autoTitle}`}
          />
          <Text style={styles.hint}>Leer lassen für „{autoTitle}“.</Text>
          <FieldError text={titleError} />
        </Expander>

        <Expander label="Hinweise ergänzen" open={notesOpen || notesError !== undefined} onOpen={() => { setNotesOpen(true); setJustOpened('notes'); }}>
          <Text style={styles.fieldLabel}>Hinweise</Text>
          <TextInput
            style={[styles.field, styles.multiline]}
            value={notes}
            onChangeText={onNotes}
            placeholder="Zum Beispiel Level, Ausrüstung oder Treffpunktdetails"
            placeholderTextColor={colors.textMuted}
            multiline
            textAlignVertical="top"
            autoFocus={justOpened === 'notes'}
            onFocus={onNotesFocus}
            inputAccessoryViewID={Platform.OS === 'ios' ? NOTES_ACCESSORY_ID : undefined}
            accessibilityLabel="Hinweise"
          />
          <FieldError text={notesError} />
        </Expander>
      </View>

      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={NOTES_ACCESSORY_ID}>
          <View style={styles.accessoryBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} hitSlop={8} accessibilityRole="button">
              <Text style={styles.accessoryDone}>Fertig</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}
    </View>
  );
}

export default StepPreview;

const styles = StyleSheet.create({
  optional: {
    marginTop: 24,
    gap: 8,
  },
  expander: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 8,
    borderRadius: 16,
  },
  expanderPressed: {
    backgroundColor: colors.hairline,
  },
  expanderText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.accentBlueText,
  },
  expanded: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  field: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    fontSize: 16,
    color: colors.text,
  },
  multiline: {
    minHeight: 112,
  },
  hint: {
    marginTop: 8,
    fontSize: 13,
    color: colors.textMuted,
  },
  accessoryBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  accessoryDone: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
});
