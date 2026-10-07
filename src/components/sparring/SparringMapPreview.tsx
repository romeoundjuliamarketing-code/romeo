import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { compactDateLabel, sparringLocationLines, initialsOf, firstName } from '../../utils/sparringDetail';
import { formatDistanceKm } from '../../utils/sparringSearch';
import type { NearbySparring } from '../../hooks/useNearbySparrings';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/language';
import { disciplineLabel } from '../../utils/disciplineLabel';
import { sparringDisplayTitle } from '../../utils/sparringDisplayTitle';

interface Props {
  sparring:      NearbySparring;
  /** Small label above the card content, e.g. "Am nächsten" for the automatic pick. */
  caption:       string | null;
  onOpenDetails: () => void;
  onClose:       () => void;
}

const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };

// Sparring card above the map's bottom controls: the nearest hit by default,
// the tapped marker otherwise. Shows only fields the nearby search already
// delivers (same wording as the detail window); "Ansehen" opens the existing
// SparringDetailSheet.
export default function SparringMapPreview({
  sparring, caption, onOpenDetails, onClose,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const location = sparringLocationLines({
    studioId:   sparring.studio_id,
    studioName: sparring.studio_name,
    studioCity: sparring.studio_city,
    address:    sparring.address,
  });
  const slotsLeft  = sparring.max_slots - sparring.signup_count;
  const slotsLabel = sparring.is_signed_up
    ? t('sparring.commitment.youAreIn')
    : slotsLeft <= 0 ? t('sparring.detailHeader.soldOut') : t('sparring.detailHeader.slotsFree', { count: slotsLeft });
  const hasHost    = sparring.host_name !== null && sparring.host_name.trim().length > 0;
  const hasAvatar  = sparring.host_avatar_url !== null && sparring.host_avatar_url.length > 0;

  return (
    <View style={styles.card}>
      <View style={styles.clip}>
        <View style={styles.accent} />
        <View style={styles.body}>
          <View style={styles.topRow}>
            <Text style={styles.date} numberOfLines={1}>
              {compactDateLabel(sparring.scheduled_at)}
            </Text>
            {caption !== null && <Text style={styles.caption}>{caption}</Text>}
            <TouchableOpacity
              onPress={onClose}
              hitSlop={HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={t('map.preview.close')}
            >
              <Ionicons name="close" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.title} numberOfLines={1}>{sparringDisplayTitle(sparring.title, language)}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            {disciplineLabel(sparring.discipline, language)} · {location.primary} · {formatDistanceKm(sparring.distance_km)}
          </Text>

          <View style={styles.footer}>
            <View style={styles.avatar}>
              {hasAvatar
                ? <Image source={{ uri: sparring.host_avatar_url as string }} style={styles.avatarImage} />
                : <Text style={styles.avatarInitials}>{initialsOf(sparring.host_name)}</Text>}
            </View>
            <View style={styles.people}>
              {hasHost && (
                <Text style={styles.host} numberOfLines={1}>{t('map.preview.with', { name: firstName(sparring.host_name) })}</Text>
              )}
              <Text style={[styles.slots, sparring.is_signed_up && styles.slotsAccent]} numberOfLines={1}>
                {slotsLabel}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.cta}
              onPress={onOpenDetails}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel={t('map.preview.viewA11y', { title: sparringDisplayTitle(sparring.title, language) })}
            >
              <Text style={styles.ctaText}>{t('map.preview.view')}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.card} />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

interface EmptyProps {
  text:     string;
  /** Null when the largest radius is already active. */
  onWiden:  (() => void) | null;
  onClose:  () => void;
  /** Optional primary action instead of "Umkreis erweitern" (e.g. offer a watch party). */
  action?:  { label: string; onPress: () => void };
}

// Short notice in the preview's place when the search has no hits.
export function SparringMapEmptyCard({ text, onWiden, onClose, action }: EmptyProps): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.card}>
      <View style={styles.clip}>
        <View style={styles.accent} />
        <View style={[styles.body, styles.emptyBody]}>
          <Text style={styles.emptyText} numberOfLines={2}>{text}</Text>
          {action !== undefined && (
            <TouchableOpacity
              style={styles.widenBtn}
              onPress={action.onPress}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.widenText}>{action.label}</Text>
            </TouchableOpacity>
          )}
          {action === undefined && onWiden !== null && (
            <TouchableOpacity
              style={styles.widenBtn}
              onPress={onWiden}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Text style={styles.widenText}>{t('map.preview.widen')}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            onPress={onClose}
            hitSlop={HIT_SLOP}
            accessibilityRole="button"
            accessibilityLabel={t('map.preview.closeNotice')}
          >
            <Ionicons name="close" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const AVATAR = 32;

const styles = StyleSheet.create({
  // Warm card with a blue edge. The shadow sits on the outer view; the inner
  // one clips the edge to the rounded corners (iOS drops shadows on clipped views).
  card: {
    backgroundColor: colors.background,
    borderRadius:    20,
    shadowColor:     colors.dark,
    shadowOffset:    { width: 0, height: 2 },
    shadowOpacity:   0.15,
    shadowRadius:    8,
    elevation:       6,
  },
  clip: {
    flexDirection:   'row',
    borderRadius:    20,
    overflow:        'hidden',
    backgroundColor: colors.background,
  },
  accent: {
    width:           4,
    backgroundColor: colors.accentBlue,
  },
  body: {
    flex:    1,
    padding: 16,
    gap:     4,
  },
  topRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  date: {
    flex:          1,
    fontSize:      12,
    fontWeight:    '700',
    letterSpacing: 0.4,
    color:         colors.accentBlue,
  },
  caption: {
    fontSize:   12,
    fontWeight: '600',
    color:      colors.textMuted,
  },
  title: {
    fontSize:      18,
    fontWeight:    '800',
    letterSpacing: -0.2,
    color:         colors.text,
  },
  meta: {
    fontSize: 14,
    color:    colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    marginTop:     8,
  },
  avatar: {
    width:           AVATAR,
    height:          AVATAR,
    borderRadius:    AVATAR / 2,
    overflow:        'hidden',
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  avatarImage: {
    width:  AVATAR,
    height: AVATAR,
  },
  avatarInitials: {
    fontSize:   12,
    fontWeight: '700',
    color:      colors.card,
  },
  people: {
    flex: 1,
  },
  host: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  slots: {
    fontSize: 13,
    color:    colors.textMuted,
  },
  slotsAccent: {
    color:      colors.accentBlue,
    fontWeight: '600',
  },
  cta: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    height:            40,
    paddingHorizontal: 16,
    borderRadius:      12,
    backgroundColor:   colors.dark,
  },
  ctaText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.card,
  },
  emptyBody: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
    paddingVertical: 8,
  },
  emptyText: {
    flex:       1,
    fontSize:   14,
    fontWeight: '600',
    color:      colors.text,
  },
  widenBtn: {
    height:            32,
    paddingHorizontal: 16,
    borderRadius:      16,
    justifyContent:    'center',
    backgroundColor:   colors.accentBlue,
  },
  widenText: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.card,
  },
});
