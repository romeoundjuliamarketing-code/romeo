import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

interface Props {
  title:         string;
  discipline:    string;
  bannerColor:   string;
  dateLabel:     string;
  takingPart:    number;
  slotsLeft:     number;
  durationMin:   number;
  isFeatured:    boolean;
  verifiedOnly:  boolean;
  isCreator:     boolean;
  hasStarted:    boolean;
  /** Organizer changed the sparring after publishing it */
  edited:        boolean;
  onClose:       () => void;
}

// Compact banner of the sparring detail window: discipline + close, the
// organizer's title (user content, shown as entered), when, and the three
// numbers that matter at a glance.
export default function SparringDetailHeader({
  title, discipline, bannerColor, dateLabel, takingPart, slotsLeft, durationMin,
  isFeatured, verifiedOnly, isCreator, hasStarted, edited, onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const slotsLabel = hasStarted
    ? t('sparring.detailHeader.over')
    : slotsLeft <= 0
      ? t('sparring.detailHeader.soldOut')
      : t('sparring.detailHeader.slotsFree', { count: slotsLeft });

  return (
    <View style={[styles.banner, { backgroundColor: bannerColor }]}>
      <View style={styles.topRow}>
        <View style={styles.chips}>
          <View style={styles.chip}>
            <Text style={styles.chipText} numberOfLines={1}>{discipline}</Text>
          </View>
          {isFeatured && (
            <View style={styles.chip}>
              <Ionicons name="checkmark-circle" size={14} color={colors.card} />
              <Text style={styles.chipText}>Sparr Pick</Text>
            </View>
          )}
          {verifiedOnly && (
            <View style={styles.chip}>
              <Ionicons name="shield-checkmark-outline" size={14} color={colors.card} />
              <Text style={styles.chipText}>{t('sparring.detailHeader.verifiedOnly')}</Text>
            </View>
          )}
          {isCreator && (
            <View style={styles.chip}>
              <Text style={styles.chipText}>{t('sparring.detailHeader.yours')}</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.closeBtn}
          onPress={onClose}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel={t('sparring.detailHeader.close')}
        >
          <Ionicons name="close" size={22} color={colors.card} />
        </TouchableOpacity>
      </View>

      <Text style={styles.title} numberOfLines={2} accessibilityRole="header">{title}</Text>
      <Text style={styles.date}>
        {dateLabel}
        {edited && <Text style={styles.edited}> · {t('sparring.detailHeader.edited')}</Text>}
      </Text>

      <View style={styles.stats}>
        <Stat icon="people" label={t('sparring.detailHeader.takingPart', { count: takingPart })} />
        <Stat icon={slotsLeft <= 0 && !hasStarted ? 'lock-closed' : 'ticket-outline'} label={slotsLabel} />
        <Stat icon="time-outline" label={t('sparring.detailHeader.minutes', { count: durationMin })} />
      </View>
    </View>
  );
}

function Stat({ icon, label }: { icon: React.ComponentProps<typeof Ionicons>['name']; label: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={colors.card} />
      <Text style={styles.statText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     24,
    gap:               8,
  },
  topRow: {
    flexDirection:  'row',
    alignItems:     'flex-start',
    justifyContent: 'space-between',
    gap:            16,
  },
  chips: {
    flex:          1,
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
    paddingTop:    4,
  },
  chip: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    backgroundColor:   colors.headerBorder,
    borderRadius:      8,
    paddingHorizontal: 8,
    paddingVertical:   4,
    maxWidth:          '100%',
  },
  chipText: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.card,
  },
  closeBtn: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.headerBorder,
    alignItems:      'center',
    justifyContent:  'center',
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    lineHeight: 28,
    color:      colors.card,
    marginTop:  8,
  },
  date: {
    fontSize:      13,
    fontWeight:    '700',
    letterSpacing: 1,
    color:         colors.headerTextSecondary,
  },
  edited: {
    fontWeight: '500',
    color:      colors.headerTextSecondary,
  },
  stats: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    columnGap:     16,
    rowGap:        8,
    marginTop:     8,
  },
  stat: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  statText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.card,
  },
});
