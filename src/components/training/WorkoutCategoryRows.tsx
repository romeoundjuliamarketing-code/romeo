import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform,
  LayoutAnimation, UIManager, Animated, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import workouts from '../../data/workouts';
import type { Workout } from '../../data/workouts';
import { colors } from '../../theme/colors';
import type { RootStackParamList } from '../../navigation/types';
import { getRelevantWorkoutCategories, SUPERCATEGORIES } from '../../data/disciplines';
import type { Supercategory } from '../../data/disciplines';
import { useCustomWorkouts } from '../../hooks/useCustomWorkouts';
import { useFavorites } from '../../hooks/useFavorites';
import { useCompletedWorkoutIds } from '../../hooks/useCompletedWorkoutIds';
import CustomWorkoutSheet from './CustomWorkoutSheet';
import type { CustomWorkout, CustomExercise } from '../../types/database.types';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Workout'>;

function difficultyColor(difficulty: Workout['difficulty']): string {
  if (difficulty === 'leicht') return colors.difficultyGreen;
  if (difficulty === 'schwer') return colors.deleteRed;
  return colors.accentBlue;
}

type CategoryEntry = { key: Workout['category']; label: string };

const ALL_CATEGORIES: CategoryEntry[] = [
  { key: 'schlagkraft',     label: 'Schlagkraft' },
  { key: 'trittkraft',      label: 'Trittkraft' },
  { key: 'ausdauer',        label: 'Ausdauer' },
  { key: 'schulter',        label: 'Schulter' },
  { key: 'nackenhals',      label: 'Nacken und Hals' },
  { key: 'griffkraft',      label: 'Griffkraft' },
  { key: 'beinarbeit',      label: 'Beinarbeit' },
  { key: 'koordination',    label: 'Koordination' },
  { key: 'mobilitaet',      label: 'Mobilität' },
  { key: 'partnertraining', label: 'Partnertraining' },
];

const SUPER_PREFIX = 'sc_';
const ROTATION_KEYS = [
  ...SUPERCATEGORIES.map((sc) => `${SUPER_PREFIX}${sc.key}`),
  ...ALL_CATEGORIES.map((c) => c.key),
  'eigene',
  'favoriten',
];

interface Props {
  disciplines: string[];
}

// Safely parse the jsonb exercises field from Supabase
function parseExercises(raw: unknown): CustomExercise[] {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[]).flatMap((item) => {
    if (typeof item !== 'object' || item === null) return [];
    const ex = item as Record<string, unknown>;
    if (typeof ex['name'] !== 'string') return [];
    return [{
      name: ex['name'],
      duration: typeof ex['duration'] === 'string' ? ex['duration'] : '60s',
      pause: typeof ex['pause'] === 'string' ? ex['pause'] : '30s',
    }];
  });
}

// ─── Eigene card ──────────────────────────────────────────────────────────────

interface EigeneCardProps {
  isOpen: boolean;
  rotation: Animated.Value;
  customWorkouts: CustomWorkout[];
  onToggle: () => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
  onStart: (workout: CustomWorkout) => void;
}

