import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../theme/colors';
import type { FlowStep } from '../../../utils/sparringDraft';
import { useTranslation } from 'react-i18next';

const STEPS: readonly FlowStep[] = [1, 2, 3];

// Top bar of the create flow: back, compact title, three progress segments.
// Done = dark, current = blue and taller, upcoming = hairline, so the current
// step reads without colour as well; the step count is spoken too.
function FlowHeader({ step, onBack, disabled }: {
  step:     FlowStep;
  onBack:   () => void;
  disabled: boolean;
}): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + 8 }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.back}
          onPress={onBack}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={step === 1 ? t('sparring.flow.leave') : t('sparring.flow.previousStep')}
          hitSlop={8}
        >
          <Ionicons name="chevron-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>{t('sparring.flow.title')}</Text>
        <Text style={styles.count} accessibilityLabel={t('sparring.flow.stepOf', { step })}>{step}/3</Text>
      </View>
      <View
        style={styles.segments}
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 1, max: 3, now: step }}
      >
        {STEPS.map((s) => (
          <View
            key={s}
            style={[
              styles.segment,
              s < step && styles.segmentDone,
              s === step && styles.segmentCurrent,
            ]}
          />
        ))}
      </View>
    </View>
  );
}

export default React.memo(FlowHeader);

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    backgroundColor: colors.background,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  count: {
    width: 48,
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '700',
    color: colors.textMuted,
    paddingRight: 8,
  },
  segments: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 8,
  },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.hairline,
  },
  segmentDone: {
    backgroundColor: colors.text,
  },
  segmentCurrent: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accentBlue,
  },
});
