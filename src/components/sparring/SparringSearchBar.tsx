import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { RADIUS_OPTIONS_KM, radiusLabel } from '../../utils/sparringSearch';
import type { SearchRadius } from '../../utils/sparringSearch';

// The fixed steps plus "Überall" (null: no radius, all of DACH).
const RADIUS_CHOICES: SearchRadius[] = [...RADIUS_OPTIONS_KM, null];

export type SparringView = 'map' | 'list';

interface Props {
  view:            SparringView;
  onViewChange:    (v: SparringView) => void;
  /** "Dein Standort", the picked address, or null without a search location. */
  locationLabel:   string | null;
  onLocationPress: () => void;
  radiusKm:        SearchRadius;
  onRadiusChange:  (radius: SearchRadius) => void;
  /** Whether the location/radius editor below the summary row is open. */
  open:            boolean;
  onOpenChange:    (open: boolean) => void;
  /** Status line with an action, e.g. a failed load with "Erneut versuchen". */
  notice?:         { text: string; actionLabel: string; onAction: () => void } | null;
}

const VIEWS: Array<{ key: SparringView; label: string; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'map',  label: 'Karte', icon: 'map-outline' },
  { key: 'list', label: 'Liste', icon: 'list-outline' },
];

const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

// Shared search controls for the sparring map and list: one summary row
// ("Dein Standort · 100 km") that opens a compact editor for location and
// radius, plus a small map/list switch. Both views read the same values, so
// switching keeps them.
export default function SparringSearchBar({
  view, onViewChange, locationLabel, onLocationPress, radiusKm, onRadiusChange, open, onOpenChange, notice = null,
}: Props) {
  const summary = locationLabel !== null ? `${locationLabel} · ${radiusLabel(radiusKm)}` : 'Standort wählen';

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.summary}
          onPress={locationLabel !== null ? () => onOpenChange(!open) : onLocationPress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={locationLabel !== null
            ? `Suchbereich: ${locationLabel}, ${radiusKm === null ? 'überall' : `${radiusKm} Kilometer`}. Ändern`
            : 'Standort wählen'}
        >
          <Ionicons name="location" size={16} color={colors.accentBlue} />
          <Text style={styles.summaryText} numberOfLines={1}>{summary}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={colors.textMuted} />
        </TouchableOpacity>

        <View style={styles.viewSwitch}>
          {VIEWS.map((opt) => {
            const active = view === opt.key;
            return (
              <TouchableOpacity
                key={opt.key}
                style={[styles.viewBtn, active && styles.viewBtnActive]}
                onPress={() => onViewChange(opt.key)}
                activeOpacity={0.8}
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={16} color={active ? colors.card : colors.text} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {open && locationLabel !== null && (
        <View style={styles.editor}>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => { onOpenChange(false); onLocationPress(); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`Suchort: ${locationLabel}. Ändern`}
          >
            <Text style={styles.editorLabel}>Suchort</Text>
            <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
            <Text style={styles.changeText}>Ändern</Text>
          </TouchableOpacity>

          <View style={styles.radiusRow}>
            <Text style={styles.editorLabel}>Umkreis</Text>
            {RADIUS_CHOICES.map((radius) => {
              const active = radius === radiusKm;
              return (
                <TouchableOpacity
                  key={radius ?? 'all'}
                  style={[styles.radiusChip, active && styles.radiusChipActive]}
                  onPress={() => { onRadiusChange(radius); onOpenChange(false); }}
                  hitSlop={HIT_SLOP}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={radius === null ? 'Überall suchen' : `Umkreis ${radius} Kilometer`}
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.radiusText, active && styles.radiusTextActive]}>{radiusLabel(radius)}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {notice !== null && (
        <View style={styles.noticeRow}>
          <Text style={styles.noticeText} numberOfLines={2}>{notice.text}</Text>
          <TouchableOpacity onPress={notice.onAction} hitSlop={HIT_SLOP} accessibilityRole="button">
            <Text style={styles.changeText}>{notice.actionLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  summary: {
    flex:              1,
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    height:            40,
    paddingHorizontal: 16,
    borderRadius:      16,
    backgroundColor:   colors.card,
  },
  summaryText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  viewSwitch: {
    flexDirection:   'row',
    height:          40,
    padding:         4,
    borderRadius:    16,
    backgroundColor: colors.card,
  },
  viewBtn: {
    width:          40,
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   12,
  },
  viewBtnActive: {
    backgroundColor: colors.dark,
  },
  editor: {
    backgroundColor: colors.card,
    borderRadius:    16,
    padding:         8,
    gap:             8,
  },
  editorLabel: {
    width:    64,
    fontSize: 13,
    color:    colors.textMuted,
  },
  locationRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    minHeight:         40,
    paddingHorizontal: 8,
  },
  locationText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  changeText: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.accentBlue,
  },
  radiusRow: {
    flexDirection:     'row',
    alignItems:        'center',
    flexWrap:          'wrap',
    gap:               8,
    paddingHorizontal: 8,
    paddingBottom:     8,
  },
  radiusChip: {
    paddingHorizontal: 8,
    paddingVertical:   4,
    borderRadius:      16,
    backgroundColor:   colors.background,
  },
  radiusChipActive: {
    backgroundColor: colors.accentBlue,
  },
  radiusText: {
    fontSize:   13,
    fontWeight: '600',
    color:      colors.text,
  },
  radiusTextActive: {
    color: colors.card,
  },
  noticeRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 8,
  },
  noticeText: {
    flex:     1,
    fontSize: 13,
    color:    colors.text,
  },
});
