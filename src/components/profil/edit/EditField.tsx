import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import type { KeyboardTypeOptions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import type { DraftField } from '../../../utils/profileDraft';

interface Props {
  field:        DraftField;
  label:        string;
  value:        string;
  onChange:     (field: DraftField, value: string) => void;
  placeholder?: string;
  optional?:    boolean;
  maxLength?:   number;
  /** Fixed unit inside the field, e.g. "cm", "kg". */
  suffix?:      string;
  /** Fixed prefix inside the field, e.g. "@". */
  prefix?:      string;
  multiline?:   boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words';
  error?:       string;
}

// One labelled input: label above (normal case), white field with a fine
// contour, blue border while focused, error with icon + text at the field.
// Memoized with a stable onChange so typing in one field does not re-render
// the others.
function EditField({
  field, label, value, onChange, placeholder, optional = false, maxLength, suffix, prefix,
  multiline = false, keyboardType, autoCapitalize, error,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const hasError = error !== undefined && error.length > 0;
  const showCounter = maxLength !== undefined && (focused || value.length > maxLength * 0.8);

  return (
    <View style={styles.group}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>{label}</Text>
        {optional && <Text style={styles.optional}>{t('profile.edit.optional')}</Text>}
      </View>
      <View style={[styles.box, multiline && styles.boxMultiline, focused && styles.boxFocused, hasError && styles.boxError]}>
        {prefix !== undefined && <Text style={styles.affix}>{prefix}</Text>}
        <TextInput
          style={[styles.input, multiline && styles.inputMultiline]}
          value={value}
          onChangeText={(text) => onChange(field, maxLength !== undefined ? text.slice(0, maxLength) : text)}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          maxLength={maxLength}
          multiline={multiline}
          textAlignVertical={multiline ? 'top' : 'center'}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCapitalize !== 'none'}
          accessibilityLabel={optional ? t('profile.edit.optionalA11y', { label }) : label}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
        {suffix !== undefined && <Text style={styles.affix}>{suffix}</Text>}
      </View>
      {(hasError || showCounter) && (
        <View style={styles.footer}>
          {hasError ? (
            <View style={styles.errorRow} accessibilityLiveRegion="polite">
              <Ionicons name="alert-circle" size={16} color={colors.deleteRed} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : <View />}
          {showCounter && <Text style={styles.counter}>{value.length}/{maxLength}</Text>}
        </View>
      )}
    </View>
  );
}

export default React.memo(EditField);

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems:    'baseline',
    gap:           8,
  },
  label: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.text,
  },
  optional: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  box: {
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
  boxMultiline: {
    alignItems: 'flex-start',
    minHeight:  112,
  },
  boxFocused: {
    borderColor: colors.accentBlue,
  },
  boxError: {
    borderColor: colors.deleteRed,
  },
  input: {
    flex:            1,
    fontSize:        16,
    color:           colors.text,
    paddingVertical: 16,
  },
  inputMultiline: {
    minHeight: 112,
  },
  affix: {
    fontSize:   16,
    fontWeight: '700',
    color:      colors.textMuted,
  },
  footer: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
    gap:            8,
  },
  errorRow: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           4,
  },
  errorText: {
    flex:     1,
    fontSize: 13,
    color:    colors.deleteRed,
  },
  counter: {
    fontSize: 12,
    color:    colors.textMuted,
  },
});
