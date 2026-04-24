import React, { useRef, useState } from 'react';
import {
  Alert,
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Schlagkraft',
  'Trittkraft',
  'Ausdauer',
  'Schulter',
  'Beinarbeit',
  'Koordination',
  'Mobilität',
  'Partnertraining',
] as const;

type Category = (typeof CATEGORIES)[number];
type Intensity = 'leicht' | 'mittel' | 'intensiv';

const INTENSITY_FACTOR: Record<Intensity, number> = {
  leicht: 15,
  mittel: 25,
  intensiv: 35,
};

const INTENSITY_LABEL: Record<Intensity, string> = {
  leicht: 'Leicht',
  mittel: 'Mittel',
  intensiv: 'Intensiv',
};

const MAX_MIN = 59;
const MAX_SEC = 59;
const MAX_ROUNDS = 30;
const BONUS_POINTS_MAX_ROUNDS = 5;

// Minimum rounds required to reach an intensity tier.
// Below the threshold the intensity is capped at the tier below.
const MIN_ROUNDS_MITTEL = 9;
const MIN_ROUNDS_INTENSIV = 18;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseAndClamp(text: string, max: number): string {
  const digits = text.replace(/[^0-9]/g, '');
  if (digits === '') return '';
  const n = parseInt(digits, 10);
  if (isNaN(n)) return '';
  return String(Math.min(n, max));
}

// Total seconds from separate min/sec string inputs (NaN-safe, defaults to 0)
function toSec(minInput: string, secInput: string): number {
  const m = parseInt(minInput, 10);
  const s = parseInt(secInput, 10);
  return (isNaN(m) ? 0 : m) * 60 + (isNaN(s) ? 0 : s);
}

