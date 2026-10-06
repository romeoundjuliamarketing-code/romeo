import React from 'react';
import { View, Text, Image, TouchableOpacity, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { fonts } from '../../theme/typography';
import type { NearbySparring, NearbyStatus } from '../../hooks/useNearbySparrings';
import type { SearchLocationStatus } from '../../hooks/useSearchLocation';
import { appointmentDayLabel, timeLabel, homeSparringTitle, shortAddress } from '../../utils/homeAgenda';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useLanguage } from '../../i18n/language';
import type { AppLanguage } from '../../utils/language';

interface Props {
  radiusKm:       number;
  /** Label of the search location ("Dein Standort" or a picked place). */
  locationLabel:  string | null;
  locationStatus: SearchLocationStatus;
  status:         NearbyStatus;
  /** The search result (nearest first) — the same list the map shows. */
  sparrings:      NearbySparring[];
  now:            Date;
  onOpen:         () => void;
  onOpenSparring: (id: string) => void;
  onPickLocation: () => void;
  onRetry:        () => void;
  onWiden:        () => void;
  /** Opens the existing create flow (sparring map, verification applies there). */
  onCreate:       () => void;
  /** The user has an upcoming commitment (shown above): the empty state then
   *  never says the user's own round is missing. */
  hasCommitment:  boolean;
}

const MAX_ROWS = 3;

function eyebrowLabel(radiusKm: number, locationLabel: string | null): string {
  const base = i18n.t('home.nearby.eyebrow', { radius: radiusKm });
  if (locationLabel === null || locationLabel === i18n.t('sparring.searchLocation.device')) return base;
  return `${base} · ${locationLabel.toUpperCase()}`;
}

function distanceLabel(km: number, language: AppLanguage): string {
  if (km < 1) return i18n.t('home.nearby.underOneKm');
  const value = km.toFixed(km < 10 ? 1 : 0);
  return `${language === 'en' ? value : value.replace('.', ',')} km`;
}

// Sparrings nearby on Home as one dark "ring corner": a wide #0A0A0A panel with
// the ring illustration cut into its bottom-right edge as background. Same
// search as map/list. Loading, missing location and errors are their own
// states; the empty invitation only shows for a loaded, empty result. The
// illustration is decorative, dimmed and never takes touches. With results it
// shrinks back so the appointment rows stay readable.
export default function NearbySparringsCard({
  radiusKm, locationLabel, locationStatus, status, sparrings, now,
  onOpen, onOpenSparring, onPickLocation, onRetry, onWiden, onCreate, hasCommitment,
}: Props) {
  const { t } = useTranslation();
  const { width, fontScale } = useWindowDimensions();
  const loading = locationStatus === 'loading' || status === 'loading' || status === 'idle';
  const empty   = locationStatus !== 'none' && status !== 'error' && !loading && sparrings.length === 0;
  // Narrow screens or large text: the copy takes the full width and the ring
  // moves further out, so text never sits on the detailed part of the art.
  const tight   = width < 360 || fontScale > 1.3;

  let body: React.ReactNode;
  if (locationStatus === 'none') {
    body = (
      <>
        <Text style={styles.body}>{t('home.nearby.pickPrompt', { radius: radiusKm })}</Text>
        <TextLink label={t('home.nearby.pickLocation')} onPress={onPickLocation} />
      </>
    );
  } else if (status === 'error') {
    body = (
      <>
        <Text style={styles.body}>{t('home.nearby.loadError')}</Text>
        <TextLink label={t('common.retry')} onPress={onRetry} />
      </>
    );
  } else if (loading) {
    body = (
      <Text style={styles.body} accessibilityLiveRegion="polite">
        {t('home.nearby.searching', { radius: radiusKm })}
      </Text>
    );
  } else if (empty) {
    body = (
      <>
        <Text style={styles.headline} accessibilityRole="header">
          {hasCommitment ? t('home.nearby.emptyHeadlineCommitted') : t('home.nearby.emptyHeadline')}
        </Text>
        <Text style={styles.body}>
          {hasCommitment
            ? t('home.nearby.emptyBodyCommitted')
            : t('home.nearby.emptyBody')}
        </Text>
        <Pressable
          style={({ pressed }) => [styles.primary, pressed && styles.primaryPressed]}
          onPress={onCreate}
          accessibilityRole="button"
        >
          <Ionicons name="add" size={18} color={colors.dark} />
          <Text style={styles.primaryText}>{t('home.nearby.offer')}</Text>
        </Pressable>
        <TextLink label={t('home.nearby.widen')} onPress={onWiden} />
      </>
    );
  } else {
    body = (
      <>
        <View style={styles.list}>
          {sparrings.slice(0, MAX_ROWS).map((s, i) => (
            <NearbyRow key={s.id} sparring={s} now={now} first={i === 0} onPress={() => onOpenSparring(s.id)} />
          ))}
        </View>
        <TextLink
          label={sparrings.length > MAX_ROWS ? t('home.nearby.showAll', { count: sparrings.length }) : t('home.nearby.viewOnMap')}
          onPress={onOpen}
        />
      </>
    );
  }

  return (
    <View style={[styles.panel, empty && styles.panelEmpty]}>
      <View
        style={[styles.ring, empty ? styles.ringEmpty : styles.ringQuiet, empty && tight && styles.ringTight]}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Image
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          source={require('../../../assets/images/sparr-ringecke-mobile.png')}
          style={styles.ringImage}
          resizeMode="contain"
        />
        {/* Dims the art on the dark panel so copy and actions stay in front. */}
        <View style={[styles.ringShade, !empty && styles.ringShadeStrong]} />
      </View>

      <View style={[styles.content, empty && (tight ? styles.contentTight : styles.contentEmpty)]}>
        <Text style={styles.eyebrow} accessibilityRole={empty ? undefined : 'header'}>
          {eyebrowLabel(radiusKm, locationLabel)}
        </Text>
        {body}
      </View>
    </View>
  );
}

