import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useStudioScheduleEditor } from '../../hooks/useStudioScheduleEditor';
import ScheduleEntrySheet from '../training/ScheduleEntrySheet';
import type { ScheduleEntryValues } from '../training/ScheduleEntrySheet';
import type { StudioSchedule } from '../../types/database.types';

// ─── Constants ───────────────────────────────────────────────────────────────

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as const;
const PX_PER_MIN = 1;
const START_HOUR = 6;
const END_HOUR = 23;
const HOUR_LABEL_WIDTH = 48;
const HORIZONTAL_INSET = 16; // matches section padding

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  // accepts "HH:MM" or "HH:MM:SS"
  const parts = time.split(':');
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  return h * 60 + m;
}

function formatHour(hour: number): string {
  const h = String(hour).padStart(2, '0');
  return `${h}:00`;
}

function sessionToValues(s: StudioSchedule): ScheduleEntryValues {
  return {
    day_of_week:      s.day_of_week,
    training_name:    s.training_name,
    start_time:       s.start_time.slice(0, 5),
    duration_min:     s.duration_min,
    points_per_30min: s.points_per_30min,
    training_type:    s.training_type,
    coach_name:       s.coach_name,
    drop_in_enabled:  s.drop_in_enabled,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface Props {
  studioId: string;
  schedule: StudioSchedule[];
  loading: boolean;
  onRefetch: () => void;
}

// ─── Sub-component: single day time axis ─────────────────────────────────────

interface DayAxisProps {
  sessions: StudioSchedule[];
  pageWidth: number;
  onSessionPress: (session: StudioSchedule) => void;
}

function DayAxis({ sessions, pageWidth, onSessionPress }: DayAxisProps): React.ReactElement {
  // Compute visible window (widen if sessions fall outside defaults)
  const defaultStartMin = START_HOUR * 60;
  const defaultEndMin = END_HOUR * 60;

  let windowStartMin = defaultStartMin;
  let windowEndMin = defaultEndMin;

  for (const s of sessions) {
    const startMin = timeToMinutes(s.start_time);
    const endMin = startMin + s.duration_min;
    if (startMin < windowStartMin) {
      windowStartMin = Math.floor(startMin / 60) * 60;
    }
    if (endMin > windowEndMin) {
      windowEndMin = Math.ceil(endMin / 60) * 60;
    }
  }

  const totalMinutes = windowEndMin - windowStartMin;
  const totalHeight = totalMinutes * PX_PER_MIN;
  const hourCount = totalMinutes / 60;
  const blockWidth = pageWidth - HORIZONTAL_INSET * 2 - HOUR_LABEL_WIDTH - 8;

  const hours: number[] = [];
  for (let i = 0; i <= hourCount; i++) {
    hours.push(windowStartMin / 60 + i);
  }

  return (
    <ScrollView
      style={styles.axisScroll}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[styles.axisContent, { height: totalHeight + 64 }]}
    >
      {/* Hour rows */}
      <View style={[styles.axisInner, { height: totalHeight }]}>
        {hours.map((hour) => {
          const topPx = (hour * 60 - windowStartMin) * PX_PER_MIN;
          return (
            <View key={hour} style={[styles.hourRow, { top: topPx }]}>
              <Text style={styles.hourLabel}>{formatHour(hour)}</Text>
              <View style={styles.hourLine} />
            </View>
          );
        })}

        {/* Session blocks */}
        <View style={[styles.blocksLayer, { height: totalHeight }]}>
          {sessions.map((session) => {
            const startMin = timeToMinutes(session.start_time);
            const top = (startMin - windowStartMin) * PX_PER_MIN;
            const height = Math.max(session.duration_min * PX_PER_MIN, 32);
            return (
              <TouchableOpacity
                key={session.id}
                activeOpacity={0.8}
                onPress={() => onSessionPress(session)}
                style={[styles.block, { top, height, width: blockWidth }]}
              >
                <Text style={styles.blockName} numberOfLines={1}>{session.training_name}</Text>
                <Text style={styles.blockMeta} numberOfLines={1}>
                  {session.start_time.slice(0, 5)}
                  {' · '}
                  {session.duration_min} Min
                </Text>
                {session.coach_name !== null && (
                  <Text style={styles.blockCoach} numberOfLines={1}>{session.coach_name}</Text>
                )}
                {session.drop_in_enabled && (
                  <View style={styles.dropInBadge}>
                    <Ionicons name="person-add-outline" size={10} color={colors.headerTextPrimary} />
                    <Text style={styles.dropInText}>Drop-in</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudioScheduleCalendar({
  studioId,
  schedule,
  loading,
  onRefetch,
}: Props): React.ReactElement {
  const { width: windowWidth } = useWindowDimensions();
  const pageWidth = windowWidth - HORIZONTAL_INSET * 2;

  const pagerRef = useRef<ScrollView>(null);
  const [selectedDay, setSelectedDay] = useState(0);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [editingSession, setEditingSession] = useState<StudioSchedule | null>(null);

  const { saving, addSession, updateSession, deleteSession } = useStudioScheduleEditor();

  // ── Pager interaction ──────────────────────────────────────────────────────

  function handleDayPillPress(day: number): void {
    setSelectedDay(day);
    pagerRef.current?.scrollTo({ x: pageWidth * day, animated: true });
  }

  function handleMomentumScrollEnd(
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ): void {
    const offsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(offsetX / pageWidth);
    setSelectedDay(page);
  }

  // ── Sheet helpers ──────────────────────────────────────────────────────────

  function openAddSheet(): void {
    setEditingSession(null);
    setSheetVisible(true);
  }

  function openEditSheet(session: StudioSchedule): void {
    setEditingSession(session);
    setSheetVisible(true);
  }

  function closeSheet(): void {
    setSheetVisible(false);
    setEditingSession(null);
  }

  const handleConfirm = useCallback(
    async (values: ScheduleEntryValues): Promise<void> => {
      const result =
        editingSession === null
          ? await addSession(studioId, values)
          : await updateSession(editingSession.id, values);

      if (result.error !== null) {
        Alert.alert('Fehler', result.error);
      } else {
        onRefetch();
      }
      closeSheet();
    },
    [editingSession, studioId, addSession, updateSession, onRefetch],
  );

  function handleDelete(): void {
    if (editingSession === null) return;
    const sessionId = editingSession.id;
    Alert.alert(
      'Einheit löschen',
      'Möchtest du diese Einheit wirklich löschen?',
      [
        { text: 'Abbrechen', style: 'cancel' },
        {
          text: 'Löschen',
          style: 'destructive',
          onPress: async () => {
            const { error } = await deleteSession(sessionId);
            if (error !== null) {
              Alert.alert('Fehler', error);
            } else {
              onRefetch();
            }
            closeSheet();
          },
        },
      ],
    );
  }

  // ── Per-day session lists (active sessions only) ──────────────────────────

  const sessionsByDay: StudioSchedule[][] = Array.from({ length: 7 }, (_, day) =>
    schedule
      .filter((s) => s.is_active && s.day_of_week === day)
      .sort((a, b) => timeToMinutes(a.start_time) - timeToMinutes(b.start_time)),
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* Section header */}
      <View style={styles.header}>
        <Text style={styles.sectionLabel}>Stundenplan</Text>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.75}
          onPress={openAddSheet}
        >
          <Ionicons name="add" size={16} color={colors.accentBlue} />
          <Text style={styles.addBtnLabel}>Einheit hinzufügen</Text>
        </TouchableOpacity>
      </View>

      {/* Day pills */}
      <View style={styles.pillRow}>
        {DAY_LABELS.map((label, day) => (
          <TouchableOpacity
            key={day}
            style={[styles.pill, selectedDay === day && styles.pillActive]}
            onPress={() => handleDayPillPress(day)}
            activeOpacity={0.7}
          >
            <Text style={[styles.pillText, selectedDay === day && styles.pillTextActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Pager */}
      {loading || saving ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator color={colors.accentBlue} />
        </View>
      ) : (
        <ScrollView
          ref={pagerRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={handleMomentumScrollEnd}
          scrollEventThrottle={16}
          style={[styles.pager, { width: pageWidth }]}
        >
          {DAY_LABELS.map((_, day) => (
            <View key={day} style={[styles.page, { width: pageWidth }]}>
              {sessionsByDay[day].length === 0 ? (
                <View style={styles.emptyDay}>
                  <Ionicons name="calendar-outline" size={32} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>Keine Einheiten</Text>
                </View>
              ) : (
                <DayAxis
                  sessions={sessionsByDay[day]}
                  pageWidth={pageWidth}
                  onSessionPress={openEditSheet}
                />
              )}
            </View>
          ))}
        </ScrollView>
      )}

      {/* Entry sheet (single instance) */}
      <ScheduleEntrySheet
        visible={sheetVisible}
        initialDay={selectedDay}
        showCoachFields
        initialValues={editingSession === null ? null : sessionToValues(editingSession)}
        onClose={closeSheet}
        onConfirm={(values) => { void handleConfirm(values); }}
        onDelete={editingSession === null ? undefined : handleDelete}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
    paddingHorizontal: HORIZONTAL_INSET,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    backgroundColor: colors.accentBlueSoft,
  },
  addBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentBlue,
  },

  // Day pills
  pillRow: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: 12,
  },
  pill: {
    flex: 1,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.accentBlue,
    borderColor: colors.accentBlue,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  pillTextActive: {
    color: colors.headerTextPrimary,
  },

  // Pager
  pager: {
    // width is set dynamically via style array
  },
  page: {
    // width is set dynamically via style array
    minHeight: 200,
  },

  // Loading
  loaderWrap: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Empty state
  emptyDay: {
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },

  // Time axis
  axisScroll: {
    flex: 1,
  },
  axisContent: {
    // height set dynamically
  },
  axisInner: {
    // height set dynamically; positioning context for absolute children
    position: 'relative',
  },

  // Hour rows
  hourRow: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  hourLabel: {
    width: HOUR_LABEL_WIDTH,
    fontSize: 10,
    fontWeight: '600',
    color: colors.textSecondary,
    textAlign: 'right',
    paddingRight: 8,
  },
  hourLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },

  // Blocks layer (sits to the right of hour labels)
  blocksLayer: {
    position: 'absolute',
    left: HOUR_LABEL_WIDTH + 8,
    right: 0,
    top: 0,
  },

  // Session block
  block: {
    position: 'absolute',
    left: 0,
    borderRadius: 8,
    backgroundColor: colors.accentBlue,
    padding: 6,
    gap: 2,
    overflow: 'hidden',
  },
  blockName: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  blockMeta: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.headerTextSecondary,
  },
  blockCoach: {
    fontSize: 10,
    color: colors.headerTextSecondary,
  },
  dropInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 2,
  },
  dropInText: {
    fontSize: 9,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
});