function EigeneCard({
  isOpen, rotation, customWorkouts, onToggle, onAdd, onDelete, onStart,
}: EigeneCardProps): React.ReactElement {
  const chevronRotate = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={styles.card}>
      <TouchableOpacity style={styles.cardHeader} onPress={onToggle} activeOpacity={0.7}>
        <View style={styles.headerInfo}>
          <Text style={styles.categoryLabel}>Eigene</Text>
        </View>
        <TouchableOpacity onPress={onAdd} activeOpacity={0.7} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="add" size={22} color={colors.accentBlue} />
        </TouchableOpacity>
        <Animated.View style={[styles.chevron, { transform: [{ rotate: chevronRotate }] }]}>
          <Ionicons name="chevron-down" size={16} color={colors.headerTextSecondary} />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <View style={styles.workoutList}>
          {customWorkouts.length === 0 ? (
            <Text style={styles.emptyLabel}>Noch keine eigenen Workouts. Tippe auf + um ein Workout zu erstellen.</Text>
          ) : (
            customWorkouts.map((w) => (
              <TouchableOpacity key={w.id} style={styles.workoutCard} activeOpacity={0.7} onPress={() => onStart(w)}>
                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutTitle}>{w.title}</Text>
                  <Text style={styles.workoutMeta}>
                    {w.rounds} Runden · {w.duration_min} Min · {Math.max(1, Math.floor(w.duration_min / 30)) * 35} Pts
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => onDelete(w.id)}
                  activeOpacity={0.7}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={18} color={colors.inactive} />
                </TouchableOpacity>
                <Ionicons name="chevron-forward" size={16} color={colors.headerTextSecondary} />
              </TouchableOpacity>
            ))
          )}
        </View>
      )}
    </View>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function WorkoutCategoryRows({ disciplines }: Props): React.ReactElement {
  const navigation = useNavigation<NavigationProp>();
  const relevantKeys = getRelevantWorkoutCategories(disciplines);
  const CATEGORIES = ALL_CATEGORIES.filter((c) => relevantKeys.includes(c.key));

  const [openSuper, setOpenSuper] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);

  const { customWorkouts, create, remove } = useCustomWorkouts();
  const { favoriteIds, isFavorite, toggleFavorite } = useFavorites();
  const completedTitles = useCompletedWorkoutIds();

  const rotations = useRef<Record<string, Animated.Value>>(
    Object.fromEntries(ROTATION_KEYS.map((k) => [k, new Animated.Value(0)])),
  ).current;

  function animate(key: string, toValue: number): void {
    Animated.timing(rotations[key], {
      toValue,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }

  function toggleSuper(scKey: string): void {
    const willOpen = openSuper !== scKey;

    LayoutAnimation.configureNext(
      LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );

    // Close open category when changing supercategory
    if (openCategory !== null) {
      animate(openCategory, 0);
      setOpenCategory(null);
    }

    // Collapse previous supercategory
    if (openSuper !== null && openSuper !== scKey) {
      animate(`${SUPER_PREFIX}${openSuper}`, 0);
    }

    animate(`${SUPER_PREFIX}${scKey}`, willOpen ? 1 : 0);
    setOpenSuper(willOpen ? scKey : null);
  }

  function toggleCategory(key: string): void {
    const willOpen = openCategory !== key;

    LayoutAnimation.configureNext(
      LayoutAnimation.create(260, LayoutAnimation.Types.easeInEaseOut, LayoutAnimation.Properties.opacity),
    );

    if (openCategory !== null && openCategory !== key) {
      animate(openCategory, 0);
    }

    animate(key, willOpen ? 1 : 0);
    setOpenCategory(willOpen ? key : null);
  }

  function handleDeleteCustom(id: string): void {
    Alert.alert('Workout löschen', 'Dieses Workout wirklich löschen?', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Löschen', style: 'destructive', onPress: () => { void remove(id); } },
    ]);
  }

  function handleStartCustom(workout: CustomWorkout): void {
    const exercises = parseExercises(workout.exercises);
    navigation.navigate('Workout', {
      title: workout.title,
      subtitle: '',
      category: 'eigene',
      trainingType: workout.training_type,
      exercises: exercises.length > 0 ? exercises : [{ name: 'Freies Training', duration: '60s', pause: '30s' }],
      duration: `${workout.duration_min} Min`,
      earnedPoints: Math.max(1, Math.floor(workout.duration_min / 30)) * 35,
    });
  }

  const favoriteWorkouts = workouts.filter((w) => favoriteIds.has(w.id));

  function navigateToWorkout(workout: Workout): void {
    navigation.navigate('Workout', {
      title: workout.title,
      subtitle: workout.subtitle,
      category: workout.category,
      exercises: workout.exercises,
      duration: `${workout.durationMin} Min`,
      difficulty: workout.difficulty,
      equipment: workout.equipment,
      pointsPer30Min: workout.pointsPerUnit,
      earnedPoints:
        workout.maxPoints ??
        Math.max(1, Math.floor(workout.durationMin / 30)) * workout.pointsPerUnit,
    });
  }

  return (
    <View style={styles.container}>
      {/* ── Favoriten ── */}
      {favoriteWorkouts.length > 0 && (
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardHeader}
            onPress={() => toggleCategory('favoriten')}
            activeOpacity={0.7}
          >
            <View style={styles.headerInfo}>
              <Text style={styles.categoryLabel}>Favoriten</Text>
            </View>
            <Animated.View style={{ transform: [{ rotate: rotations['favoriten'].interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
              <Ionicons name="chevron-down" size={16} color={colors.headerTextSecondary} />
            </Animated.View>
          </TouchableOpacity>

          {openCategory === 'favoriten' && (
            <View style={styles.workoutList}>
              {favoriteWorkouts.map((workout) => (
                <TouchableOpacity
                  key={workout.id}
                  style={styles.workoutCard}
                  activeOpacity={0.7}
                  onPress={() => navigateToWorkout(workout)}
                >
                  {completedTitles.has(workout.title) && (
                    <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} style={styles.doneCheck} />
                  )}
                  <View style={styles.workoutInfo}>
                    <View style={styles.titleRow}>
                      <View style={[styles.difficultyDot, { backgroundColor: difficultyColor(workout.difficulty) }]} />
                      <Text style={[styles.workoutTitle, styles.titleFlex]}>{workout.title}</Text>
                    </View>
                    <Text style={styles.workoutSubtitle}>{workout.subtitle}</Text>
                    <Text style={styles.workoutMeta}>
                      {workout.durationMin} Min
                      {workout.maxPoints !== undefined
                        ? `  ·  max. ${workout.maxPoints} Pts`
                        : `  ·  ${workout.pointsPerUnit} Pts / 30 Min`}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => { void toggleFavorite(workout.id); }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="heart" size={18} color={colors.accentBlue} />
                  </TouchableOpacity>
                  <Ionicons name="chevron-forward" size={16} color={colors.headerTextSecondary} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      )}

      {/* ── Eigene ── */}
      <EigeneCard
        isOpen={openCategory === 'eigene'}
        rotation={rotations['eigene']}
        customWorkouts={customWorkouts}
        onToggle={() => toggleCategory('eigene')}
        onAdd={() => setSheetVisible(true)}
        onDelete={handleDeleteCustom}
        onStart={handleStartCustom}
      />

      {/* ── Supercategories ── */}
      {SUPERCATEGORIES.filter((sc) =>
        sc.groups.some((g) => relevantKeys.includes(g as Workout['category'])),
      ).map((sc: Supercategory) => {
        const scIsOpen = openSuper === sc.key;
        const scChevron = rotations[`${SUPER_PREFIX}${sc.key}`].interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '180deg'],
        });
        const scCategories = CATEGORIES.filter((c) =>
          (sc.groups as string[]).includes(c.key),
        );

        return (
          <View key={sc.key} style={styles.card}>
            <TouchableOpacity style={styles.cardHeader} onPress={() => toggleSuper(sc.key)} activeOpacity={0.7}>
              <View style={styles.headerInfo}>
                <Text style={styles.categoryLabel}>{sc.label}</Text>
              </View>
              <Animated.View style={{ transform: [{ rotate: scChevron }] }}>
                <Ionicons name="chevron-down" size={16} color={colors.headerTextSecondary} />
              </Animated.View>
            </TouchableOpacity>

            {scIsOpen && (
              <View style={styles.subCategoryList}>
                {scCategories.map(({ key, label }) => {
                  const catWorkouts = workouts.filter((w) => w.category === key);
                  const catIsOpen = openCategory === key;
                  const catChevron = rotations[key].interpolate({
                    inputRange: [0, 1],
                    outputRange: ['0deg', '180deg'],
                  });

                  return (
                    <View key={key} style={styles.subCard}>
                      <TouchableOpacity style={styles.cardHeader} onPress={() => toggleCategory(key)} activeOpacity={0.7}>
                        <View style={styles.headerInfo}>
                          <Text style={styles.subCategoryLabel}>{label}</Text>
                        </View>
                        <Animated.View style={{ transform: [{ rotate: catChevron }] }}>
                          <Ionicons name="chevron-down" size={16} color={colors.headerTextSecondary} />
                        </Animated.View>
                      </TouchableOpacity>

                      {catIsOpen && (
                        <View style={styles.workoutList}>
                          {catWorkouts.map((workout) => (
                            <TouchableOpacity
                              key={workout.id}
                              style={styles.workoutCard}
                              activeOpacity={0.7}
                              onPress={() => navigateToWorkout(workout)}
                            >
                              {completedTitles.has(workout.title) && (
                                <Ionicons name="checkmark-circle" size={18} color={colors.accentBlue} style={styles.doneCheck} />
                              )}
                              <View style={styles.workoutInfo}>
                                <View style={styles.titleRow}>
                                  <View style={[styles.difficultyDot, { backgroundColor: difficultyColor(workout.difficulty) }]} />
                                  <Text style={[styles.workoutTitle, styles.titleFlex]}>{workout.title}</Text>
                                </View>
                                <Text style={styles.workoutSubtitle}>{workout.subtitle}</Text>
                                <Text style={styles.workoutMeta}>
                                  {workout.durationMin} Min
                                  {workout.maxPoints !== undefined
                                    ? `  ·  max. ${workout.maxPoints} Pts`
                                    : `  ·  ${workout.pointsPerUnit} Pts / 30 Min`}
                                </Text>
                              </View>
                              <TouchableOpacity
                                onPress={() => { void toggleFavorite(workout.id); }}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                activeOpacity={0.7}
                              >
                                <Ionicons
                                  name={isFavorite(workout.id) ? 'heart' : 'heart-outline'}
                                  size={18}
                                  color={isFavorite(workout.id) ? colors.accentBlue : colors.headerTextSecondary}
                                />
                              </TouchableOpacity>
                              <Ionicons name="chevron-forward" size={16} color={colors.headerTextSecondary} />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        );
      })}

      <CustomWorkoutSheet
        visible={sheetVisible}
        onClose={() => setSheetVisible(false)}
        onSave={(payload) => { void create(payload); }}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 12,
    paddingHorizontal: 16,
  },

  card: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },

  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerInfo: { flex: 1, gap: 4 },
  categoryLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  chevron: { marginLeft: 8 },

  subCategoryList: {
    gap: 8,
  },

  subCard: {
    backgroundColor: colors.headerCard,
    borderRadius: 12,
    padding: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.headerBorder,
  },

  subCategoryLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },

  workoutList: { gap: 12 },

  workoutCard: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 12,
  },
  workoutInfo: { flex: 1, gap: 4 },
  workoutTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  workoutSubtitle: {
    fontSize: 13,
    fontWeight: '400',
    color: colors.headerTextSecondary,
  },
  workoutMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentBlue,
    marginTop: 4,
  },

  emptyLabel: {
    fontSize: 13,
    color: colors.headerTextSecondary,
    fontWeight: '400',
    lineHeight: 18,
  },

  // Difficulty dot + title row
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  titleFlex: {
    flex: 1,
  },
  difficultyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // Completed checkmark (top-right of card)
  doneCheck: {
    position: 'absolute',
    top: 10,
    right: 10,
  },
});
