import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  TextInput, Platform,
} from 'react-native';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { colors } from '../../theme/colors';
import type { NutritionPlan, PlanMode } from '../../utils/nutritionEngine';

const MIN_WEEKS_FROM_NOW = 4;

type GoalType = 'maintain' | 'target';

interface WeightGoalCoachCardProps {
  targetWeightKg:     number | null;
  targetDateIso:      string | null;
  recommendedDateIso: string | null;
  plans:              NutritionPlan[];
  selectedMode:       PlanMode;
  onSelectMode:       (mode: PlanMode) => void;
  onPlanSelected:     (mode: PlanMode) => void; // fires when user confirms a plan tab
  collapsed:          boolean;
  onExpand:           () => void;
  isSaving:           boolean;
  onSaveTarget:       (kg: number, targetDateIso: string | null) => void;
  onClearTarget:      () => void;
  isMaintainActive:   boolean;
  onMaintain:         () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00`);
}

function toIsoDate(value: Date): string {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatDateLabel(value: string): string {
  return parseIsoDate(value).toLocaleDateString('de-DE', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function minAllowedDate(): Date {
  return new Date(Date.now() + MIN_WEEKS_FROM_NOW * 7 * 86_400_000);
}

// ─── Plan tab sub-component ───────────────────────────────────────────────────

interface PlanTabProps {
  plan:     NutritionPlan;
  selected: boolean;
  onPress:  () => void;
}

function PlanTab({ plan, selected, onPress }: PlanTabProps) {
  const weeksLabel =
    plan.estimatedTimeToGoalWeeks !== null
      ? `ca. ${plan.estimatedTimeToGoalWeeks} Wochen`
      : null;

  return (
    <TouchableOpacity
      style={[styles.planTab, selected && styles.planTabSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={[styles.planTabLabel, selected && styles.planTabLabelSelected]}>
        {plan.label}
      </Text>
      <Text style={[styles.planTabKcal, selected && styles.planTabKcalSelected]}>
        {plan.kcalPerDay} kcal
      </Text>
      {weeksLabel !== null && (
        <Text style={[styles.planTabWeeks, selected && styles.planTabWeeksSelected]}>
          {weeksLabel}
        </Text>
      )}
      {plan.riskLevel === 'high' && (
        <View style={styles.riskBadge}>
          <Text style={styles.riskBadgeText}>Risiko</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

// ─── Main card ────────────────────────────────────────────────────────────────

export default function WeightGoalCoachCard({
  targetWeightKg,
  targetDateIso,
  recommendedDateIso,
  plans,
  selectedMode,
  onSelectMode,
  onPlanSelected,
  collapsed,
  onExpand,
  isSaving,
  onSaveTarget,
  onClearTarget,
  isMaintainActive,
  onMaintain,
}: WeightGoalCoachCardProps) {
  const [draft,           setDraft]           = useState(targetWeightKg !== null ? String(targetWeightKg) : '');
  const [selectedDateIso, setSelectedDateIso] = useState<string | null>(targetDateIso ?? recommendedDateIso);
  const [showDatePicker,  setShowDatePicker]  = useState(false);
  const [goalType,        setGoalType]        = useState<GoalType>(
    isMaintainActive && targetWeightKg === null ? 'maintain' : 'target',
  );

  useEffect(() => {
    setDraft(targetWeightKg !== null ? String(targetWeightKg) : '');
  }, [targetWeightKg]);

  useEffect(() => {
    setSelectedDateIso(targetDateIso ?? recommendedDateIso);
  }, [targetDateIso, recommendedDateIso]);

  useEffect(() => {
    setGoalType(isMaintainActive && targetWeightKg === null ? 'maintain' : 'target');
  }, [isMaintainActive, targetWeightKg]);

  const parsedDraft = useMemo(() => {
    const v = parseFloat(draft.replace(',', '.'));
    return Number.isFinite(v) && v >= 35 && v <= 220 ? v : null;
  }, [draft]);

  const canSave = parsedDraft !== null && !isSaving;

  const pickerDate = selectedDateIso !== null
    ? parseIsoDate(selectedDateIso)
    : minAllowedDate();

  function handleDateChange(event: DateTimePickerEvent, date?: Date): void {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (event.type !== 'set' || date === undefined) return;
    setSelectedDateIso(toIsoDate(date));
  }

  const activePlan    = plans.find(p => p.mode === selectedMode) ?? null;
  const activeWarning = activePlan?.warningText ?? null;

  // ── Collapsed view ────────────────────────────────────────────────────────
  if (collapsed && (targetWeightKg !== null || isMaintainActive)) {
    let collapsedValue: string;
    if (isMaintainActive && targetWeightKg === null) {
      collapsedValue = 'Gewicht halten';
    } else {
      const planLabel = activePlan?.label ?? 'Empfohlen';
      const dateLabel = targetDateIso !== null ? formatDateLabel(targetDateIso) : '';
      collapsedValue = `${planLabel} · ${String(targetWeightKg).replace('.', ',')} kg${dateLabel.length > 0 ? ` · ${dateLabel}` : ''}`;
    }
    return (
      <View style={styles.collapsedCard}>
        <View style={styles.collapsedLeft}>
          <Text style={styles.collapsedLabel}>Aktives Ziel</Text>
          <Text style={styles.collapsedValue} numberOfLines={1}>{collapsedValue}</Text>
        </View>
        <TouchableOpacity onPress={onExpand} activeOpacity={0.8}>
          <Text style={styles.expandText}>Ändern</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Full view ─────────────────────────────────────────────────────────────
  return (
    <View style={styles.card}>
      <Text style={styles.title}>Mein Ziel</Text>

      {/* Goal type segment selector */}
      <View style={styles.segmentRow}>
        <TouchableOpacity
          style={[styles.segmentBtn, goalType === 'maintain' && styles.segmentBtnActive]}
          onPress={() => { setGoalType('maintain'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentLabel, goalType === 'maintain' && styles.segmentLabelActive]}>
            Gewicht halten
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segmentBtn, goalType === 'target' && styles.segmentBtnActive]}
          onPress={() => { setGoalType('target'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.segmentLabel, goalType === 'target' && styles.segmentLabelActive]}>
            Zielgewicht
          </Text>
        </TouchableOpacity>
      </View>

      {goalType === 'maintain' ? (
        /* Maintain confirmation */
        <View style={styles.editor}>
          <Text style={styles.maintainHint}>
            Du möchtest dein aktuelles Gewicht halten. Dein Ernährungsplan wird auf deinen Erhaltungsbedarf ausgerichtet.
          </Text>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={onMaintain}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>Bestätigen</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Saved goal compact row */}
          {targetWeightKg !== null && targetDateIso !== null && (
            <View style={styles.savedRow}>
              <Text style={styles.savedText}>
                {String(targetWeightKg).replace('.', ',')} kg{' '}
                · {formatDateLabel(targetDateIso)}
              </Text>
              <TouchableOpacity onPress={onClearTarget} activeOpacity={0.8}>
                <Text style={styles.clearText}>Zurücksetzen</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Weight + date editor */}
          <View style={styles.editor}>
            <TextInput
              style={[styles.input, parsedDraft === null && draft.length > 0 && styles.inputError]}
              value={draft}
              onChangeText={setDraft}
              placeholder="Zielgewicht in kg"
              placeholderTextColor={colors.inactive}
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.dateButtonText}>
                {selectedDateIso !== null ? formatDateLabel(selectedDateIso) : 'Datum auswählen'}
              </Text>
              {selectedDateIso !== null &&
               recommendedDateIso !== null &&
               selectedDateIso === recommendedDateIso && (
                <Text style={styles.recommendedBadge}>Empfohlen</Text>
              )}
            </TouchableOpacity>

            {recommendedDateIso !== null && selectedDateIso !== recommendedDateIso && (
              <Text style={styles.hintText}>
                Empfohlen: {formatDateLabel(recommendedDateIso)}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.saveButton, !canSave && styles.buttonDisabled]}
              onPress={() => { if (parsedDraft !== null) onSaveTarget(parsedDraft, selectedDateIso); }}
              disabled={!canSave}
              activeOpacity={0.85}
            >
              <Text style={styles.saveButtonText}>{isSaving ? '...' : 'Speichern'}</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* Plan tabs — only shown when a target weight is set */}
      {goalType === 'target' && plans.length > 1 && (
        <View style={styles.plansSection}>
          <Text style={styles.plansSectionTitle}>Option wählen</Text>
          <View style={styles.planTabsRow}>
            {plans.map(p => (
              <PlanTab
                key={p.mode}
                plan={p}
                selected={p.mode === selectedMode}
                onPress={() => {
                  onSelectMode(p.mode);
                  onPlanSelected(p.mode);
                }}
              />
            ))}
          </View>
          {activeWarning !== null && (
            <Text style={styles.warningText}>{activeWarning}</Text>
          )}
        </View>
      )}

      {goalType === 'target' && showDatePicker && (
        <DateTimePicker
          value={pickerDate}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'default'}
          minimumDate={minAllowedDate()}
          onChange={handleDateChange}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 16,
  },
  segmentRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
  },
  segmentBtnActive: {
    backgroundColor: colors.accentBlueSoft,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
  },
  segmentLabelActive: {
    color: colors.accentBlue,
  },
  maintainHint: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
    lineHeight: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  savedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.accentBlueSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  savedText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  clearText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.inactive,
  },
  editor: {
    gap: 12,
  },
  input: {
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontSize: 14,
    color: colors.text,
    backgroundColor: colors.card,
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  dateButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
    backgroundColor: colors.accentBlueSoft,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  recommendedBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.accentBlue,
    textTransform: 'uppercase',
  },
  hintText: {
    fontSize: 12,
    color: colors.inactive,
    fontWeight: '500',
  },
  saveButton: {
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accentBlue,
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  // Plan tabs section
  plansSection: {
    gap: 12,
  },
  plansSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
  },
  planTabsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  planTab: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 4,
    alignItems: 'center',
  },
  planTabSelected: {
    backgroundColor: colors.accentBlueSoft,
    borderColor: colors.accentBlueMuted,
  },
  planTabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inactive,
    textAlign: 'center',
  },
  planTabLabelSelected: {
    color: colors.accentBlue,
  },
  planTabKcal: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  planTabKcalSelected: {
    color: colors.text,
  },
  planTabWeeks: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.inactive,
    textAlign: 'center',
  },
  planTabWeeksSelected: {
    color: colors.textSecondary,
  },
  riskBadge: {
    marginTop: 4,
    backgroundColor: colors.deleteRed,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  riskBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.card,
  },
  warningText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.deleteRed,
  },
  // Collapsed state
  collapsedCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapsedLeft: {
    flex: 1,
    gap: 4,
    marginRight: 16,
  },
  collapsedLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.inactive,
    textTransform: 'uppercase',
  },
  collapsedValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  expandText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentBlue,
  },
});
