import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { GYM_LIMITS } from '../../../utils/gymSearch';
import { placeNeedsLabel, PLACE_LABEL_MAX, type DraftGym } from '../../../utils/sparringDraft';
import type { SparringPlace } from '../../../types/sparringTrust';
import type { TrustAction } from '../../../utils/sparringTrust';
import { usePlaceSearch, type PlaceSearchError } from '../../../hooks/usePlaceSearch';
import { useSearchLocation } from '../../../hooks/useSearchLocation';
import { useLanguage } from '../../../i18n/language';
import { TextAction } from '../../common/TextAction';
import { FieldError } from './FlowParts';
import PlaceSuggestForm from './PlaceSuggestForm';
import LocationPickerModal from '../LocationPickerModal';

export interface PlaceActions {
  onPickGym:    () => void;
  onUseStudio:  () => void;
  onClearLink:  () => void;
  onPickPlace:  (place: SparringPlace) => void;
  onClearPlace: () => void;
  onLabel:      (text: string) => void;
  onAccessNote: (text: string) => void;
  onTrustAction: (action: TrustAction) => void;
  /** The pre-fill was consumed (search started). */
  onPrefillUsed: () => void;
}

/** Pre-fills the search (gym / studio pick); nonce makes repeats re-run it. */
export interface SearchPrefill {
  text:  string;
  nonce: number;
}

type SearchStatus = 'idle' | 'noResults' | 'pinNone' | PlaceSearchError;

function PlaceResultRow({ place, onPick }: { place: SparringPlace; onPick: (p: SparringPlace) => void }): React.ReactElement {
  return (
    <Pressable
      style={({ pressed }) => [styles.result, pressed && styles.resultPressed]}
      onPress={() => onPick(place)}
      accessibilityRole="button"
      accessibilityLabel={`${place.name}, ${place.address}`}
    >
      <Ionicons name="location-outline" size={20} color={colors.accentBlueText} />
      <View style={styles.resultText}>
        <Text style={styles.resultName} numberOfLines={2}>{place.name}</Text>
        <Text style={styles.resultAddress} numberOfLines={2}>{place.address}</Text>
      </View>
    </Pressable>
  );
}

