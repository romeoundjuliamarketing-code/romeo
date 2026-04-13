import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TrainingEntry = {
  id: string;
  day: string;
  isRest: false;
  title: string;
  duration: string;
  coach: string;
  isConditioning: boolean;
};

type RestEntry = {
  id: string;
  day: string;
  isRest: true;
};

type DayEntry = TrainingEntry | RestEntry;

const STORAGE_KEY_PREFIX = 'trainingsplan_selected_v1';

function getWeekStorageKey(userId: string): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
  const week = String(weekNo).padStart(2, '0');
  return `${STORAGE_KEY_PREFIX}:${userId}:${date.getUTCFullYear()}-W${week}`;
}

// ─── Dummy data ───────────────────────────────────────────────────────────────

const WEEK_PLAN: DayEntry[] = [
  { id: 'mo', day: 'Montag',     isRest: false, title: 'K1 Technik',      duration: '90 Min', coach: 'Coach Mehmet', isConditioning: false },
  { id: 'di', day: 'Dienstag',   isRest: false, title: 'Boxen Sparring',   duration: '75 Min', coach: 'Coach Alex',   isConditioning: false },
  { id: 'mi', day: 'Mittwoch',   isRest: false, title: 'BJJ Grundlagen',   duration: '60 Min', coach: 'Coach Sara',   isConditioning: false },
  { id: 'do', day: 'Donnerstag', isRest: true },
  { id: 'fr', day: 'Freitag',    isRest: false, title: 'MMA Technik',      duration: '90 Min', coach: 'Coach Mehmet', isConditioning: false },
  { id: 'sa', day: 'Samstag',    isRest: false, title: 'Kraft & Ausdauer', duration: '60 Min', coach: 'Coach Alex',   isConditioning: true  },
  { id: 'so', day: 'Sonntag',    isRest: true },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function TrainingsplanTab() {
  const { user } = useAuth();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const [flashId, setFlashId] = useState<string | null>(null);
  const [flashPts, setFlashPts] = useState(0);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (flashTimer.current !== null) {
        clearTimeout(flashTimer.current);
      }
    };
  }, []);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    setIsHydrated(false);

    async function loadSelected(): Promise<void> {
      if (user === null) {
        if (mounted) {
          setSelected(new Set());
          setIsHydrated(true);
        }
        return;
      }

      try {
        const raw = await AsyncStorage.getItem(getWeekStorageKey(user.id));
        const parsed: string[] = raw === null ? [] : (JSON.parse(raw) as string[]);
        if (mounted) {
          setSelected(new Set(parsed));
        }
      } catch {
        if (mounted) {
          setSelected(new Set());
        }
      } finally {
        if (mounted) {
          setIsHydrated(true);
        }
      }
    }

    void loadSelected();
    return () => {
      mounted = false;
    };
  }, [user]));

  async function persistSelected(next: Set<string>): Promise<void> {
    if (user === null) return;
    await AsyncStorage.setItem(getWeekStorageKey(user.id), JSON.stringify(Array.from(next)));
  }

  function participateInSession(id: string, duration: string): void {
    if (selected.has(id) || !isHydrated) {
      return;
    }

    const nextSelected = new Set(selected);
    nextSelected.add(id);
    setSelected(nextSelected);
    void persistSelected(nextSelected);

    // Calculate and briefly show earned points
    const mins = parseInt(duration, 10);
    const pts = Math.floor(mins / 30) * 35;
    setFlashPts(pts);
    setFlashId(id);
    if (flashTimer.current !== null) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlashId(null), 1500);

    // Persist to DB so the home screen stats reflect the session
    if (user !== null) {
      supabase
        .rpc('add_workout_points', { p_user_id: user.id, p_date: todayIso(), p_points: pts })
        .then(() => undefined);
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {WEEK_PLAN.map((entry) =>
        entry.isRest ? (
          // Rest day — simple row, no card
          <View key={entry.id} style={styles.restRow}>
            <Text style={styles.restDayName}>{entry.day}</Text>
            <Text style={styles.restLabel}>Ruhetag</Text>
          </View>
        ) : (
          // Training day — full card
          <View key={entry.id} style={styles.card}>
            <Text style={styles.cardDayName}>{entry.day}</Text>
            <View style={styles.cardBody}>
              <View style={styles.cardInfo}>
                <Text style={styles.cardTitle}>{entry.title}</Text>
                {entry.isConditioning && (
                  <View style={styles.conditioningTag}>
                    <Text style={styles.conditioningTagText}>Kondition</Text>
                  </View>
                )}
                <Text style={styles.cardMeta}>
                  {entry.duration} · {entry.coach}
                </Text>
              </View>

              <View style={styles.buttonWrap}>
                <TouchableOpacity
                  style={[
                    styles.button,
                    selected.has(entry.id) && styles.buttonSelected,
                    !isHydrated && styles.buttonDisabled,
                  ]}
                  onPress={() => participateInSession(entry.id, entry.duration)}
                  disabled={selected.has(entry.id) || !isHydrated}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.buttonLabel,
                      selected.has(entry.id) && styles.buttonLabelSelected,
                      !isHydrated && styles.buttonLabelDisabled,
                    ]}
                  >
                    {selected.has(entry.id) ? 'Zugesagt' : isHydrated ? 'Teilnehmen' : 'Laden...'}
                  </Text>
                </TouchableOpacity>
                {flashId === entry.id && (
                  <Text style={styles.flashText}>+{flashPts} Pts</Text>
                )}
              </View>
            </View>
          </View>
        )
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 32,
    gap: 12,
  },

  // Rest day row
  restRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  restDayName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inactive,
  },
  restLabel: {
    fontSize: 13,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Training card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      ios: {
        shadowColor: colors.headerBg,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
      },
      android: { elevation: 2 },
    }),
  },
  cardDayName: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inactive,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 8,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardInfo: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  cardMeta: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '400',
  },

  // Conditioning badge (Samstag only)
  conditioningTag: {
    alignSelf: 'flex-start',
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.accentBlue,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  conditioningTagText: {
    fontSize: 10,
    fontWeight: '600',
    color: colors.accentBlue,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },

  // Participation button + flash
  buttonWrap: {
    alignItems: 'center',
    gap: 4,
  },
  flashText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  button: {
    borderWidth: 1.5,
    borderColor: colors.headerBg,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  buttonSelected: {
    backgroundColor: colors.headerBg,
    borderColor: colors.headerBg,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerBg,
  },
  buttonLabelDisabled: {
    color: colors.inactive,
  },
  buttonLabelSelected: {
    color: '#FFFFFF',
  },
});
