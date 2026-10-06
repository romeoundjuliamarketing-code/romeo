import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';
import { withDay, withTime } from '../../../utils/sparringDraft';
import { TextAction } from '../../common/TextAction';
import { FieldError } from './FlowParts';

type PickerMode = 'date' | 'time';

function monthShort(d: Date): string {
  return d.toLocaleDateString('de-DE', { month: 'short' }).replace('.', '').toUpperCase();
}

// Date as a calendar leaf next to a big local time. Tapping opens the native
// picker: inline under the leaf on iOS, the system dialog on Android. All
// values stay local Date objects; the flow converts to UTC only on save.
function WhenPicker({ value, error, onChange }: {
  value:    Date;
  error:    string | undefined;
  onChange: (d: Date) => void;
}): React.ReactElement {
  const [open, setOpen] = useState<PickerMode | null>(null);

  const weekday = value.toLocaleDateString('de-DE', { weekday: 'long' });
  const dateLabel = value.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const time = value.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  function handleChange(mode: PickerMode, event: DateTimePickerEvent, picked: Date | undefined): void {
    if (Platform.OS === 'android') setOpen(null);
    if (event.type !== 'set' || picked === undefined) return;
    onChange(mode === 'date' ? withDay(value, picked) : withTime(value, picked));
  }

  function toggle(mode: PickerMode): void {
    setOpen((current) => (current === mode ? null : mode));
  }

  return (
    <View>
      <View style={styles.row}>
        <Pressable
          style={[styles.leaf, open === 'date' && styles.active]}
          onPress={() => toggle('date')}
          accessibilityRole="button"
          accessibilityLabel={`Datum: ${dateLabel}. Ändern`}
          accessibilityState={{ expanded: open === 'date' }}
        >
          <View style={styles.leafTop}>
            <Text style={styles.leafMonth}>{monthShort(value)}</Text>
          </View>
          <Text style={styles.leafDay} maxFontSizeMultiplier={1.3}>{value.getDate()}</Text>
          <Text style={styles.leafWeekday} numberOfLines={1} adjustsFontSizeToFit>{weekday}</Text>
        </Pressable>

        <Pressable
          style={[styles.time, open === 'time' && styles.active]}
          onPress={() => toggle('time')}
          accessibilityRole="button"
          accessibilityLabel={`Uhrzeit: ${time} Uhr. Ändern`}
          accessibilityState={{ expanded: open === 'time' }}
        >
          <Text style={styles.timeCaption}>Beginn</Text>
          <Text style={styles.timeValue} maxFontSizeMultiplier={1.3} numberOfLines={1} adjustsFontSizeToFit>{time}</Text>
          <Text style={styles.timeCaption}>Uhr, Ortszeit</Text>
        </Pressable>
      </View>
      <FieldError text={error} />

      {open !== null && Platform.OS === 'ios' && (
        <View style={styles.iosPanel}>
          <DateTimePicker
            value={value}
            mode={open}
            display={open === 'date' ? 'inline' : 'spinner'}
            minimumDate={open === 'date' ? new Date() : undefined}
            locale="de-DE"
            themeVariant="light"
            accentColor={colors.accentBlue}
            onChange={(e, d) => handleChange(open, e, d)}
          />
          <View style={styles.iosDone}>
            <TextAction label="Fertig" onPress={() => setOpen(null)} />
          </View>
        </View>
      )}
      {open !== null && Platform.OS === 'android' && (
        <DateTimePicker
          value={value}
          mode={open}
          display="default"
          is24Hour
          minimumDate={open === 'date' ? new Date() : undefined}
          onChange={(e, d) => handleChange(open, e, d)}
        />
      )}
    </View>
  );
}

export default React.memo(WhenPicker);

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 16,
    alignItems: 'stretch',
  },
  active: {
    borderColor: colors.accentBlue,
  },
  leaf: {
    width: 120,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.card,
    overflow: 'hidden',
    alignItems: 'center',
    paddingBottom: 16,
  },
  leafTop: {
    alignSelf: 'stretch',
    backgroundColor: colors.dark,
    paddingVertical: 8,
    alignItems: 'center',
  },
  leafMonth: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2,
    color: colors.headerTextPrimary,
  },
  leafDay: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 64,
    color: colors.text,
  },
  leafWeekday: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textMuted,
    paddingHorizontal: 8,
  },
  time: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.card,
    padding: 16,
    justifyContent: 'center',
  },
  timeCaption: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  timeValue: {
    fontFamily: fonts.display,
    fontSize: 56,
    lineHeight: 64,
    color: colors.text,
  },
  iosPanel: {
    marginTop: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    overflow: 'hidden',
    paddingVertical: 8,
  },
  iosDone: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
  },
});
