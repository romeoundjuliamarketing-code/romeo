import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import SheetShell, { useMountedOnce } from '../common/SheetShell';

interface Props {
  visible:    boolean;
  unlocked:   boolean;
  baseKm:     number;
  unlockedKm: number;
  onClose:    () => void;
}

// "Wo kannst du mitmachen?": the reach rule on demand, opened from the info
// row of the Home start scene. Values come from get_sparring_reach_status.
export default function ReachInfoSheet({ visible, unlocked, baseKm, unlockedKm, onClose }: Props): React.ReactElement | null {
  const { t } = useTranslation();
  const mounted = useMountedOnce(visible);
  if (!mounted) return null;

  const stepsLabel = unlocked
    ? `${t('home.start.stepStart', { km: baseKm })}, ${t('home.start.stepUnlocked', { km: unlockedKm })}: ${t('home.start.stepDone')}`
    : `${t('home.start.stepStart', { km: baseKm })}, ${t('home.start.stepUnlocked', { km: unlockedKm })}`;

  return (
    <SheetShell visible={visible} title={t('home.start.sheetTitle')} onClose={onClose}>
      <Text style={styles.body}>
        {unlocked
          ? t('home.start.sheetBodyUnlocked', { km: unlockedKm })
          : t('home.start.sheetBody', { base: baseKm, unlocked: unlockedKm })}
      </Text>

      {/* 150 km -> 300 km: the current step strong blue, the other one quiet. */}
      <View style={styles.steps} accessible accessibilityLabel={stepsLabel}>
        <View style={[styles.step, !unlocked && styles.stepActive]}>
          <Text style={[styles.stepText, !unlocked && styles.stepTextActive]}>
            {t('home.start.stepStart', { km: baseKm })}
          </Text>
        </View>
        <Ionicons name="arrow-forward" size={20} color={colors.accentBlueText} />
        <View style={[styles.step, unlocked && styles.stepActive]}>
          {unlocked && <Ionicons name="checkmark-circle" size={16} color={colors.dark} />}
          {!unlocked && <Ionicons name="lock-closed" size={14} color={colors.textMuted} />}
          <Text style={[styles.stepText, unlocked && styles.stepTextActive]}>
            {t('home.start.stepUnlocked', { km: unlockedKm })}
          </Text>
        </View>
      </View>

      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onClose}
        accessibilityRole="button"
      >
        <Text style={styles.buttonText}>{t('home.start.ok')}</Text>
      </Pressable>
    </SheetShell>
  );
}

const styles = StyleSheet.create({
  body: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
  },
  steps: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 8,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.accentBlueTint,
  },
  stepActive: {
    backgroundColor: colors.accentBlue,
  },
  stepText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  // Dark text on blue keeps > 6:1 (white would be ~3.3:1).
  stepTextActive: {
    color: colors.dark,
  },
  button: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.accentBlue,
  },
  buttonPressed: {
    backgroundColor: colors.accentBluePressed,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.dark,
  },
});
