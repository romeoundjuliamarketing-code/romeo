import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';
import { parseSystemMessage, type SystemEventKind } from '../../utils/systemMessageText';
import SystemEventLine from './SystemEventLine';

interface SystemEvent {
  id:      string;
  content: string | null;
}

interface Props {
  /** Consecutive system events of one day, oldest first. */
  events: SystemEvent[];
}

// Up to this many events are listed directly; longer runs collapse into one
// summary line that expands to every single event.
const MAX_DIRECT = 2;
const ORDER: readonly (SystemEventKind | 'other')[] = ['joined', 'cancelled', 'expired', 'other'];

function SystemEventRun({ events }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  if (events.length <= MAX_DIRECT) {
    return (
      <View style={styles.wrap}>
        {events.map((e) => <SystemEventLine key={e.id} content={e.content ?? ''} />)}
      </View>
    );
  }

  const counts = new Map<SystemEventKind | 'other', number>();
  for (const e of events) {
    const kind = parseSystemMessage(e.content ?? '')?.kind ?? 'other';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const summary = ORDER
    .filter((k) => (counts.get(k) ?? 0) > 0)
    .map((k) => t(`chat.systemRun.${k}`, { count: counts.get(k) ?? 0 }))
    .join(' · ');

  return (
    <View style={styles.wrap}>
      <TouchableOpacity
        style={styles.summaryRow}
        onPress={() => setExpanded((v) => !v)}
        activeOpacity={0.6}
        hitSlop={{ top: 8, bottom: 8 }}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${summary}. ${expanded ? t('chat.systemRun.collapse') : t('chat.systemRun.expand')}`}
      >
        <Ionicons name="people-outline" size={14} color={colors.textMuted} />
        <Text style={styles.summaryText}>{summary}</Text>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textMuted} />
      </TouchableOpacity>
      {expanded && events.map((e) => <SystemEventLine key={e.id} content={e.content ?? ''} />)}
    </View>
  );
}

export default React.memo(SystemEventRun);

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: 4,
  },
  summaryRow: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    alignSelf:         'center',
    minHeight:         32,
    paddingHorizontal: 16,
    gap:               8,
  },
  summaryText: {
    flexShrink: 1,
    fontSize:   13,
    fontWeight: '600',
    color:      colors.textMuted,
    textAlign:  'center',
  },
});
