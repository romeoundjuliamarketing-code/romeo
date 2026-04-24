import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import type { TeamAnnouncement } from '../../types/database.types';

interface Props {
  announcement: TeamAnnouncement;
}

export default function AnnouncementCard({ announcement }: Props) {
  return (
    <View style={styles.banner}>
      <Text style={styles.message}>{announcement.message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    minHeight: 40,
    paddingHorizontal: 24,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 3,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 20,
    textAlign: 'center',
  },
});
