import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { availablePromotions, fightEventWhen, pickNextFightEvent } from '../../utils/fightEvents';
import type { FightEvent, FightPromotion } from '../../utils/fightEvents';
import type { FightEventsStatus } from '../../hooks/useFightEvents';
import { useTranslation } from 'react-i18next';

interface Props {
  events: FightEvent[];
  status: FightEventsStatus;
  now:    Date;
  /** Opens the event map (watch parties); `event` is null when no date is known. */
  onWatch: (promotion: FightPromotion, event: FightEvent | null) => void;
}

// "Gemeinsam Kämpfe schauen": the next official fight night (curated
// fight_events data) and the entry to the event map with local watch parties.
// Always shown; without reliable data it says so instead of guessing a date.
export default function HomeFightNight({ events, status, now, onWatch }: Props) {
  const { t } = useTranslation();
  const [promotion, setPromotion] = useState<FightPromotion>('UFC');
  const available = status === 'ready' ? availablePromotions(events, now) : [];
  // The toggle only offers promotions that actually have a next event; UFC is the default.
  const showToggle = available.length > 1;
  const active: FightPromotion = available.includes(promotion) ? promotion : 'UFC';
  const next = status === 'ready' ? pickNextFightEvent(events, active, now) : null;
  const when = next !== null ? fightEventWhen(next, now) : null;

  return (
    <View style={styles.block}>
      <View style={styles.headRow}>
        <View style={styles.eyebrowRow}>
          <Ionicons name="tv-outline" size={16} color={colors.accentBlue} />
          <Text style={styles.eyebrow}>{t('home.fight.eyebrow')}</Text>
        </View>
        {showToggle && (
          <View style={styles.toggle} accessibilityRole="tablist">
            {available.map((p) => (
              <TouchableOpacity
                key={p}
                style={[styles.toggleItem, p === active && styles.toggleItemActive]}
                onPress={() => setPromotion(p)}
                accessibilityRole="tab"
                accessibilityState={{ selected: p === active }}
              >
                <Text style={[styles.toggleText, p === active && styles.toggleTextActive]}>{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {status === 'loading' ? (
        <Text style={styles.muted}>{t('home.fight.loading', { promotion: active })}</Text>
      ) : next === null || when === null ? (
        <Text style={styles.unavailable}>{t('home.fight.unavailable', { promotion: active })}</Text>
      ) : (
        <>
          <Text style={styles.name} numberOfLines={2}>{next.name}</Text>
          <Text style={styles.when}>
            {when.running
              ? t('home.fight.running')
              : [when.segment, when.day, when.time ?? t('home.fight.timeTbd')].filter((p) => p !== null).join(' · ')}
          </Text>
        </>
      )}

      <Text style={styles.body}>{t('home.fight.body')}</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => onWatch(active, next)}
        activeOpacity={0.85}
        accessibilityRole="button"
        accessibilityLabel={t('home.fight.watchLabel', { promotion: active })}
      >
        <Text style={styles.buttonText}>{t('home.fight.watch', { promotion: active })}</Text>
        <Ionicons name="arrow-forward" size={18} color={colors.card} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
  },
  headRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  eyebrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: colors.textMuted,
  },
  toggle: {
    flexDirection: 'row',
    borderRadius: 12,
    backgroundColor: colors.background,
    padding: 2,
  },
  toggleItem: {
    minHeight: 32,
    minWidth: 56,
    paddingHorizontal: 8,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleItemActive: {
    backgroundColor: colors.dark,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textMuted,
  },
  toggleTextActive: {
    color: colors.card,
  },
  name: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: colors.text,
  },
  when: {
    marginTop: 2,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  muted: {
    marginTop: 8,
    fontSize: 15,
    color: colors.textMuted,
  },
  unavailable: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  body: {
    marginTop: 8,
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
  button: {
    marginTop: 16,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: colors.dark,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
});
