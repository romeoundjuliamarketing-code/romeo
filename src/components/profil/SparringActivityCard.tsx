import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useSparringReliability } from '../../hooks/useSparringReliability';
import { useUpcomingSparringCount } from '../../hooks/useUpcomingSparringCount';
import { formatReliability } from '../../utils/sparringReliability';

interface Props {
  userId:          string | null;
  isOwn:           boolean;
  refetchTrigger?: number;
}

// Sparring activity of an athlete: planned (future, holds a slot), attended and
// not attended. Attended/committed come ONLY from get_reliability; "nicht
// wahrgenommen" = committed − attended (no-shows and late cancellations).
// Planned sparrings never count against reliability.
export default function SparringActivityCard({ userId, isOwn, refetchTrigger = 0 }: Props): React.ReactElement {
  const { attended, committed } = useSparringReliability(userId, refetchTrigger);
  const upcoming = useUpcomingSparringCount(userId, refetchTrigger);
  const { label, hasHistory } = formatReliability({ attended, committed });
  const missed = Math.max(0, committed - attended);
  const empty = !hasHistory && upcoming === 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Sparring-Aktivität</Text>

      {empty ? (
        <Text style={styles.emptyText}>
          {isOwn
            ? 'Noch keine Sparrings. Sag auf der Karte bei einem Treffen zu – hier siehst du dann deine Termine und Zuverlässigkeit.'
            : 'Noch keine Sparrings über die App.'}
        </Text>
      ) : (
        <>
          <View style={styles.numbers}>
            <Stat value={upcoming} label="Geplant" tone="primary" />
            <View style={styles.statDivider} />
            <Stat value={attended} label="Besucht" tone="ink" />
            <View style={styles.statDivider} />
            <Stat value={missed} label="Nicht wahrgenommen" tone="muted" />
          </View>
          <View style={styles.reliability}>
            <Ionicons
              name="shield-checkmark-outline"
              size={16}
              color={hasHistory ? colors.accentBlue : colors.textMuted}
            />
            <Text style={styles.reliabilityText}>{label}</Text>
          </View>
          {upcoming > 0 && (
            <Text style={styles.hint}>Geplante Treffen zählen erst nach dem Termin zur Zuverlässigkeit.</Text>
          )}
        </>
      )}
    </View>
  );
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'primary' | 'ink' | 'muted' }) {
  return (
    <View style={styles.stat}>
      <Text
        style={[styles.statValue, tone === 'primary' ? styles.valuePrimary : tone === 'muted' ? styles.valueMuted : null]}
      >
        {value}
      </Text>
      <Text style={styles.statLabel} numberOfLines={2}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  title: {
    fontSize:   20,
    fontWeight: '800',
    color:      colors.text,
  },
  emptyText: {
    fontSize:   14,
    lineHeight: 20,
    color:      colors.textMuted,
  },
  numbers: {
    flexDirection:   'row',
    backgroundColor: colors.card,
    borderRadius:    16,
    borderWidth:     1,
    borderColor:     colors.hairline,
  },
  stat: {
    flex:              1,
    minWidth:          0,
    paddingVertical:   16,
    paddingHorizontal: 4,
    alignItems:        'center',
    gap:               4,
  },
  statDivider: {
    width:            1,
    backgroundColor:  colors.hairline,
    marginVertical:   8,
  },
  statValue: {
    fontSize:   24,
    fontWeight: '800',
    color:      colors.text,
  },
  valuePrimary: {
    color: colors.accentBlue,
  },
  valueMuted: {
    color: colors.textMuted,
  },
  statLabel: {
    fontSize:  12,
    color:     colors.textMuted,
    textAlign: 'center',
  },
  reliability: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  reliabilityText: {
    flex:     1,
    fontSize: 14,
    color:    colors.text,
  },
  hint: {
    fontSize: 12,
    color:    colors.textMuted,
  },
});
