import React, { useState } from 'react';
import { View, Text, Pressable, Modal, Platform, StyleSheet } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { useLanguage } from '../../i18n/language';
import { formatDate } from '../../utils/formatDate';
import { calendarDateOf, type CalendarDate } from '../../utils/onboarding';

const MIN_DATE = new Date(1900, 0, 1);
// Where the wheel starts when nothing was chosen yet. Only a start position:
// nothing is taken over until the user confirms.
const START_YEARS_AGO = 20;

function toLocalDate(c: CalendarDate): Date {
  return new Date(c.year, c.month - 1, c.day);
}

// Birth date field: shows the placeholder until a date was explicitly
// confirmed (Android dialog "OK", iOS "Übernehmen"). Native picker only.
export default function BirthDateField({ value, onChange, error, hint }: {
  value:    CalendarDate | null;
  onChange: (next: CalendarDate) => void;
  error:    string | null;
  hint:     string;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<Date | null>(null);
  const today = new Date();
  const start = value !== null
    ? toLocalDate(value)
    : new Date(today.getFullYear() - START_YEARS_AGO, today.getMonth(), today.getDate());
  const label = t('onboarding.profile.birthLabel');
  const shown = value !== null ? formatDate(toLocalDate(value), 'dateLong', language) : null;
  const hasError = error !== null;

  function openPicker(): void {
    setPending(start);
    setOpen(true);
  }

  function onAndroidChange(event: DateTimePickerEvent, date?: Date): void {
    setOpen(false);
    if (event.type === 'set' && date !== undefined) onChange(calendarDateOf(date));
  }

  function confirmIos(): void {
    if (pending !== null) onChange(calendarDateOf(pending));
    setOpen(false);
  }

  return (
    <View style={styles.group}>
      <Text style={styles.label} nativeID="birthDateLabel">{label}</Text>
      <Pressable
        style={({ pressed }) => [styles.field, hasError && styles.fieldError, pressed && styles.fieldPressed]}
        onPress={openPicker}
        accessibilityRole="button"
        accessibilityLabel={`${label}, ${shown ?? t('onboarding.profile.birthPlaceholder')}`}
        accessibilityHint={hint}
      >
        <Text style={[styles.value, shown === null && styles.placeholder]}>
          {shown ?? t('onboarding.profile.birthPlaceholder')}
        </Text>
        <Ionicons name="chevron-down" size={20} color={colors.textMuted} />
      </Pressable>
      {hasError ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite" accessibilityRole="alert">
          <Ionicons name="alert-circle" size={16} color={colors.deleteRed} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <Text style={styles.hint}>{hint}</Text>
      )}

      {open && Platform.OS === 'android' && (
        <DateTimePicker
          value={start}
          mode="date"
          display="default"
          minimumDate={MIN_DATE}
          maximumDate={today}
          onChange={onAndroidChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
          {/* Dim sits behind the whole sheet, so its rounded corners stay clean. */}
          <View style={styles.sheetWrap}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} accessible={false} />
            <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]} accessibilityViewIsModal>
              <View style={styles.sheetBar}>
                <Pressable style={styles.sheetAction} onPress={() => setOpen(false)} accessibilityRole="button">
                  <Text style={styles.sheetCancel}>{t('onboarding.profile.pickerCancel')}</Text>
                </Pressable>
                <Pressable style={styles.sheetAction} onPress={confirmIos} accessibilityRole="button">
                  <Text style={styles.sheetConfirm}>{t('onboarding.profile.pickerConfirm')}</Text>
                </Pressable>
              </View>
              <DateTimePicker
                value={pending ?? start}
                mode="date"
                display="spinner"
                themeVariant="light"
                textColor={colors.text}
                locale={language}
                minimumDate={MIN_DATE}
                maximumDate={today}
                onChange={(_e, date) => { if (date !== undefined) setPending(date); }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: 8 },
  label: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  field: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         56,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      16,
    borderWidth:       1.5,
    borderColor:       colors.fieldBorder,
    backgroundColor:   colors.card,
  },
  fieldPressed: { borderColor: colors.accentBlue },
  fieldError: { borderColor: colors.deleteRed },
  value: {
    flex:     1,
    fontSize: 16,
    color:    colors.text,
  },
  placeholder: { color: colors.textSecondary },
  hint: {
    fontSize:   13,
    lineHeight: 18,
    color:      colors.textMuted,
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
  sheetWrap: {
    flex:            1,
    justifyContent:  'flex-end',
    backgroundColor: colors.mapOverlay,
  },
  sheet: {
    borderTopLeftRadius:  24,
    borderTopRightRadius: 24,
    overflow:             'hidden',
    backgroundColor:      colors.card,
  },
  sheetBar: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    paddingHorizontal: 8,
    paddingTop:        8,
  },
  sheetAction: {
    minHeight:         44,
    justifyContent:    'center',
    paddingHorizontal: 8,
  },
  sheetCancel: { fontSize: 16, color: colors.textMuted },
  sheetConfirm: { fontSize: 16, fontWeight: '700', color: colors.accentBlueText },
});
