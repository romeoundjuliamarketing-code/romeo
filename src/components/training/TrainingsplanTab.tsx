import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useSchedule } from '../../hooks/useSchedule';
import type { StudioSchedule, ScheduleDisplayItem } from '../../types/database.types';

// JS getDay(): 0=Sun … 6=Sat → 0=Mon … 6=Sun
function todayDayOfWeek(): number {
  return (new Date().getDay() + 6) % 7;
}

const DAY_NAMES = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

// ─── Sub-component: single session row ────────────────────────────────────────

export type SessionRowProps = {
  session: ScheduleDisplayItem;
  editMode?: boolean;
  onDelete?: (id: string) => void;
};

export function SessionRow({ session, editMode = false, onDelete }: SessionRowProps): React.ReactElement {
  return (
    <View style={styles.sessionRow}>
      {editMode && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => onDelete?.(session.id)}
          activeOpacity={0.7}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons name="minus-circle" size={20} color={colors.deleteRed} />
        </TouchableOpacity>
      )}
      <View style={styles.sessionInfo}>
        <Text style={styles.sessionName}>{session.training_name}</Text>
        <Text style={styles.sessionMeta}>
          {session.start_time.slice(0, 5)} Uhr · {session.duration_min} Min
          {session.coach_name !== null ? ` · ${session.coach_name}` : ''}
        </Text>
      </View>
    </View>
  );
}

// ─── Sub-component: day block ──────────────────────────────────────────────────

export type DayBlockProps = {
  dayIndex: number;
  sessions: ScheduleDisplayItem[];
  isToday: boolean;
  isPast?: boolean;
  editMode?: boolean;
  onDeleteSession?: (id: string) => void;
  onAddSession?: (dayIndex: number) => void;
};

export function DayBlock({
  dayIndex,
  sessions,
  isToday,
  isPast = false,
  editMode = false,
  onDeleteSession,
  onAddSession,
}: DayBlockProps): React.ReactElement {
  return (
    <View style={[styles.card, isToday && styles.cardToday, isPast && styles.cardPast]}>
      <Text style={[styles.dayName, isToday && styles.dayNameToday]}>
        {DAY_NAMES[dayIndex]}
        {isToday ? '  —  Heute' : ''}
      </Text>

      {sessions.length === 0 && !editMode ? (
        <Text style={styles.restLabel}>Ruhetag</Text>
      ) : (
        sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            editMode={editMode}
            onDelete={onDeleteSession}
          />
        ))
      )}

      {editMode && (
        <TouchableOpacity
          style={styles.addSessionBtn}
          onPress={() => onAddSession?.(dayIndex)}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="plus" size={16} color={colors.accentBlue} />
          <Text style={styles.addSessionLabel}>Einheit hinzufügen</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TrainingsplanTab(): React.ReactElement {
  const { schedule, loading, error } = useSchedule();
  const today = todayDayOfWeek();

  // Group sessions by day_of_week (0–6)
  const byDay = Array.from({ length: 7 }, (_, i) =>
    schedule.filter((s) => s.day_of_week === i),
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  if (error !== null) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>Fehler beim Laden des Trainingsplans.</Text>
      </View>
    );
  }

  // No ScrollView — parent provides the outer scroll context
  return (
    <View style={styles.content}>
      {byDay.map((sessions, i) => (
        <DayBlock
          key={i}
          dayIndex={i}
          sessions={sessions}
          isToday={i === today}
          isPast={i < today}
        />
      ))}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  content: {
    gap: 12,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  errorText: {
    fontSize: 14,
    color: colors.headerTextSecondary,
    textAlign: 'center',
  },

  // Day card
  card: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(74,144,217,0.6)',
    ...Platform.select({
      ios: {
        shadowColor: '#4A90D9',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.95,
        shadowRadius: 16,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  cardToday: {
    borderLeftWidth: 3,
    borderLeftColor: colors.accentBlue,
  },
  cardPast: {
    opacity: 0.5,
  },
  dayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  dayNameToday: {
    color: colors.accentBlue,
  },
  restLabel: {
    fontSize: 13,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },

  // Session row within a day card
  sessionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  deleteBtn: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: {
    flex: 1,
    gap: 4,
  },
  sessionName: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  sessionMeta: {
    fontSize: 12,
    color: colors.headerTextSecondary,
    fontWeight: '400',
  },
  addSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.headerBorder,
    marginTop: 4,
  },
  addSessionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },

});
