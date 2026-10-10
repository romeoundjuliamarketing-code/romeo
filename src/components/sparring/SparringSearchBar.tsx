import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, Keyboard, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { RADIUS_OPTIONS_KM, radiusLabel } from '../../utils/sparringSearch';
import { geocodeAddress } from '../../utils/geocoding';
import type { SearchRadius } from '../../utils/sparringSearch';
import { useTranslation } from 'react-i18next';

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
  /** A typed place was found: the map jumps there (search location unchanged). */
  onPlaceFound:    (lat: number, lng: number, label: string) => void;
  /** Status line with an action, e.g. a failed load with "Erneut versuchen". */
  notice?:         { text: string; actionLabel: string; onAction: () => void } | null;
}

const VIEWS: Array<{ key: SparringView; labelKey: 'map.search.viewMap' | 'map.search.viewList'; icon: React.ComponentProps<typeof Ionicons>['name'] }> = [
  { key: 'map',  labelKey: 'map.search.viewMap', icon: 'map-outline' },
  { key: 'list', labelKey: 'map.search.viewList', icon: 'list-outline' },
];

const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

// Shared search controls for the sparring map and list: one summary row
// ("Dein Standort · 100 km") that opens a compact editor for location and
// radius, plus a small map/list switch. Both views read the same values, so
// switching keeps them.
export default function SparringSearchBar({
  view, onViewChange, locationLabel, onLocationPress, radiusKm, onRadiusChange, open, onOpenChange, onPlaceFound, notice = null,
}: Props) {
  const { t } = useTranslation();
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeNotFound, setPlaceNotFound] = useState(false);
  const [placeFocused, setPlaceFocused] = useState(false);

  async function searchPlace(): Promise<void> {
    const query = placeQuery.trim();
    if (query.length === 0 || placeSearching) return;
    setPlaceSearching(true);
    setPlaceNotFound(false);
    const result = await geocodeAddress(query);
    setPlaceSearching(false);
    if (result === null) {
      setPlaceNotFound(true);
      return;
    }
    Keyboard.dismiss();
    setPlaceQuery('');
    onPlaceFound(result.lat, result.lng, query);
    onOpenChange(false);
  }
  const summary = locationLabel !== null ? `${locationLabel} · ${radiusLabel(radiusKm)}` : t('map.search.chooseLocation');

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
            ? t('map.search.areaA11y', { location: locationLabel, radius: radiusKm === null ? t('map.search.everywhereLower') : t('map.search.kilometers', { count: radiusKm }) })
            : t('map.search.chooseLocation')}
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
                accessibilityLabel={t(opt.labelKey)}
                accessibilityState={{ selected: active }}
              >
                <Ionicons name={opt.icon} size={16} color={active ? colors.card : colors.text} />
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      <View style={[styles.placeRow, placeFocused && styles.placeRowFocused, placeNotFound && styles.placeRowError]}>
        <View style={styles.placeIcon}>
          <Ionicons name="search" size={16} color={colors.accentBlue} />
        </View>
        <TextInput
          style={styles.placeInput}
          value={placeQuery}
          onChangeText={(text) => { setPlaceQuery(text); setPlaceNotFound(false); }}
          onSubmitEditing={() => { void searchPlace(); }}
          onFocus={() => setPlaceFocused(true)}
          onBlur={() => setPlaceFocused(false)}
          placeholder={t('map.search.placePlaceholder')}
          placeholderTextColor={colors.textSecondary}
          selectionColor={colors.accentBlue}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel={t('map.search.placeSearchA11y')}
        />
        {placeQuery.length > 0 && !placeSearching && (
          <TouchableOpacity
            onPress={() => { setPlaceQuery(''); setPlaceNotFound(false); }}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t('map.search.placeClear')}
          >
            <Ionicons name="close-circle" size={16} color={colors.textSecondary} />
          </TouchableOpacity>
        )}
        {placeSearching ? (
          <View style={styles.placeGo}>
            <ActivityIndicator size="small" color={colors.card} />
          </View>
        ) : placeQuery.trim().length > 0 && (
          <TouchableOpacity
            style={styles.placeGo}
            onPress={() => { void searchPlace(); }}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={t('map.search.placeSearchA11y')}
          >
            <Ionicons name="arrow-forward" size={16} color={colors.card} />
          </TouchableOpacity>
        )}
      </View>
      {placeNotFound && (
        <View style={styles.placeErrorRow}>
          <Ionicons name="alert-circle" size={16} color={colors.deleteRed} />
          <Text style={styles.placeError}>{t('map.search.placeNotFound')}</Text>
        </View>
      )}

      {open && locationLabel !== null && (
        <View style={styles.editor}>
          <TouchableOpacity
            style={styles.locationRow}
            onPress={() => { onOpenChange(false); onLocationPress(); }}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('map.search.locationA11y', { location: locationLabel })}
          >
            <Text style={styles.editorLabel}>{t('map.search.location')}</Text>
            <Text style={styles.locationText} numberOfLines={1}>{locationLabel}</Text>
            <Text style={styles.changeText}>{t('map.search.change')}</Text>
          </TouchableOpacity>

          <View style={styles.radiusRow}>
            <Text style={styles.editorLabel}>{t('map.search.radius')}</Text>
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
                  accessibilityLabel={radius === null ? t('map.search.searchEverywhere') : t('map.search.radiusA11y', { count: radius })}
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
  placeRow: {
    flexDirection:   'row',
    alignItems:      'center',
    gap:             8,
    height:          40,
    paddingLeft:     4,
    paddingRight:    4,
    borderRadius:    20,
    borderWidth:     1,
    borderColor:     colors.border,
    backgroundColor: colors.card,
  },
  placeRowFocused: {
    borderColor: colors.accentBlue,
  },
  placeRowError: {
    borderColor: colors.deleteRed,
  },
  placeIcon: {
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.accentBlueTint,
  },
  placeInput: {
    flex:       1,
    height:     40,
    fontSize:   14,
    fontWeight: '500',
    color:      colors.text,
  },
  placeGo: {
    width:           32,
    height:          32,
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.accentBlue,
  },
  placeErrorRow: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
  },
  placeError: {
    fontSize: 13,
    color:    colors.deleteRed,
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
