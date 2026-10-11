import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import SparringDetailHeader from '../sparring/SparringDetailHeader';
import SparringLocationRow from '../sparring/SparringLocationRow';
import { useTourTarget } from '../../context/TourContext';

const DEMO_DURATION_MIN = 90;
// Height of the tour's progress row below the top safe area.
const TOUR_ROW = 56;

// Next Saturday, 18:00 local time: a plausible date that is never "today".
function demoDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + (((6 - d.getDay()) + 7) % 7 || 7));
  d.setHours(18, 0, 0, 0);
  return d.toISOString();
}

// Example sparring for the tour when no real one fits. Built only from the
// presentational parts of the detail sheet: no data hooks, no ids, no
// participants and no action handlers at all, so nothing can be joined,
// created, messaged or checked in. The label stays visible the whole time.
export default function TourDemoSparring(): React.ReactElement {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const [scheduledAt] = useState(demoDate);
  const header = useTourTarget('detailHeader');

  return (
    <View style={styles.root} accessibilityLabel={t('onboarding.tour.detail.demoBadge')}>
      {/* Room for the tour's progress row; the label stays part of the page. */}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { paddingTop: insets.top + TOUR_ROW }]} scrollEnabled={false}>
        <View ref={header.ref} onLayout={header.onLayout} collapsable={false}>
          <View style={styles.badgeRow}>
            <View style={styles.badge}>
              <Ionicons name="eye-outline" size={16} color={colors.text} />
              <Text style={styles.badgeText}>{t('onboarding.tour.detail.demoBadge')}</Text>
            </View>
          </View>
          <SparringDetailHeader
            title={t('onboarding.tour.detail.demoTitle')}
            discipline="Kickboxen"
            scheduledAt={scheduledAt}
            durationMin={DEMO_DURATION_MIN}
            isFeatured={false}
            verifiedOnly={false}
            isCreator={false}
            edited={false}
            hostLine={<Text style={styles.host}>{t('onboarding.tour.detail.demoHost')}</Text>}
          >
            <SparringLocationRow
              primary={t('onboarding.tour.detail.demoPlace')}
              secondary={t('onboarding.tour.detail.demoArea')}
            />
          </SparringDetailHeader>
        </View>
        <Text style={styles.note}>{t('onboarding.tour.detail.demoNote')}</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.background,
  },
  badgeRow: {
    alignItems:      'center',
    paddingBottom:   8,
    backgroundColor: colors.background,
  },
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               8,
    paddingHorizontal: 16,
    paddingVertical:   8,
    borderRadius:      16,
    borderWidth:       1.5,
    borderColor:       colors.dark,
    backgroundColor:   colors.coachBubble,
  },
  badgeText: {
    fontSize:   14,
    fontWeight: '700',
    color:      colors.text,
  },
  scroll: { flex: 1 },
  content: { paddingBottom: 24 },
  host: {
    fontSize:   14,
    fontWeight: '600',
    color:      colors.headerTextSecondary,
  },
  note: {
    marginTop:         16,
    paddingHorizontal: 16,
    fontSize:          15,
    lineHeight:        22,
    color:             colors.textMuted,
  },
});
