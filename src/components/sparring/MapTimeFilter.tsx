import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

export type TimeFilter = 'all' | 'jetzt' | 'demnaechst' | 'bald';

interface Props {
  value:      TimeFilter;
  onChange:   (f: TimeFilter) => void;
  tabCounts:  Record<string, number>;
  /** Shown instead of the filter when there is nothing at all, e.g. "Keine offenen Sparrings". */
  emptyLabel: string;
}

// Labels match getTimeWindow(): today, the next 7 days, later.
const FILTER_TABS: Array<{ key: Exclude<TimeFilter, 'all'>; labelKey: 'map.timeFilter.today' | 'map.timeFilter.week' | 'map.timeFilter.later' }> = [
  { key: 'jetzt',      labelKey: 'map.timeFilter.today' },
  { key: 'demnaechst', labelKey: 'map.timeFilter.week' },
  { key: 'bald',       labelKey: 'map.timeFilter.later' },
];

// Chips are compact; the slop keeps the touch target near 40 pt.
const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

// One compact row: time window + count. Tapping filters the map, tapping the
// active one again resets to "all". Empty windows are muted and not tappable,
// so a 0 never looks like a result.
export default function MapTimeFilter({ value, onChange, tabCounts, emptyLabel }: Props) {
  const { t } = useTranslation();
  const total = FILTER_TABS.reduce((sum, t) => sum + (tabCounts[t.key] ?? 0), 0);

  if (total === 0) {
    return (
      <View style={styles.container}>
        <Text style={styles.emptyText}>{emptyLabel}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {FILTER_TABS.map((tab) => {
        const count  = tabCounts[tab.key] ?? 0;
        const active = value === tab.key;
        const empty  = count === 0 && !active;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterBtn, active && styles.filterBtnActive]}
            onPress={() => onChange(active ? 'all' : tab.key)}
            disabled={empty}
            hitSlop={HIT_SLOP}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={`${t(tab.labelKey)}: ${count}`}
            accessibilityState={{ selected: active, disabled: empty }}
          >
            <Text style={[styles.filterText, empty && styles.mutedText, active && styles.activeText]} numberOfLines={1}>
              {t(tab.labelKey)}
            </Text>
            <Text style={[styles.countText, empty && styles.mutedCount, active && styles.activeText]}>
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Flat row inside the map header panel.
  container: {
    flexDirection:     'row',
    alignItems:        'center',
    alignSelf:         'flex-start',
    gap:               4,
    paddingHorizontal: 4,
  },
  filterBtn: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            24,
    borderRadius:      12,
    paddingHorizontal: 8,
  },
  filterBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  filterText: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  countText: {
    fontSize:    12,
    fontWeight:  '700',
    color:       colors.text,
    fontVariant: ['tabular-nums'],
  },
  mutedText: {
    color:      colors.textSecondary,
    fontWeight: '500',
  },
  mutedCount: {
    color:      colors.textSecondary,
    fontWeight: '500',
  },
  activeText: {
    color: colors.card,
  },
  emptyText: {
    fontSize:          12,
    fontWeight:        '600',
    color:             colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical:   4,
  },
});
