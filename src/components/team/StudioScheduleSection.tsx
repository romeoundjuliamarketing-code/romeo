import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { colors } from '../../theme/colors';
import { DayBlock } from '../training/TrainingsplanTab';
import ScheduleEntrySheet from '../training/ScheduleEntrySheet';
import type { ScheduleEntryValues } from '../training/ScheduleEntrySheet';
import { useStudioScheduleEditor } from '../../hooks/useStudioScheduleEditor';
import type { StudioSchedule } from '../../types/database.types';

interface Props {
  studioId: string;
  schedule: StudioSchedule[];
  loading:  boolean;
  onRefetch: () => void;
}

export default function StudioScheduleSection({ studioId, schedule, loading, onRefetch }: Props): React.ReactElement {
  const { saving, addSession, deleteSession } = useStudioScheduleEditor();

  const [addForDay, setAddForDay] = useState<number | null>(null);

  const byDay = Array.from({ length: 7 }, (_, i) =>
    schedule.filter((s) => s.day_of_week === i),
  );

  async function handleAddEntry(entry: ScheduleEntryValues): Promise<void> {
    const { error } = await addSession(studioId, entry);
    if (error === null) onRefetch();
    setAddForDay(null);
  }

  async function handleDeleteEntry(id: string): Promise<void> {
    const { error } = await deleteSession(id);
    if (error === null) onRefetch();
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Studio-Stundenplan bearbeiten</Text>
        <Text style={styles.subtitle}>Änderungen sind sofort für alle Mitglieder sichtbar.</Text>
      </View>

      {loading || saving ? (
        <ActivityIndicator color={colors.accentBlue} style={styles.loader} />
      ) : (
        <View style={styles.planList}>
          {byDay.map((sessions, i) => (
            <DayBlock
              key={i}
              dayIndex={i}
              sessions={sessions}
              isToday={false}
              isPast={false}
              editMode
              onDeleteSession={(id) => { void handleDeleteEntry(id); }}
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
        showCoachFields
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.dark,
    borderRadius: 16,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.headerBorder,
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.headerTextSecondary,
  },
  loader: {
    marginVertical: 24,
  },
  planList: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
});
