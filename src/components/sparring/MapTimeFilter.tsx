import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export type TimeFilter = 'all' | 'jetzt' | 'demnaechst' | 'bald';

interface Props {
  value:      TimeFilter;
  onChange:   (f: TimeFilter) => void;
  tabCounts:  Record<string, number>;
}

const FILTER_TABS: Array<{ key: Exclude<TimeFilter, 'all'>; label: string }> = [
  { key: 'jetzt',      label: 'Jetzt' },
  { key: 'demnaechst', label: 'Demnächst' },
  { key: 'bald',       label: 'Bald' },
];

export default function MapTimeFilter({ value, onChange, tabCounts }: Props) {
  return (
    <View style={styles.container}>
      {/* Clear / reset button */}
      <TouchableOpacity
        style={[styles.clearBtn, value === 'all' && styles.clearBtnDimmed]}
        onPress={() => onChange('all')}
        activeOpacity={0.8}
      >
        <Ionicons name="close" size={18} color={colors.text} />
      </TouchableOpacity>

      {/* Stacked filter buttons */}
      {FILTER_TABS.map((tab) => {
        const count  = tabCounts[tab.key] ?? 0;
        const active = value === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.filterBtn, active && styles.filterBtnActive]}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
          >
            <Text style={[styles.filterText, active && styles.filterTextActive]} numberOfLines={1}>
              {tab.label}
            </Text>
            <Text style={[styles.countText, active && styles.countTextActive]}>
              {count}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap:        8,
  },
  clearBtn: {
    width:           40,
    height:          40,
    borderRadius:    20,
    backgroundColor: colors.card,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    4,
    elevation:       4,
  },
  clearBtnDimmed: {
    opacity: 0.35,
  },
  filterBtn: {
    minWidth:          72,
    borderRadius:      16,
    backgroundColor:   colors.card,
    paddingHorizontal: 10,
    paddingVertical:   6,
    alignItems:        'center',
    shadowColor:       colors.dark,
    shadowOffset:      { width: 0, height: 2 },
    shadowOpacity:     0.12,
    shadowRadius:      3,
    elevation:         3,
  },
  filterBtnActive: {
    backgroundColor: colors.accentBlue,
  },
  filterText: {
    fontSize:   11,
    fontWeight: '600',
    color:      colors.textSecondary,
  },
  filterTextActive: {
    color: colors.card,
  },
  countText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.text,
    marginTop:  1,
  },
  countTextActive: {
    color: colors.card,
  },
});
