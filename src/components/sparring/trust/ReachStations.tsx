import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../../theme/colors';
import { fonts } from '../../../theme/typography';

// Status display of the reach (not a filter): the current distance limit and
// the next one, as two connected stations. The current one is strong blue, the
// later one quieter with a lock — both stay readable, state is never color alone.
export default function ReachStations({ baseKm, unlockedKm, laterLabel }: {
  baseKm: number;
  unlockedKm: number;
  laterLabel: string;
}): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.wrap}>
      <Text style={styles.caption}>{t('sparringTrust.status.distanceCaption')}</Text>
      <View style={styles.station} accessible accessibilityLabel={`${t('sparringTrust.status.nowLabel')}: ${t('sparringTrust.status.upToKm', { km: baseKm })}`}>
        <View style={styles.track}>
          <View style={styles.dotNow} />
          <View style={styles.connector} />
        </View>
        <View style={styles.texts}>
          <Text style={styles.labelNow}>{t('sparringTrust.status.nowLabel')}</Text>
          <Text style={styles.valueNow}>{t('sparringTrust.status.upToKm', { km: baseKm })}</Text>
        </View>
      </View>
      <View
        style={styles.station}
        accessible
        accessibilityLabel={`${laterLabel}: ${t('sparringTrust.status.upToKm', { km: unlockedKm })}, ${t('sparringTrust.status.lockedA11y')}`}
      >
        <View style={styles.track}>
          <View style={styles.dotLater}>
            <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
          </View>
        </View>
        <View style={styles.texts}>
          <Text style={styles.labelLater}>{laterLabel}</Text>
          <Text style={styles.valueLater}>{t('sparringTrust.status.upToKm', { km: unlockedKm })}</Text>
        </View>
      </View>
    </View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  caption: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: colors.accentBlueText,
  },
  station: {
    flexDirection: 'row',
    gap: 16,
  },
  // Left column: dot plus the line down to the next station.
  track: {
    width: DOT,
    alignItems: 'center',
  },
  dotNow: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.accentBlue,
    borderWidth: 4,
    borderColor: colors.card,
  },
  connector: {
    flex: 1,
    width: 2,
    minHeight: 8,
    marginVertical: 2,
    backgroundColor: colors.accentBlue,
  },
  dotLater: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: colors.accentBlueMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: {
    flex: 1,
    minWidth: 0,
    paddingBottom: 8,
  },
  labelNow: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accentBlueText,
  },
  valueNow: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
    color: colors.accentBlueText,
  },
  labelLater: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
  },
  valueLater: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    textTransform: 'uppercase',
    color: colors.textMuted,
  },
});
