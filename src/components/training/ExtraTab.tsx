import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import ExtraUnitCard from './ExtraUnitCard';
import StepsInputModal, { stepsToPoints } from './StepsInputModal';


// ─── Types ────────────────────────────────────────────────────────────────────

export type ExtraUnit = {
  id: string;
  title: string;
  category: string;
  intensity: 'leicht' | 'mittel' | 'intensiv';
  points: number;
  durationLabel: string;
  training_type?: string;
  isSteps?: boolean;
  subcategories?: { training_type: string; points: number }[];
};

// ─── Static data ──────────────────────────────────────────────────────────────

const EXTRA_UNITS: ExtraUnit[] = [
  { id: 'joggen',       title: 'Joggen',       category: 'Kondition', intensity: 'mittel',   points: 10, durationLabel: '30–60 Min', training_type: 'ausdauer' },
  { id: 'schwimmen',    title: 'Schwimmen',    category: 'Kondition', intensity: 'mittel',   points: 10, durationLabel: '45 Min',    training_type: 'ausdauer' },
  { id: 'seilspringen', title: 'Seilspringen', category: 'Kondition', intensity: 'intensiv', points: 10, durationLabel: '15–30 Min', training_type: 'ausdauer' },
  { id: 'radfahren',    title: 'Rad Fahren',   category: 'Kondition', intensity: 'leicht',   points: 10, durationLabel: '45–60 Min', training_type: 'ausdauer' },
  { id: 'schritte',     title: 'Schritte',     category: 'Kondition', intensity: 'leicht',   points: 0,  durationLabel: 'Tagesziel', isSteps: true },
  { id: 'gym',          title: 'Gym',          category: 'Kraft',     intensity: 'intensiv', points: 15, durationLabel: '60 Min'    },
  {
    id: 'stairruns',
    title: 'Stairruns',
    category: 'Kondition',
    intensity: 'intensiv',
    points: 10,
    durationLabel: '20–30 Min',
    subcategories: [
      { training_type: 'beinarbeit',   points: 2 },
      { training_type: 'trittkraft',   points: 2 },
      { training_type: 'koordination', points: 2 },
      { training_type: 'ausdauer',     points: 4 },
    ],
  },
];

const CATEGORIES = ['Kondition', 'Kraft'];


// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// Returns ISO date strings for Mon–Sun of the current week
function currentWeekDates(): string[] {
  const now = new Date();
  // JS: 0=Sun … 6=Sat → convert to Mon=0 … Sun=6
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dow);

  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ExtraTab() {
  const { user } = useAuth();
  const suggestionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekDates = useMemo(() => currentWeekDates(), []);
  const today = useMemo(() => todayIso(), []);

  // Set of titles logged today
  const [loggedToday, setLoggedToday] = useState<Set<string>>(new Set());
  // Map title → Set of dates logged this week
  const [weekMap, setWeekMap] = useState<Map<string, Set<string>>>(new Map());
  const [loadingLog, setLoadingLog] = useState(false);
  const [loadingUnit, setLoadingUnit] = useState<string | null>(null);

  // Steps modal
  const [stepsModalVisible, setStepsModalVisible] = useState(false);

  // Suggestion modal
  const [suggestionVisible, setSuggestionVisible] = useState(false);
  const [suggestionText, setSuggestionText] = useState('');
  const [suggestionSending, setSuggestionSending] = useState(false);
  const [suggestionSent, setSuggestionSent] = useState(false);

  // ── Load this week's extra logs ───────────────────────────────────────────

  const loadLogs = useCallback(async () => {
    if (user === null) return;
    setLoadingLog(true);

    const { data, error: loadErr } = await supabase
      .from('workout_logs')
      .select('title, date')
      .eq('user_id', user.id)
      .eq('source', 'extra')
      .gte('date', weekDates[0])
      .lte('date', weekDates[6]);

    if (loadErr !== null) console.warn('loadLogs failed', loadErr.message);

    if (data !== null) {
      const todaySet = new Set<string>();
      const wMap = new Map<string, Set<string>>();

      for (const row of data) {
        const title = row.title ?? '';
        if (row.date === today) todaySet.add(title);
        if (!wMap.has(title)) wMap.set(title, new Set());
        wMap.get(title)?.add(row.date);
      }

      setLoggedToday(todaySet);
      setWeekMap(wMap);
    }

    setLoadingLog(false);
  }, [user, today, weekDates[0], weekDates[6]]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  // ── Log a regular extra unit ──────────────────────────────────────────────

  async function logUnit(unit: ExtraUnit, steps?: number): Promise<void> {
    if (user === null || loadingUnit !== null) return;
    setLoadingUnit(unit.id);

    const points = unit.isSteps ? (steps !== undefined ? stepsToPoints(steps) : 0) : unit.points;

    if (unit.subcategories !== undefined) {
      const rows = unit.subcategories.map((sub) => ({
        user_id: user.id,
        date: today,
        source: 'extra' as const,
        completed: true,
        points: sub.points,
        title: unit.title,
        category: 'Extra',
        training_type: sub.training_type,
        duration_min: 0,
      }));
      const { error: logErr } = await supabase.from('workout_logs').insert(rows);
      if (logErr !== null) {
        setLoadingUnit(null);
        Alert.alert('Fehler', 'Bitte versuche es erneut.');
        return;
      }
    } else {
      const { error: logErr } = await supabase.from('workout_logs').insert({
        user_id: user.id,
        date: today,
        source: 'extra',
        completed: true,
        points,
        title: unit.title,
        category: 'Extra',
        duration_min: 0,
        training_type: unit.training_type ?? null,
      });
      if (logErr !== null) {
        setLoadingUnit(null);
        Alert.alert('Fehler', 'Bitte versuche es erneut.');
        return;
      }
    }

    const { error: pointsErr } = await supabase.rpc('add_workout_points', {
      p_user_id: user.id,
      p_date: today,
      p_points: points,
    });
    if (pointsErr !== null) console.warn('add_workout_points failed', pointsErr.message);

    await loadLogs();
    setLoadingUnit(null);
  }

  // ── Steps modal confirm ───────────────────────────────────────────────────

  function handleStepsConfirm(steps: number, points: number): void {
    setStepsModalVisible(false);
    const stepsUnit = EXTRA_UNITS.find((u) => u.isSteps);
    if (stepsUnit === undefined) return;
    void logUnit(stepsUnit, steps);
  }

  // ── Submit suggestion ─────────────────────────────────────────────────────

  async function submitSuggestion(): Promise<void> {
    if (user === null || suggestionText.trim().length === 0) return;
    setSuggestionSending(true);

    const { error: suggErr } = await supabase.from('extra_suggestions').insert({
      user_id: user.id,
      suggestion: suggestionText.trim(),
    });

    if (suggErr !== null) {
      setSuggestionSending(false);
      Alert.alert('Fehler', 'Bitte versuche es erneut.');
      return;
    }

    setSuggestionSending(false);
    setSuggestionSent(true);
    setSuggestionText('');

    suggestionTimerRef.current = setTimeout(() => {
      setSuggestionVisible(false);
      setSuggestionSent(false);
    }, 1500);
  }

  // ── Week dots for a unit ──────────────────────────────────────────────────

  function weekDotsForUnit(unit: ExtraUnit): boolean[] {
    const datesLogged = weekMap.get(unit.title) ?? new Set<string>();
    return weekDates.map((d) => datesLogged.has(d));
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (loadingLog) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {CATEGORIES.map((cat) => {
        const units = EXTRA_UNITS.filter((u) => u.category === cat);
        return (
          <View key={cat} style={styles.categoryBlock}>
            <Text style={styles.categoryLabel}>{cat}</Text>
            <View style={styles.unitList}>
              {units.map((unit) => (
                <ExtraUnitCard
                  key={unit.id}
                  unit={unit}
                  doneToday={loggedToday.has(unit.title)}
                  weekDots={weekDotsForUnit(unit)}
                  loading={loadingUnit === unit.id}
                  onLog={() => {
                    if (unit.isSteps) {
                      setStepsModalVisible(true);
                    } else {
                      void logUnit(unit);
                    }
                  }}
                />
              ))}
            </View>
          </View>
        );
      })}

      {/* ── Suggestion button ── */}
      <TouchableOpacity
        style={styles.suggestionBtn}
        onPress={() => setSuggestionVisible(true)}
        activeOpacity={0.7}
      >
        <Text style={styles.suggestionBtnLabel}>Einheit vorschlagen</Text>
      </TouchableOpacity>

      {/* ── Steps Modal ── */}
      <StepsInputModal
        visible={stepsModalVisible}
        onClose={() => setStepsModalVisible(false)}
        onConfirm={handleStepsConfirm}
      />

      {/* ── Suggestion Modal ── */}
      <Modal
        visible={suggestionVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { if (suggestionTimerRef.current !== null) clearTimeout(suggestionTimerRef.current); setSuggestionVisible(false); }}
      >
        <KeyboardAvoidingView
          style={styles.overlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={() => { if (suggestionTimerRef.current !== null) clearTimeout(suggestionTimerRef.current); setSuggestionVisible(false); }}
          />
          <View style={styles.sheet}>
            {suggestionSent ? (
              <Text style={styles.sentText}>Danke für deinen Vorschlag!</Text>
            ) : (
              <>
                <Text style={styles.sheetTitle}>Einheit vorschlagen</Text>
                <Text style={styles.sheetSubtitle}>
                  Welche Aktivität fehlt dir? Wir lesen jeden Vorschlag.
                </Text>
                <TextInput
                  style={styles.suggestionInput}
                  value={suggestionText}
                  onChangeText={setSuggestionText}
                  placeholder="z. B. Klettern, Yoga, Kampfsport..."
                  placeholderTextColor={colors.textSecondary}
                  maxLength={80}
                  autoFocus
                />
                <View style={styles.sheetButtons}>
                  <TouchableOpacity
                    style={styles.cancelBtn}
                    onPress={() => { if (suggestionTimerRef.current !== null) clearTimeout(suggestionTimerRef.current); setSuggestionVisible(false); setSuggestionText(''); }}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelLabel}>Abbrechen</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (suggestionText.trim().length === 0 || suggestionSending) && styles.sendBtnDisabled,
                    ]}
                    onPress={() => { void submitSuggestion(); }}
                    disabled={suggestionText.trim().length === 0 || suggestionSending}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.sendLabel}>
                      {suggestionSending ? 'Senden...' : 'Senden'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    gap: 24,
  },
  loader: {
    paddingVertical: 32,
    alignItems: 'center',
  },
  categoryBlock: {
    gap: 10,
  },
  categoryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    paddingHorizontal: 16,
  },
  unitList: {
    paddingHorizontal: 16,
    gap: 10,
  },
  suggestionBtn: {
    marginHorizontal: 16,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    borderStyle: 'dashed',
  },
  suggestionBtnLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  // Modals
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  sheetSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  suggestionInput: {
    backgroundColor: colors.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: colors.textPrimary,
    marginTop: 4,
  },
  sheetButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  sendBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: colors.border,
  },
  sendLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  sentText: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
    paddingVertical: 16,
  },

  // Kampfsport grid
  kampfsportGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'space-between',
    rowGap: 8,
  },
  kampfsportTile: {
    width: '48.5%',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderLeftWidth: 4,
    minHeight: 56,
    justifyContent: 'center',
  },
  kampfsportTileLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  kampfsportTileLabelDone: {
    color: colors.textSecondary,
  },
  kampfsportDoneTag: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 4,
  },
});