function NearbyRow({ sparring, now, first, onPress }: { sparring: NearbySparring; now: Date; first: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const startsAt = new Date(sparring.scheduled_at);
  const place    = sparring.studio_city.trim().length > 0 ? sparring.studio_city : shortAddress(sparring.address);
  const title    = homeSparringTitle(sparring.title, place);
  const when     = `${appointmentDayLabel(startsAt, now)} · ${t('home.next.clock', { time: timeLabel(startsAt) })}`;
  const where    = [sparring.studio_name.trim().length > 0 ? sparring.studio_name : null, title.isPlace ? null : place, distanceLabel(sparring.distance_km, language)]
    .filter((part): part is string => part !== null && part.length > 0)
    .join(' · ');
  const slots    = sparring.max_slots > 0 ? t('home.nearby.attending', { count: sparring.signup_count, max: sparring.max_slots }) : null;

  return (
    <TouchableOpacity
      style={[styles.row, first && styles.rowFirst]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={[title.text, when, where, slots].filter((p) => p !== null).join(', ')}
    >
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{title.text}</Text>
        <Text style={styles.rowMeta}>{when}</Text>
        <Text style={styles.rowMeta} numberOfLines={2}>
          {where}{slots !== null ? ` · ${slots}` : ''}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={colors.headerTextSecondary} />
    </TouchableOpacity>
  );
}

function TextLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.inlineLink} onPress={onPress} activeOpacity={0.7} accessibilityRole="button">
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="arrow-forward" size={16} color={colors.accentBlue} />
    </TouchableOpacity>
  );
}

// Source art is 2:3 (480 x 720, transparent): ring post on the right, ropes
// running out to the left.
const RING_ASPECT = 2 / 3;

const styles = StyleSheet.create({
  // Wide dark ring corner; overflow hidden cuts the art at the rounded edge.
  panel: {
    borderRadius: 16,
    backgroundColor: colors.dark,
    overflow: 'hidden',
  },
  panelEmpty: {
    minHeight: 288,
  },
  content: {
    padding: 24,
  },
  // Copy column clear of the post and gloves on the right.
  contentEmpty: {
    paddingRight: 120,
  },
  contentTight: {
    paddingBottom: 112,
  },
  ring: {
    position: 'absolute',
    aspectRatio: RING_ASPECT,
  },
  // Large, cut by the right and bottom edge of the panel.
  ringEmpty: {
    width: 232,
    right: -40,
    bottom: -64,
  },
  // Narrow / large text: smaller, in its own strip below the actions.
  ringTight: {
    width: 144,
    right: -24,
    bottom: -96,
  },
  // With results: smaller and further out, only a hint behind the rows.
  ringQuiet: {
    width: 160,
    right: -72,
    bottom: -96,
  },
  ringImage: {
    width: '100%',
    height: '100%',
  },
  ringShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.dark,
    opacity: 0.35,
  },
  ringShadeStrong: {
    opacity: 0.6,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1.2,
    color: colors.accentBlue,
  },
  headline: {
    marginTop: 16,
    fontFamily: fonts.display,
    fontSize: 34,
    lineHeight: 36,
    color: colors.headerTextPrimary,
  },
  body: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    color: colors.headerTextSecondary,
  },
  // Blue main action with dark label (about 6:1; white on this blue is only 3.3:1).
  primary: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 48,
    marginTop: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
  },
  primaryPressed: {
    backgroundColor: colors.accentBluePressed,
    transform: [{ scale: 0.98 }],
  },
  primaryText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.dark,
  },
  inlineLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    minHeight: 44,
    marginTop: 8,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentBlue,
  },
  list: {
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.headerBorder,
  },
  rowFirst: {
    borderTopWidth: 0,
  },
  rowText: {
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    textTransform: 'uppercase',
    color: colors.headerTextPrimary,
  },
  rowMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.headerTextSecondary,
  },
});
