import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../theme/colors';
import workouts, { type Workout } from '../data/workouts';
import ModuleTab from '../components/training/ModuleTab';
import TrainingsplanTab from '../components/training/TrainingsplanTab';
import ExtraTab from '../components/training/ExtraTab';

type ActiveTab = 'module' | 'plan' | 'extra';
type SegmentItem = { key: ActiveTab; label: string };
type WorkoutCategory = Workout['category'];

type CategoryFilter = {
  key: WorkoutCategory;
  label: string;
};

const SEGMENTS: SegmentItem[] = [
  { key: 'module', label: 'Module' },
  { key: 'plan', label: 'Trainingsplan' },
  { key: 'extra', label: 'Extra' },
];

const CATEGORY_FILTERS: CategoryFilter[] = [
  { key: 'schlagkraft', label: 'Schlagkraft' },
  { key: 'trittkraft', label: 'Trittkraft' },
  { key: 'ausdauer', label: 'Ausdauer' },
  { key: 'schulter', label: 'Schulter' },
  { key: 'beinarbeit', label: 'Beinarbeit' },
  { key: 'koordination', label: 'Koordination' },
  { key: 'mobilitaet', label: 'Mobilitaet' },
];

export default function TrainingScreen() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('module');
  const [activeCategory, setActiveCategory] = useState<WorkoutCategory>('schlagkraft');

  const filteredWorkouts = useMemo(
    () => workouts.filter((workout) => workout.category === activeCategory),
    [activeCategory]
  );

  function renderTab(): React.ReactElement {
    switch (activeTab) {
      case 'module':
        return <ModuleTab workouts={filteredWorkouts} />;
      case 'plan':
        return <TrainingsplanTab />;
      case 'extra':
        return <ExtraTab />;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.segmentWrap}>
        {SEGMENTS.map((seg) => {
          const active = activeTab === seg.key;
          return (
            <TouchableOpacity
              key={seg.key}
              style={[styles.segment, active && styles.segmentActive]}
              onPress={() => setActiveTab(seg.key)}
              activeOpacity={0.7}
            >
              <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]} numberOfLines={1}>
                {seg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {activeTab === 'module' && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContent}
          style={styles.filterScroll}
        >
          {CATEGORY_FILTERS.map((item) => {
            const isActive = item.key === activeCategory;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveCategory(item.key)}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}

      {renderTab()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  segmentWrap: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 0,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  segment: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginBottom: -1,
  },
  segmentActive: {
    borderBottomColor: colors.accentBlue,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
  },
  segmentLabelActive: {
    color: colors.accentBlue,
  },
  filterScroll: {
    maxHeight: 48,
  },
  filterContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.card,
  },
  filterChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  filterChipTextActive: {
    color: colors.headerTextPrimary,
  },
});
