import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import AuthTextField from '../auth/AuthTextField';
import { CoachPrimaryButton } from '../coach/CoachAnswerButtons';
import { TextAction } from '../common/TextAction';
import { geocodeAddress } from '../../utils/geocoding';

// Manual place search inside onboarding step 2: the same text search as on the
// map (geocodeAddress), or the existing map picker as an alternative.
export default function PlaceSearchPanel({ busy, error, onFound, onPickOnMap }: {
  /** The step is saving: no second search. */
  busy:        boolean;
  /** Error from saving the step (shown below the field). */
  error:       string | null;
  onFound:     (lat: number, lng: number, label: string) => void;
  onPickOnMap: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const searchingRef = useRef(false);

  async function search(): Promise<void> {
    const q = query.trim();
    if (q.length === 0 || searchingRef.current || busy) return;
    searchingRef.current = true;
    setSearching(true);
    setNotFound(false);
    const result = await geocodeAddress(q);
    searchingRef.current = false;
    setSearching(false);
    if (result === null) {
      setNotFound(true);
      return;
    }
    onFound(result.lat, result.lng, q);
  }

  const fieldError = notFound ? t('map.search.placeNotFound') : error;

  return (
    <View style={styles.root}>
      <Text style={styles.title} accessibilityRole="header">{t('onboarding.location.placeTitle')}</Text>
      <AuthTextField
        variant="warm"
        icon="search"
        label={t('onboarding.location.placeLabel')}
        placeholder={t('map.search.placePlaceholder')}
        value={query}
        onChangeText={(v) => { setQuery(v); setNotFound(false); }}
        onSubmitEditing={() => { void search(); }}
        error={fieldError}
        returnKeyType="search"
        autoCorrect={false}
      />
      <CoachPrimaryButton
        label={searching ? t('onboarding.location.searching') : busy ? t('onboarding.profile.saving') : t('onboarding.location.search')}
        onPress={() => { void search(); }}
      />
      <View style={styles.mapRow}>
        <TextAction label={t('onboarding.location.pickOnMap')} icon="map-outline" onPress={onPickOnMap} disabled={busy} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 24 },
  title: {
    fontSize:   22,
    lineHeight: 28,
    fontWeight: '800',
    color:      colors.text,
  },
  mapRow: { alignItems: 'center' },
});
