import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { EventWithMeta } from '../../hooks/useOpenEvents';

interface Props {
  events: EventWithMeta[];
  onPressEvent: (e: EventWithMeta) => void;
}

function formatDateTime(isoString: string): string {
  const date = new Date(isoString);
  const dateStr = date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const timeStr = date.toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr}, ${timeStr} Uhr`;
}

export default function VenueEventsList({ events, onPressEvent }: Props): React.ReactElement {
  if (events.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Keine kommenden Events</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {events.map((event, index) => (
        <TouchableOpacity
          key={event.id}
          style={[styles.row, index < events.length - 1 && styles.rowBorder]}
          onPress={() => onPressEvent(event)}
          activeOpacity={0.7}
        >
          <View style={styles.rowMain}>
            <Text style={styles.title} numberOfLines={1}>{event.title}</Text>
            {event.fight_card !== null && (
              <Text style={styles.fightCard} numberOfLines={1}>{event.fight_card}</Text>
            )}
            <Text style={styles.dateTime}>{formatDateTime(event.scheduled_at)}</Text>
          </View>
          <View style={styles.rowMeta}>
            {/* Venue events are public viewings -> show a label, no attendance count. */}
            <View style={styles.slotsRow}>
              <Ionicons name="people-outline" size={14} color={colors.textSecondary} />
              <Text style={styles.slotsText}>Public Viewing</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowMain: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  fightCard: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  dateTime: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  rowMeta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotsText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
});
