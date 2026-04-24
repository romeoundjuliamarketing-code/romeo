import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { DayBlock } from './TrainingsplanTab';
import ScheduleEntrySheet from './ScheduleEntrySheet';
import type { ScheduleEntryValues } from './ScheduleEntrySheet';
import { useUserSchedule } from '../../hooks/useUserSchedule';
import type { StudioSchedule, ScheduleDisplayItem } from '../../types/database.types';

interface Props {
  studioSchedule: StudioSchedule[];
  studioLoading:  boolean;
  todayDow:       number;
  hasStudio:      boolean;
}

export default function StundenplanSection({ studioSchedule, studioLoading, todayDow, hasStudio }: Props): React.ReactElement {
  const {
    schedule: userSchedule,
    hasPersonalSchedule,
    loading: userLoading,
    initFromStudio,
    addEntry,
    deleteEntry,
  } = useUserSchedule();

  const [editMode, setEditMode] = useState(false);
  const [addForDay, setAddForDay] = useState<number | null>(null);
  const [initializing, setInitializing] = useState(false);

  const loading = studioLoading || userLoading;

  // Personal schedule if present, else studio fallback (no studio → empty).
  const displaySchedule: ScheduleDisplayItem[] = hasPersonalSchedule
    ? userSchedule
    : (hasStudio ? studioSchedule : []);

  const byDay = Array.from({ length: 7 }, (_, i) =>
    displaySchedule.filter((s) => s.day_of_week === i),
  );

  async function handleEditToggle(): Promise<void> {
    if (editMode) {
      setEditMode(false);
      return;
    }

    // First time editing with a studio: copy studio schedule as starting point
    if (!hasPersonalSchedule && hasStudio) {
      setInitializing(true);
      await initFromStudio(studioSchedule);
      setInitializing(false);
    }

    setEditMode(true);
  }

  async function handleAddEntry(entry: ScheduleEntryValues): Promise<void> {
    await addEntry({
      day_of_week:      entry.day_of_week,
      training_name:    entry.training_name,
      start_time:       entry.start_time,
      duration_min:     entry.duration_min,
      points_per_30min: entry.points_per_30min,
    });
    setAddForDay(null);
  }

  return (
    <View>
      {/* Section header with edit toggle */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Stundenplan</Text>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => { void handleEditToggle(); }}
          activeOpacity={0.7}
          disabled={initializing}
        >
          {initializing ? (
            <ActivityIndicator size="small" color={colors.accentBlue} />
          ) : (
            <>
              <MaterialCommunityIcons
                name={editMode ? 'check' : 'pencil-outline'}
                size={16}
                color={editMode ? colors.accentBlue : colors.headerTextSecondary}
              />
              <Text style={[styles.editBtnLabel, editMode && styles.editBtnLabelActive]}>
                {editMode ? 'Fertig' : 'Bearbeiten'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      ) : !hasStudio && !hasPersonalSchedule && !editMode ? (
        // No studio and no personal schedule yet — prompt to create one
        <TouchableOpacity
          style={styles.emptyState}
          onPress={() => { void handleEditToggle(); }}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="calendar-plus" size={28} color={colors.accentBlue} />
          <Text style={styles.emptyTitle}>Eigenen Stundenplan erstellen</Text>
          <Text style={styles.emptySubtitle}>Du bist noch keinem Team beigetreten. Tippe hier, um deinen persönlichen Trainingsplan einzurichten.</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.planList}>
          {byDay.map((sessions, i) => (
            <DayBlock
              key={i}
              dayIndex={i}
              sessions={sessions}
              isToday={i === todayDow}
              isPast={i < todayDow}
              editMode={editMode}
              onDeleteSession={(id) => { void deleteEntry(id); }}
              onAddSession={(day) => setAddForDay(day)}
            />
          ))}
        </View>
      )}

      <ScheduleEntrySheet
        visible={addForDay !== null}
        initialDay={addForDay ?? 0}
        onClose={() => setAddForDay(null)}
        onConfirm={(entry) => { void handleAddEntry(entry); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  editBtnLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },
  editBtnLabelActive: {
    color: colors.accentBlue,
  },
  loader: {
    marginVertical: 16,
  },
  planList: {
    paddingHorizontal: 16,
    gap: 12,
  },

  // Empty state for users without a studio
  emptyState: {
    marginHorizontal: 16,
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(74,144,217,0.6)',
    padding: 24,
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    textAlign: 'center',
    marginTop: 4,
  },
  emptySubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.headerTextSecondary,
    textAlign: 'center',
    lineHeight: 18,
  },
});