function formatDuration(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  if (s === 0) return `${m} Min`;
  return `${m} Min ${s} Sek`;
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

// ─── Calculation ──────────────────────────────────────────────────────────────

type CalcResult = {
  intensity: Intensity;
  points: number;
  totalSec: number;
};

function calcWorkout(rounds: number, roundSec: number, pauseSec: number): CalcResult | null {
  if (rounds <= 0 || roundSec <= 0 || pauseSec <= 0) return null;
  const totalSec = rounds * (roundSec + pauseSec);
  const workRatio = roundSec / (roundSec + pauseSec);

  // Ratio determines the ceiling; round count can only pull the level down.
  let intensity: Intensity =
    workRatio < 0.6 ? 'leicht' : workRatio <= 0.75 ? 'mittel' : 'intensiv';
  if (intensity === 'intensiv' && rounds < MIN_ROUNDS_INTENSIV) intensity = 'mittel';
  if (intensity === 'mittel'   && rounds < MIN_ROUNDS_MITTEL)   intensity = 'leicht';

  const realWorkMin = (rounds * roundSec) / 60;
  const base = Math.max(1, Math.floor(realWorkMin / 30)) * INTENSITY_FACTOR[intensity];
  const bonus = rounds >= MAX_ROUNDS ? BONUS_POINTS_MAX_ROUNDS : 0;
  const points = base + bonus;
  return { intensity, points, totalSec };
}

function intensityBadgeStyle(intensity: Intensity) {
  if (intensity === 'leicht') return styles.badgeLeicht;
  if (intensity === 'mittel') return styles.badgeMittel;
  return styles.badgeIntensiv;
}

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function WorkoutStartSheet({ visible, onClose }: Props) {
  const { user } = useAuth();

  const [selectedCat, setSelectedCat] = useState<Category | null>(null);
  const [roundMinInput, setRoundMinInput] = useState('');
  const [roundSecInput, setRoundSecInput] = useState('');
  const [pauseMinInput, setPauseMinInput] = useState('');
  const [pauseSecInput, setPauseSecInput] = useState('');
  const [roundsInput, setRoundsInput] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Refs for auto-advancing focus Min → Sek
  const roundSecRef = useRef<TextInput>(null);
  const pauseSecRef = useRef<TextInput>(null);

  const roundSec = toSec(roundMinInput, roundSecInput);
  const pauseSec = toSec(pauseMinInput, pauseSecInput);
  const rounds = parseInt(roundsInput, 10) || 0;

  const result: CalcResult | null = calcWorkout(rounds, roundSec, pauseSec);
  const canConfirm = selectedCat !== null && result !== null && !submitting;

  async function handleConfirm(): Promise<void> {
    if (!canConfirm || result === null || selectedCat === null || user === null) return;
    setSubmitting(true);

    const today = todayIso();
    const durationMin = Math.round(result.totalSec / 60);

    const { error: logErr } = await supabase.from('workout_logs').insert({
      user_id: user.id,
      date: today,
      source: 'extra',
      completed: true,
      points: result.points,
      title: selectedCat,
      category: selectedCat,
      duration_min: durationMin,
      training_type: result.intensity,
    });

    if (logErr !== null) {
      setSubmitting(false);
      Alert.alert('Fehler', 'Bitte versuche es erneut.');
      return;
    }

    const { error: pointsErr } = await supabase.rpc('add_workout_points', {
      p_user_id: user.id,
      p_date: today,
      p_points: result.points,
    });
    if (pointsErr !== null) console.warn('add_workout_points failed', pointsErr.message);

    setSubmitting(false);
    handleClose();
  }

  function handleClose(): void {
    setSelectedCat(null);
    setRoundMinInput('');
    setRoundSecInput('');
    setPauseMinInput('');
    setPauseSecInput('');
    setRoundsInput('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={handleClose} />

        <View style={styles.sheet}>

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Workout starten</Text>
            <TouchableOpacity onPress={handleClose} activeOpacity={0.7}>
              <Text style={styles.closeLabel}>Schließen</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.scrollContent}
          >

            {/* ── Category grid ── */}
            <Text style={styles.sectionLabel}>Kategorie</Text>
            <View style={styles.categoryGrid}>
              {CATEGORIES.map((cat) => {
                const active = selectedCat === cat;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryCard, active && styles.categoryCardActive]}
                    onPress={() => setSelectedCat(cat)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.categoryCardLabel, active && styles.categoryCardLabelActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* ── Value cards ── */}
            <View style={styles.valueRow}>

              {/* Rundendauer MM:SS */}
              <View style={styles.valueCard}>
                <View style={styles.durationRow}>
                  <TextInput
                    style={styles.durationInput}
                    value={roundMinInput}
                    onChangeText={(t) => {
                      const v = parseAndClamp(t, MAX_MIN);
                      setRoundMinInput(v);
                      if (v.length >= 2) roundSecRef.current?.focus();
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.headerTextSecondary}
                    maxLength={2}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.accentBlue}
                  />
                  <Text style={styles.durationSep}>:</Text>
                  <TextInput
                    ref={roundSecRef}
                    style={styles.durationInput}
                    value={roundSecInput}
                    onChangeText={(t) => setRoundSecInput(parseAndClamp(t, MAX_SEC))}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor={colors.headerTextSecondary}
                    maxLength={2}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.accentBlue}
                  />
                </View>
                <Text style={styles.valueLabel}>Runde</Text>
              </View>

              {/* Pausendauer MM:SS */}
              <View style={styles.valueCard}>
                <View style={styles.durationRow}>
                  <TextInput
                    style={styles.durationInput}
                    value={pauseMinInput}
                    onChangeText={(t) => {
                      const v = parseAndClamp(t, MAX_MIN);
                      setPauseMinInput(v);
                      if (v.length >= 2) pauseSecRef.current?.focus();
                    }}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.headerTextSecondary}
                    maxLength={2}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.accentBlue}
                  />
                  <Text style={styles.durationSep}>:</Text>
                  <TextInput
                    ref={pauseSecRef}
                    style={styles.durationInput}
                    value={pauseSecInput}
                    onChangeText={(t) => setPauseSecInput(parseAndClamp(t, MAX_SEC))}
                    keyboardType="numeric"
                    placeholder="00"
                    placeholderTextColor={colors.headerTextSecondary}
                    maxLength={2}
                    underlineColorAndroid="transparent"
                    selectionColor={colors.accentBlue}
                  />
                </View>
                <Text style={styles.valueLabel}>Pause</Text>
              </View>

              {/* Rundenanzahl */}
              <View style={styles.valueCard}>
                <TextInput
                  style={styles.valueInput}
                  value={roundsInput}
                  onChangeText={(t) => setRoundsInput(parseAndClamp(t, MAX_ROUNDS))}
                  keyboardType="numeric"
                  placeholder="–"
                  placeholderTextColor={colors.headerTextSecondary}
                  maxLength={2}
                  underlineColorAndroid="transparent"
                  selectionColor={colors.accentBlue}
                />
                <Text style={styles.valueLabel}>Runden</Text>
              </View>

            </View>

            {/* ── Live preview ── */}
            <View style={styles.previewBlock}>
              {result !== null ? (
                <View style={styles.previewContent}>
                  <View style={[styles.intensityBadge, intensityBadgeStyle(result.intensity)]}>
                    <Text style={styles.intensityBadgeText}>
                      {INTENSITY_LABEL[result.intensity]}
                    </Text>
                  </View>
                  <Text style={styles.previewPoints}>+{result.points}</Text>
                  <Text style={styles.previewPointsLabel}>Punkte</Text>
                  <Text style={styles.previewDuration}>
                    {formatDuration(result.totalSec)} Gesamtdauer
                  </Text>
                </View>
              ) : (
                <Text style={styles.previewHint}>
                  Wähle eine Kategorie und füll alle Felder aus
                </Text>
              )}
            </View>

          </ScrollView>

          {/* ── Confirm button (fixed) ── */}
          <TouchableOpacity
            style={[styles.confirmBtn, !canConfirm && styles.confirmBtnDisabled]}
            onPress={() => { void handleConfirm(); }}
            activeOpacity={0.8}
            disabled={!canConfirm}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={colors.headerTextPrimary} />
            ) : (
              <Text style={styles.confirmLabel}>Bestätigen</Text>
            )}
          </TouchableOpacity>

        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    backgroundColor: colors.dark,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '92%',
    paddingBottom: 40,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
  closeLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.headerTextSecondary,
  },

  // Scroll area
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 24,
  },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.headerTextSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: -16,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  categoryCard: {
    width: '48.5%',
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.headerBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryCardActive: {
    backgroundColor: colors.accentBlue,
  },
  categoryCardLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
  categoryCardLabelActive: {
    color: colors.headerTextPrimary,
  },

  // Value cards row
  valueRow: {
    flexDirection: 'row',
    gap: 8,
  },
  valueCard: {
    flex: 1,
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    paddingVertical: 16,
    alignItems: 'center',
    gap: 4,
  },

  // MM:SS duration pair inside a card
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    height: 56,
  },
  durationInput: {
    flex: 1,
    fontSize: 28,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 0,
    height: 56,
  },
  durationSep: {
    fontSize: 24,
    fontWeight: '300',
    color: colors.headerTextSecondary,
    textAlign: 'center',
    width: 16,
  },

  // Single large input (Rundenanzahl)
  valueInput: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    textAlign: 'center',
    backgroundColor: 'transparent',
    padding: 0,
    width: '100%',
    height: 56,
  },

  valueLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.headerTextSecondary,
  },

  // Live preview
  previewBlock: {
    backgroundColor: colors.headerCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.headerBorder,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
  },
  previewContent: {
    alignItems: 'center',
    gap: 8,
  },
  intensityBadge: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 8,
  },
  badgeLeicht: {
    backgroundColor: colors.difficultyGreen,
  },
  badgeMittel: {
    backgroundColor: colors.catTrittkraft,
  },
  badgeIntensiv: {
    backgroundColor: colors.deleteRed,
  },
  intensityBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.headerTextPrimary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  previewPoints: {
    fontSize: 64,
    fontWeight: '800',
    color: colors.headerTextPrimary,
    lineHeight: 72,
  },
  previewPointsLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.headerTextSecondary,
    marginTop: -8,
  },
  previewDuration: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.headerTextSecondary,
    marginTop: 8,
  },
  previewHint: {
    fontSize: 14,
    color: colors.headerTextSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Confirm button
  confirmBtn: {
    marginHorizontal: 24,
    height: 56,
    borderRadius: 14,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnDisabled: {
    backgroundColor: colors.headerBorder,
  },
  confirmLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.headerTextPrimary,
  },
});
