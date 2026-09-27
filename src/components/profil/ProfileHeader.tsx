import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { stanceLabel } from '../../utils/stance';
import type { FactRow } from '../../utils/athleteProfile';
import type { FighterCardData } from './FighterCard';
import DisciplineBadges from './DisciplineBadges';
import ProfilePhoto from './ProfilePhoto';

const PHOTO = 96;

// Profile page header — a compact, standalone rendering of the same profile
// data the shareable fighter card uses: photo left, name/fighter name/badge
// right, gym + place, discipline badges and one line of body numbers.
// `actions` renders below (own: edit + share; foreign: existing actions).
export default function ProfileHeader({ data, actions }: {
  data:    FighterCardData;
  actions: React.ReactNode;
}): React.ReactElement {
  const displayName = data.name !== null && data.name.trim().length > 0 ? data.name.trim() : 'Kämpfer';
  const place = [data.gymName, data.location].filter((v): v is string => v !== null && v.trim().length > 0);
  const stanceText = stanceLabel(data.stance);
  const numbers: FactRow[] = [];
  if (data.weightKg !== null) numbers.push({ label: 'Gewicht', value: `${data.weightKg} kg` });
  if (data.heightCm !== null) numbers.push({ label: 'Größe', value: `${data.heightCm} cm` });
  if (stanceText !== null) numbers.push({ label: 'Auslage', value: stanceText });

  return (
    <View style={styles.header}>
      <View style={styles.identity}>
        <ProfilePhoto uri={data.avatarUrl} name={data.name} size={PHOTO} />

        <View style={styles.names}>
          <View style={styles.nameRow}>
            <Text style={styles.name} accessibilityRole="header">
              {displayName}
              {data.isVerified && (
                <Text accessibilityLabel=" verifiziert">
                  {'  '}
                  <Ionicons name="checkmark-circle" size={20} color={colors.accentBlue} />
                </Text>
              )}
            </Text>
          </View>
          {data.nickname !== null && data.nickname.trim().length > 0 && (
            <View style={styles.nicknameRow}>
              <View style={styles.nicknameMark} />
              <Text style={styles.nickname}>„{data.nickname.trim()}“</Text>
            </View>
          )}
          {place.length > 0 && (
            <View style={styles.placeRow}>
              <Ionicons name="location-sharp" size={14} color={colors.textMuted} />
              <Text style={styles.place}>{place.join(' · ')}</Text>
            </View>
          )}
        </View>
      </View>

      <DisciplineBadges disciplines={data.disciplines} />

      {numbers.length > 0 && (
        <View style={styles.numbers}>
          {numbers.map((n, i) => (
            <View key={n.label} style={[styles.number, i > 0 && styles.numberDivider]}>
              <Text style={styles.numberValue} numberOfLines={1} adjustsFontSizeToFit>{n.value}</Text>
              <Text style={styles.numberLabel}>{n.label}</Text>
            </View>
          ))}
        </View>
      )}

      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: 16,
  },
  identity: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           16,
  },
  names: {
    flex: 1,
    gap:  4,
  },
  nameRow: {
    flexDirection: 'row',
  },
  name: {
    flexShrink:    1,
    fontSize:      26,
    fontWeight:    '900',
    letterSpacing: -0.5,
    lineHeight:    30,
    color:         colors.text,
  },
  nicknameRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  nicknameMark: {
    width:           16,
    height:          4,
    borderRadius:    2,
    backgroundColor: colors.accentBlue,
  },
  nickname: {
    flexShrink: 1,
    fontSize:   16,
    fontWeight: '800',
    color:      colors.text,
  },
  placeRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           4,
    marginTop:     4,
  },
  place: {
    flexShrink: 1,
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
    paddingVertical: 8,
  },
  number: {
    flex:              1,
    alignItems:        'center',
    paddingHorizontal: 4,
    gap:               4,
  },
  numberDivider: {
    borderLeftWidth: 1,
    borderLeftColor: colors.hairline,
  },
  numberValue: {
    fontSize:   18,
    fontWeight: '900',
    color:      colors.text,
  },
  numberLabel: {
    fontSize: 12,
    color:    colors.textMuted,
  },
});
