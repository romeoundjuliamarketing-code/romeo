import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { disciplineIcon } from '../../data/disciplineBadges';

// Discipline badges shared by the profile header and the fighter card, so both
// look identical. `onDark` inverts the badge for dark card frames.
export default function DisciplineBadges({ disciplines, onDark = false }: {
  disciplines: string[];
  onDark?: boolean;
}): React.ReactElement | null {
  if (disciplines.length === 0) return null;
  return (
    <View style={styles.badges}>
      {disciplines.map((d) => (
        <View key={d} style={[styles.badge, onDark && styles.badgeOnDark]}>
          <MaterialCommunityIcons name={disciplineIcon(d)} size={14} color={colors.accentBlue} />
          <Text style={[styles.badgeText, onDark && styles.badgeTextOnDark]}>{d}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  badges: {
    flexDirection: 'row',
    flexWrap:      'wrap',
    gap:           8,
  },
  badge: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               4,
    paddingHorizontal: 8,
    minHeight:         32,
    borderRadius:      8,
    backgroundColor:   colors.dark,
  },
  badgeOnDark: {
    backgroundColor: colors.card,
  },
  badgeText: {
    fontSize:      12,
    fontWeight:    '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color:         colors.card,
  },
  badgeTextOnDark: {
    color: colors.dark,
  },
});
