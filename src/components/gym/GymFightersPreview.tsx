import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, ScrollView, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { getInitials } from '../../utils/initials';
import type { GymFighter, LoadStatus } from '../../hooks/useGyms';
import { GYM_PAGE_GUTTER } from './GymHero';

const AVATAR = 56;

// Plain round face for the preview: no frame; without a photo calm initials
// on the light brand tint.
function Face({ uri, name }: { uri: string | null; name: string | null }): React.ReactElement {
  const [failed, setFailed] = useState(false);
  if (uri !== null && uri.length > 0 && !failed) {
    return <Image source={{ uri }} style={styles.avatar} onError={() => setFailed(true)} accessibilityIgnoresInvertColors />;
  }
  return (
    <View style={[styles.avatar, styles.placeholder]}>
      <Text style={styles.initials} maxFontSizeMultiplier={1}>{getInitials(name)}</Text>
    </View>
  );
}

// A few fighters who name this gym as their main gym — faces and first names
// in one horizontal row (disciplines stay in the full list).
export default function GymFightersPreview({ fighters, status, retry, onOpen }: {
  fighters: GymFighter[];
  status:   LoadStatus;
  retry:    () => void;
  onOpen:   (userId: string) => void;
}): React.ReactElement {
  const { t } = useTranslation();
  if (status === 'loading' && fighters.length === 0) return <ActivityIndicator color={colors.accentBlue} />;
  if (status === 'error' && fighters.length === 0) {
    return (
      <View style={styles.stateRow}>
        <Text style={[styles.muted, styles.flex]}>{t('gym.fightersPreview.loadError')}</Text>
        <TouchableOpacity style={styles.retry} onPress={retry} accessibilityRole="button">
          <Text style={styles.retryText}>{t('common.retry')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  if (fighters.length === 0) {
    return <Text style={styles.muted}>{t('gym.fightersPreview.empty')}</Text>;
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.bleed}
    >
      {fighters.map((f) => (
        <TouchableOpacity
          key={f.id}
          style={styles.person}
          onPress={() => onOpen(f.id)}
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel={t('gym.fightersPreview.profileOf', { name: f.name ?? t('gym.fightersPreview.fighterFallback') })}
        >
          <Face uri={f.avatar_url} name={f.name} />
          <Text style={styles.name} numberOfLines={2} maxFontSizeMultiplier={1.3}>{firstName(f.name)}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// First name only, so it fits under the face without being cut.
function firstName(name: string | null): string {
  return name?.trim().split(' ')[0] ?? '';
}

const styles = StyleSheet.create({
  stateRow: {
    flexDirection: 'row',
    alignItems:    'center',
    flexWrap:      'wrap',
    columnGap:     16,
  },
  flex: {
    flex: 1,
  },
  retry: {
    minHeight:      44,
    justifyContent: 'center',
  },
  retryText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  muted: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  // The row runs to the screen edges; the page padding moves into the content.
  bleed: {
    marginHorizontal: -GYM_PAGE_GUTTER,
  },
  row: {
    paddingHorizontal: GYM_PAGE_GUTTER,
    gap:               12,
  },
  person: {
    width:      72,
    alignItems: 'center',
    gap:        8,
  },
  avatar: {
    width:        AVATAR,
    height:       AVATAR,
    borderRadius: AVATAR / 2,
  },
  placeholder: {
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.accentBlueTint,
  },
  initials: {
    fontSize:   18,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  name: {
    fontSize:   13,
    lineHeight: 16,
    fontWeight: '600',
    color:      colors.text,
    textAlign:  'center',
  },
});
