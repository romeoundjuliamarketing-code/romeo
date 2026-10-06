import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props extends Omit<TextInputProps, 'style' | 'secureTextEntry'> {
  label:      string;
  icon:       React.ComponentProps<typeof Ionicons>['name'];
  error?:     string | null;
  /** Adds the show/hide toggle and masks the value while hidden. */
  isPassword?: boolean;
  inputRef?:  React.Ref<TextInput>;
  /** 'warm': white field, warm-grey border, plain blue border on focus (login). */
  variant?:   'brand' | 'warm';
}

// Labelled text field for the auth screens: label always visible, large touch
// target, royal-blue border plus a soft focus ring while active, error message
// directly below the field.
export default function AuthTextField({
  label, icon, error, isPassword = false, inputRef, variant = 'brand', onFocus, onBlur, ...inputProps
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const hasError = error !== undefined && error !== null && error.length > 0;
  const warm = variant === 'warm';
  const accent = warm ? colors.accentBlue : colors.brandPrimary;
  const muted = warm ? colors.textMuted : colors.brandMuted;

  return (
    <View style={styles.group}>
      <Text style={[styles.label, warm && styles.labelWarm]}>{label}</Text>
      {/* The ring is always there (transparent), so focusing never shifts the layout */}
      <View style={[styles.ring, focused && !hasError && !warm && styles.ringFocused]}>
        <View
          style={[
            styles.field,
            warm && styles.fieldWarm,
            focused && (warm ? styles.fieldFocusedWarm : styles.fieldFocused),
            hasError && styles.fieldError,
          ]}
        >
          <Ionicons
            name={icon}
            size={20}
            color={hasError ? colors.deleteRed : focused ? accent : muted}
          />
          <TextInput
            ref={inputRef}
            style={[styles.input, warm && styles.inputWarm]}
            placeholderTextColor={warm ? colors.textSecondary : colors.brandMuted}
            secureTextEntry={isPassword && !visible}
            accessibilityLabel={label}
            onFocus={(e) => { setFocused(true); onFocus?.(e); }}
            onBlur={(e) => { setFocused(false); onBlur?.(e); }}
            {...inputProps}
          />
          {isPassword && (
            <TouchableOpacity
              onPress={() => setVisible((v) => !v)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={visible ? t('auth.common.hidePassword') : t('auth.common.showPassword')}
            >
              <Ionicons
                name={visible ? 'eye-off-outline' : 'eye-outline'}
                size={20}
                color={muted}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>
      {hasError && (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={16} color={colors.deleteRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
    </View>
  );
}

// Width of the soft focus ring around an active field.
const RING = 4;

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  label: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.brandInk,
  },
  labelWarm: {
    color: colors.text,
  },
  ring: {
    // Extends RING px beyond the field on every side without taking layout space.
    margin:       -RING,
    padding:      RING - 1.5,
    borderRadius: 16 + RING,
    borderWidth:  1.5,
    borderColor:  'transparent',
  },
  ringFocused: {
    borderColor:     colors.brandPrimarySoft,
    backgroundColor: colors.brandPrimarySoft,
  },
  field: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         56,
    paddingHorizontal: 16,
    borderRadius:      16,
    borderWidth:       1.5,
    borderColor:       colors.brandBorder,
    backgroundColor:   colors.card,
  },
  fieldFocused: {
    borderColor: colors.brandPrimary,
  },
  fieldWarm: {
    borderColor: colors.fieldBorder,
  },
  fieldFocusedWarm: {
    borderColor: colors.accentBlue,
  },
  fieldError: {
    borderColor: colors.deleteRed,
  },
  input: {
    flex:            1,
    fontSize:        16,
    color:           colors.brandInk,
    paddingVertical: 16,
  },
  inputWarm: {
    color: colors.text,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           8,
  },
  errorText: {
    flex:       1,
    fontSize:   13,
    lineHeight: 18,
    color:      colors.deleteRed,
  },
});