function PlaceSection({ gym, atStudio, studioAvailable, studioName, place, placeLabel, accessNote, error, prefill, notice, actions }: {
  gym:             DraftGym | null;
  atStudio:        boolean;
  /** Coach with a team studio: "Mein Studio als Ort" is offered. */
  studioAvailable: boolean;
  /** Shown in the studio chip; empty falls back to a generic label. */
  studioName:      string;
  place:           SparringPlace | null;
  placeLabel:      string;
  accessNote:      string;
  error:           string | undefined;
  prefill:         SearchPrefill | null;
  /** Too-far notice etc., rendered under the place card. */
  notice:          React.ReactNode;
  actions:         PlaceActions;
}): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const { location } = useSearchLocation({ askPermission: false });
  const { searching, search, resolvePin } = usePlaceSearch();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SparringPlace[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [noteOpen, setNoteOpen] = useState(accessNote.length > 0);
  const requestRef = useRef(0);
  const nearRef = useRef<{ lat: number; lng: number } | null>(null);
  nearRef.current = location !== null ? { lat: location.lat, lng: location.lng } : null;

  const run = useCallback(async (text: string): Promise<void> => {
    const trimmed = text.trim();
    if (trimmed.length < 2) return;
    requestRef.current += 1;
    const mine = requestRef.current;
    const outcome = await search(trimmed, nearRef.current, language);
    if (mine !== requestRef.current) return;
    setResults(outcome.places);
    setStatus(outcome.error !== null ? outcome.error : outcome.places.length === 0 ? 'noResults' : 'idle');
  }, [search, language]);

  const lastNonce = useRef<number>(-1);
  useEffect(() => {
    if (prefill === null || prefill.nonce === lastNonce.current) return;
    lastNonce.current = prefill.nonce;
    setQuery(prefill.text);
    setResults([]);
    setStatus('idle');
    void run(prefill.text);
    actions.onPrefillUsed();
  }, [prefill, run, actions]);

  const pick = useCallback((p: SparringPlace) => {
    setResults([]);
    setStatus('idle');
    actions.onPickPlace(p);
  }, [actions]);

  // Map pin (e.g. a meadow): the server describes and stores the point, the
  // result is taken like a search hit.
  const handlePin = useCallback(async (lat: number, lng: number): Promise<void> => {
    setPickerOpen(false);
    setResults([]);
    setStatus('idle');
    requestRef.current += 1;
    const mine = requestRef.current;
    const outcome = await resolvePin(lat, lng, language);
    if (mine !== requestRef.current) return;
    const first = outcome.places[0];
    if (outcome.error === null && first !== undefined) {
      pick(first);
      return;
    }
    setStatus(outcome.error !== null ? outcome.error : 'pinNone');
  }, [resolvePin, language, pick]);

  const link = (
    <View style={styles.linkRow}>
      {gym !== null ? (
        <View style={styles.chip}>
          <Ionicons name="business" size={16} color={colors.accentBlueText} />
          <Text style={styles.chipText} numberOfLines={1}>{gym.name}</Text>
          <TouchableOpacity onPress={actions.onClearLink} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('sparring.place.removeGym')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : atStudio ? (
        <View style={styles.chip}>
          <Ionicons name="home" size={16} color={colors.accentBlueText} />
          <Text style={styles.chipText} numberOfLines={1}>{studioName.trim() !== '' ? studioName : t('sparring.place.studioLocation')}</Text>
          <TouchableOpacity onPress={actions.onClearLink} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('sparring.place.removePlace')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ) : null}
      <TextAction label={gym !== null ? t('sparring.place.otherGym') : t('sparring.place.pickGym')} icon="business-outline" onPress={actions.onPickGym} />
      {studioAvailable && !atStudio && (
        <TextAction label={t('sparring.place.atStudio')} icon="home-outline" onPress={actions.onUseStudio} />
      )}
    </View>
  );

  return (
    <View>
      {place === null ? (
        <View>
          <View style={styles.searchRow}>
            <TextInput
              style={[styles.field, styles.searchInput]}
              value={query}
              onChangeText={setQuery}
              placeholder={t('sparringTrust.create.placeSearchPlaceholder')}
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              onSubmitEditing={() => { void run(query); }}
              autoCorrect={false}
              accessibilityLabel={t('sparringTrust.create.placeSearchPlaceholder')}
            />
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => { void run(query); }}
              disabled={searching}
              accessibilityRole="button"
              accessibilityLabel={t('sparringTrust.create.search')}
            >
              {searching ? <ActivityIndicator color={colors.headerTextPrimary} /> : (
                <Ionicons name="search" size={20} color={colors.headerTextPrimary} />
              )}
            </TouchableOpacity>
          </View>
          <Text style={styles.note}>{t('sparringTrust.create.placeSearchHint')}</Text>
          <TextAction label={t('sparringTrust.create.pickOnMap')} icon="map-outline" onPress={() => setPickerOpen(true)} />

          {results.map((p) => <PlaceResultRow key={p.id} place={p} onPick={pick} />)}
          {status === 'noResults' && <Text style={styles.note}>{t('sparringTrust.create.noResults')}</Text>}
          {status === 'pinNone' && <Text style={styles.note}>{t('sparringTrust.create.pinNone')}</Text>}
          {status === 'quota' && <Text style={styles.note}>{t('sparringTrust.create.searchQuota')}</Text>}
          {status === 'network' && <Text style={styles.note}>{t('sparringTrust.create.searchNetwork')}</Text>}
          <FieldError text={error} />
          {link}
          <PlaceSuggestForm onAction={actions.onTrustAction} />
          {/* Child of the open create modal (a sibling modal would not show on iOS). */}
          <LocationPickerModal
            visible={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onConfirm={(lat, lng) => { void handlePin(lat, lng); }}
          />
        </View>
      ) : (
        <View>
          <View style={styles.card}>
            <Ionicons name="location" size={24} color={colors.accentBlueText} />
            <View style={styles.resultText}>
              <Text style={styles.resultName}>{place.name}</Text>
              <Text style={styles.resultAddress}>{place.address}</Text>
            </View>
            <TouchableOpacity onPress={actions.onClearPlace} style={styles.changeBtn} accessibilityRole="button">
              <Text style={styles.changeText}>{t('sparringTrust.create.changePlace')}</Text>
            </TouchableOpacity>
          </View>
          {placeNeedsLabel(place) && (
            <View style={styles.block}>
              <Text style={styles.label}>{t('sparringTrust.create.placeLabel')}</Text>
              <TextInput
                style={styles.field}
                value={placeLabel}
                onChangeText={actions.onLabel}
                placeholder={t('sparringTrust.create.placeLabelPlaceholder')}
                placeholderTextColor={colors.textMuted}
                maxLength={PLACE_LABEL_MAX}
                returnKeyType="done"
                blurOnSubmit
                accessibilityLabel={t('sparringTrust.create.placeLabel')}
              />
              <Text style={styles.note}>{t('sparringTrust.create.placeLabelHint')}</Text>
            </View>
          )}
          <FieldError text={error} />
          {notice}
          {link}
        </View>
      )}

      {gym !== null && !atStudio && (
        noteOpen ? (
          <View style={styles.block}>
            <Text style={styles.label}>{t('sparring.place.gymAccess')}</Text>
            <TextInput
              style={styles.field}
              value={accessNote}
              onChangeText={actions.onAccessNote}
              placeholder={t('sparring.place.accessPlaceholder')}
              placeholderTextColor={colors.textMuted}
              maxLength={GYM_LIMITS.accessNote}
              returnKeyType="done"
              blurOnSubmit
              accessibilityLabel={t('sparring.place.accessA11y')}
            />
            <Text style={styles.note}>{t('sparring.place.accessNote')}</Text>
          </View>
        ) : (
          <TextAction label={t('sparring.place.addAccess')} icon="add" onPress={() => setNoteOpen(true)} />
        )
      )}
    </View>
  );
}

export default React.memo(PlaceSection);

const styles = StyleSheet.create({
  searchRow: {
    flexDirection: 'row',
    gap: 8,
  },
  searchInput: {
    flex: 1,
  },
  searchBtn: {
    width: 56,
    minHeight: 56,
    borderRadius: 16,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  field: {
    minHeight: 56,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    fontSize: 16,
    color: colors.text,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    minHeight: 64,
    marginTop: 8,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  resultPressed: {
    backgroundColor: colors.hairline,
  },
  resultText: {
    flex: 1,
  },
  resultName: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  resultAddress: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 8,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
  },
  changeBtn: {
    minHeight: 40,
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changeText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  linkRow: {
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    paddingHorizontal: 16,
    minHeight: 40,
    borderRadius: 20,
    backgroundColor: colors.card,
  },
  chipText: {
    flexShrink: 1,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  block: {
    marginTop: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
    marginTop: 8,
  },
});
