import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../i18n/language';
import { disciplineLabel } from '../../utils/disciplineLabel';
import { formatDate } from '../../utils/formatDate';
import { TOP_BAR_CLEARANCE } from './SparringSheetTopBar';

interface Props {
  /** Display title, already localized and never empty (see the sheet). */
  title:         string;
  discipline:    string;
  scheduledAt:   string;
  durationMin:   number;
  isFeatured:    boolean;
  verifiedOnly:  boolean;
  isCreator:     boolean;
  /** Organizer changed the sparring after publishing it */
  edited:        boolean;
  /** Personal opening ("<Name> lädt ein"), rendered above the title. */
  hostLine:      React.ReactNode;
  /** Place lines, rendered directly below the date band. */
  children:      React.ReactNode;
}

// Band edges are tilted by this much; the text itself stays horizontal.
const BAND_TILT = '-1.5deg';

// Orientation head of the sparring sheet, composed like a small invitation:
// who invites, what (title + discipline), when (the blue date band, the one
// strong accent) and where (children, directly below the band). Dates in
// device-local time like everywhere else.
export default function SparringDetailHeader({
  title, discipline, scheduledAt, durationMin, isFeatured, verifiedOnly, isCreator, edited, hostLine, children,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const weekday = formatDate(scheduledAt, 'weekday', language);
  const day     = formatDate(scheduledAt, 'dayMonth', language);
  const time    = formatDate(scheduledAt, 'time', language);
  // Discipline ("Sonstiges" says nothing, so it is left out) and the few tags
  // that change who may join or whose sparring it is.
  const meta = [
    discipline === 'Sonstiges' ? null : disciplineLabel(discipline, language),
    isCreator ? t('sparring.detailHeader.yours') : null,
    verifiedOnly ? t('sparring.detailHeader.verifiedOnly') : null,
    isFeatured ? 'Sparr Pick' : null,
  ].filter((v): v is string => v !== null);

  return (
    <View>
      <View style={styles.texts}>
        {/* Right padding keeps the host line clear of share / close. */}
        <View style={styles.hostSlot}>{hostLine}</View>
        <Text style={styles.title} numberOfLines={4} accessibilityRole="header">
          {title}
        </Text>
        {meta.length > 0 && <Text style={styles.meta}>{meta.join('  ·  ')}</Text>}
      </View>

      <View
        style={styles.band}
        accessible
        accessibilityLabel={`${formatDate(scheduledAt, 'weekdayLong', language)}, ${t('sparring.invite.time', { time })}, ${t('sparring.detailHeader.minutes', { count: durationMin })}`}
      >
        {/* Tilted surfaces behind horizontal text: darker edge, then the band. */}
        <View style={[styles.bandShape, styles.bandEdge]} />
        <View style={[styles.bandShape, styles.bandFace]} />
        <View style={styles.bandPart}>
          <Text style={styles.bandSmall}>{weekday}</Text>
          <Text style={styles.bandBig}>{day}</Text>
        </View>
        <View style={styles.bandPart}>
          <Text style={styles.bandSmall}>
            {t('sparring.detailHeader.minutes', { count: durationMin })}
            {edited && ` · ${t('sparring.invite.edited')}`}
          </Text>
          <Text style={styles.bandBig}>{t('sparring.invite.time', { time })}</Text>
        </View>
      </View>

      <View style={styles.place}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  texts: {
    paddingHorizontal: 24,
    paddingTop:        8,
    paddingBottom:     24,
    gap:               8,
  },
  hostSlot: {
    paddingRight: TOP_BAR_CLEARANCE,
  },
  title: {
    fontSize:   30,
    lineHeight: 34,
    fontWeight: '800',
    color:      colors.text,
  },
  meta: {
    fontSize:   13,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
  band: {
    flexDirection:     'row',
    flexWrap:          'wrap',
    alignItems:        'flex-end',
    rowGap:            8,
    columnGap:         32,
    paddingHorizontal: 24,
    paddingTop:        16,
    paddingBottom:     16,
    marginBottom:      8,
  },
  bandShape: {
    position:  'absolute',
    left:      -16,
    right:     -16,
    top:       4,
    bottom:    4,
    transform: [{ rotate: BAND_TILT }],
  },
  bandEdge: {
    top:             8,
    bottom:          0,
    backgroundColor: colors.accentBlueEdge,
  },
  bandFace: {
    // Darker than accentBlue so the small white text keeps >= 4.5:1.
    backgroundColor: colors.dateBand,
  },
  bandPart: {
    flexShrink: 1,
  },
  bandBig: {
    fontSize:   24,
    lineHeight: 28,
    fontWeight: '800',
    color:      colors.card,
  },
  bandSmall: {
    fontSize:   14,
    lineHeight: 18,
    fontWeight: '600',
    color:      colors.card,
  },
  place: {
    paddingHorizontal: 24,
    paddingTop:        16,
    gap:               8,
  },
});
