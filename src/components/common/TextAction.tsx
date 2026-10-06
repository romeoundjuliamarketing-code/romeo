import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

// Quiet text button in brand blue (44 pt touch target), e.g. "Erneut versuchen",
// "Weitere laden", "Korrektur vorschlagen".
export function TextAction({ label, onPress, icon, trailingIcon, loading = false, disabled = false, role = 'button' }: {
  label:         string;
  onPress:       () => void;
  icon?:         IconName;
  trailingIcon?: IconName;
  loading?:      boolean;
  disabled?:     boolean;
  role?:         'button' | 'link';
}): React.ReactElement {
  return (
    <TouchableOpacity
      style={styles.action}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.6}
      accessibilityRole={role}
    >
      {loading ? <ActivityIndicator color={colors.accentBlue} /> : (
        <>
          {icon !== undefined && <Ionicons name={icon} size={18} color={colors.accentBlueText} />}
          <Text style={styles.label}>{label}</Text>
          {trailingIcon !== undefined && <Ionicons name={trailingIcon} size={16} color={colors.accentBlueText} />}
        </>
      )}
    </TouchableOpacity>
  );
}

// Error message with a retry action — for lists that failed to load.
export function RetryNotice({ message, onRetry }: { message: string; onRetry: () => void }): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View>
      <Text style={styles.message}>{message}</Text>
      <TextAction label={t('common.retry')} onPress={onRetry} />
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    flexDirection:  'row',
    alignItems:     'center',
    alignSelf:      'flex-start',
    gap:            8,
    minHeight:      44,
  },
  label: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  message: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
});
