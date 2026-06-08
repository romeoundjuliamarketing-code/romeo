import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { useWaterTracking } from '../hooks/useWaterTracking';
import { useNutritionTargets } from '../hooks/useNutritionTargets';
import { useWeightGoalCoach } from '../hooks/useWeightGoalCoach';
import { mondayOfWeek } from '../hooks/useWeight';
import WaterBottleCard from '../components/home/WaterBottleCard';
import NutritionTargetsCard from '../components/ernaehrung/NutritionTargetsCard';
import WeightGoalCoachCard from '../components/ernaehrung/WeightGoalCoachCard';
import TrainingFrequencySelector, { type FrequencyTier } from '../components/ernaehrung/TrainingFrequencySelector';
import ConfettiOverlay from '../components/ernaehrung/ConfettiOverlay';
import NutritionAdjustmentModal from '../components/ernaehrung/NutritionAdjustmentModal';
import WeightProgressCard from '../components/ernaehrung/WeightProgressCard';
import type { PlanMode } from '../utils/nutritionEngine';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function ErnährungScreen() {
  const { user } = useAuth();
  const [focusTrigger,     setFocusTrigger]     = useState(0);
  const [profileTrigger,   setProfileTrigger]   = useState(0);
  const [frequencySaving,  setFrequencySaving]  = useState(false);
  useFocusEffect(useCallback(() => { setFocusTrigger(n => n + 1); }, []));

  const { amountMl, goalMl, hydrationMode, setHydrationMode, addWater, loading } = useWaterTracking(
    () => setShowConfetti(true),
    focusTrigger,
  );

  // Pass profileTrigger so useNutritionTargets re-fetches after training_frequency changes.
  const {
    maintenanceCalories,
    maintenancePlan,
    engineInput,
    currentWeight,
    weightHistory,
    ageYears: _ageYears,
    loading: nutritionLoading,
    missingProfileData,
    profile,
  } = useNutritionTargets(profileTrigger);

  const {
    targetWeightKg,
    startWeightKg,
    targetDateIso,
    recommendedDateIso,
    isSaving: goalSaving,
    setTargetWeight,
    clearTargetWeight,
    plans,
    selectedMode,
    setSelectedMode,
    selectedPlan,
    trendDeltaKcal,
    uiMessages,
  } = useWeightGoalCoach({
    engineInput,
    maintenanceCalories,
    currentWeight,
    weightHistory,
  });

  // ── Plan collapse state ───────────────────────────────────────────────────
  const [planConfirmed,    setPlanConfirmed]    = useState(false);
  const [showConfetti,     setShowConfetti]     = useState(false);
  const [isMaintainActive, setIsMaintainActive] = useState(false);

  // Persist "Gewicht halten" selection across tab switches
  useEffect(() => {
    if (user === null) return;
    void AsyncStorage.getItem(`weight_maintain_active:${user.id}`).then((val) => {
      if (val === 'true') {
        setIsMaintainActive(true);
        setPlanConfirmed(true);
      }
    });
  }, [user]);

  // Clear maintain flag when a real goal is saved
  useEffect(() => {
    if (targetWeightKg !== null && user !== null) {
      void AsyncStorage.removeItem(`weight_maintain_active:${user.id}`);
      setIsMaintainActive(false);
    }
  }, [targetWeightKg, user]);

  const autoCollapsed = useRef(false);
  useEffect(() => {
    if (targetWeightKg !== null && plans.length > 0 && !autoCollapsed.current) {
      autoCollapsed.current = true;
      setPlanConfirmed(true);
    }
    if (targetWeightKg === null && !isMaintainActive) {
      autoCollapsed.current = false;
      setPlanConfirmed(false);
      setShowConfetti(false);
    }
  }, [targetWeightKg, plans.length, isMaintainActive]);

  // ── Nutrition adjustment modal ────────────────────────────────────────────
  const [showAdjModal,       setShowAdjModal]       = useState(false);
  const [pendingAdj,         setPendingAdj]         = useState(0);
  const [acceptedAdj,        setAcceptedAdj]        = useState(0);
  const [dismissedThisWeek,  setDismissedThisWeek]  = useState(false);
  const adjShownThisFocus = useRef(false);

  // Load previously accepted adjustment + dismissed state from storage
  useEffect(() => {
    if (user === null) return;
    const uid = user.id;
    void Promise.all([
      AsyncStorage.getItem(`nutrition_adj_accepted:${uid}`),
      AsyncStorage.getItem(`nutrition_adj_dismissed_week:${uid}`),
    ]).then(([stored, dismissedWeek]) => {
      if (stored !== null) setAcceptedAdj(parseInt(stored, 10));
      if (dismissedWeek === mondayOfWeek()) setDismissedThisWeek(true);
    });
  }, [user]);

  // Clear stored adjustment when plan is reset
  useEffect(() => {
    if (targetWeightKg === null && user !== null) {
      void AsyncStorage.removeItem(`nutrition_adj_accepted:${user.id}`);
      void AsyncStorage.removeItem(`nutrition_adj_dismissed_week:${user.id}`);
      setAcceptedAdj(0);
      setDismissedThisWeek(false);
    }
  }, [targetWeightKg, user]);

  // Check if an adjustment should be proposed on every focus — only on Mondays
  useEffect(() => {
    if (new Date().getDay() !== 1) return; // 1 = Monday
    if (nutritionLoading) return;
    if (trendDeltaKcal === 0) return;
    if (weightHistory.length < 2) return;
    if (targetWeightKg === null) return;
    if (acceptedAdj !== 0) return;
    if (dismissedThisWeek) return;
    if (user === null) return;
    if (adjShownThisFocus.current) return;
    adjShownThisFocus.current = true;

    setPendingAdj(trendDeltaKcal);
    setTimeout(() => setShowAdjModal(true), 800);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusTrigger, nutritionLoading, dismissedThisWeek]);

  // Reset per-focus guard when tab changes (must run BEFORE the check effect)
  useEffect(() => {
    adjShownThisFocus.current = false;
  }, [focusTrigger]);

  async function handleAdjConfirm(): Promise<void> {
    setShowAdjModal(false);
    if (user === null) return;
    await AsyncStorage.setItem(`nutrition_adj_accepted:${user.id}`, String(pendingAdj));
    setAcceptedAdj(pendingAdj);
  }

  function handleAdjDecline(): void {
    setShowAdjModal(false);
    setDismissedThisWeek(true);  // synchronous in-memory guard
    if (user === null) return;
    void AsyncStorage.setItem(`nutrition_adj_dismissed_week:${user.id}`, mondayOfWeek());
  }

  // ── Training frequency handler ────────────────────────────────────────────
  async function handleFrequencyChange(tier: FrequencyTier): Promise<void> {
    if (user === null || frequencySaving) return;
    setFrequencySaving(true);
    await supabase.from('profiles').update({ training_frequency: tier }).eq('id', user.id);
    setProfileTrigger(n => n + 1);
    setFrequencySaving(false);
  }

  // ── Plan handlers ─────────────────────────────────────────────────────────
  function handleMaintain(): void {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    void clearTargetWeight();
    if (user !== null) {
      void AsyncStorage.setItem(`weight_maintain_active:${user.id}`, 'true');
    }
    setIsMaintainActive(true);
    setPlanConfirmed(true);
  }

  function handlePlanSelected(mode: PlanMode): void {
    setSelectedMode(mode);
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPlanConfirmed(true);
    setShowConfetti(true);
  }

  function handleExpand(): void {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPlanConfirmed(false);
    setShowConfetti(false);
  }

  function handleClearTarget(): void {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setIsMaintainActive(false);
    setPlanConfirmed(false);
    setShowConfetti(false);
    if (user !== null) {
      void AsyncStorage.removeItem(`weight_maintain_active:${user.id}`);
    }
    void clearTargetWeight();
  }

  // ── Displayed plan (with accepted adjustment applied) ─────────────────────
  const hasGoal       = targetWeightKg !== null && plans.length > 0;
  const basePlan      = hasGoal ? selectedPlan : maintenancePlan;
  const titleSuffix   = hasGoal ? 'für dein Ziel' : 'zum Halten';
  const infoText      = uiMessages?.warning ?? null;

  const displayedPlan = useMemo(() => {
    if (basePlan === null || acceptedAdj === 0) return basePlan;
    return {
      ...basePlan,
      kcalPerDay:  basePlan.kcalPerDay + acceptedAdj,
      carbsGrams:  basePlan.carbsGrams + Math.round(acceptedAdj / 4),
    };
  }, [basePlan, acceptedAdj]);

  const isGain = targetWeightKg !== null && currentWeight !== null
    ? targetWeightKg > currentWeight
    : true;

  const [activeTab, setActiveTab] = useState<'heute' | 'plan'>('heute');

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        style={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
        <Text style={styles.title}>Ernährung</Text>

        {/* ── Tab Switcher ── */}
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'heute' && styles.tabBtnActive]}
            onPress={() => setActiveTab('heute')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'heute' && styles.tabLabelActive]}>
              Heute
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'plan' && styles.tabBtnActive]}
            onPress={() => setActiveTab('plan')}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabLabel, activeTab === 'plan' && styles.tabLabelActive]}>
              Mein Plan
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Heute ── */}
        {activeTab === 'heute' && (
          <>
            <WaterBottleCard
              amountMl={amountMl}
              goalMl={goalMl}
              hydrationMode={hydrationMode}
              onHydrationModeChange={(mode) => { void setHydrationMode(mode); }}
              loading={loading}
              onAdd250={() => { void addWater(250); }}
              onAdd500={() => { void addWater(500); }}
              focusTrigger={focusTrigger}
            />

            <NutritionTargetsCard
              titleSuffix={titleSuffix}
              plan={displayedPlan ?? null}
              loading={nutritionLoading}
              missingProfileData={missingProfileData}
              infoText={infoText}
            />
          </>
        )}

        {/* ── Mein Plan ── */}
        {activeTab === 'plan' && (
          <>
            {hasGoal && currentWeight !== null && targetWeightKg !== null && startWeightKg !== null && (
              <WeightProgressCard
                currentWeight={currentWeight}
                targetWeight={targetWeightKg}
                startWeight={startWeightKg}
                isGain={isGain}
              />
            )}

            <WeightGoalCoachCard
              targetWeightKg={targetWeightKg}
              targetDateIso={targetDateIso}
              recommendedDateIso={recommendedDateIso}
              plans={plans}
              selectedMode={selectedMode}
              onSelectMode={setSelectedMode}
              onPlanSelected={handlePlanSelected}
              collapsed={planConfirmed && (hasGoal || isMaintainActive)}
              onExpand={handleExpand}
              isSaving={goalSaving}
              onSaveTarget={(kg, dateIso) => { void setTargetWeight(kg, dateIso); }}
              onClearTarget={handleClearTarget}
              isMaintainActive={isMaintainActive}
              onMaintain={handleMaintain}
            />

            <View style={styles.frequencyCard}>
              <Text style={styles.sectionTitle}>Trainingspensum</Text>
              <TrainingFrequencySelector
                value={(profile?.training_frequency ?? null) as FrequencyTier | null}
                onChange={(tier) => { void handleFrequencyChange(tier); }}
                loading={frequencySaving}
              />
            </View>

            {hasGoal && uiMessages !== null && (
              <View style={styles.uiMessageCard}>
                <Text style={styles.uiHeadline}>{uiMessages.headline}</Text>
                <Text style={styles.uiSubline}>{uiMessages.subline}</Text>
                <Text style={styles.uiHint}>{uiMessages.adjustmentHint}</Text>
              </View>
            )}
          </>
        )}
        </View>
      </ScrollView>

      <NutritionAdjustmentModal
        visible={showAdjModal}
        adjustmentKcal={pendingAdj}
        isGain={isGain}
        onConfirm={() => { void handleAdjConfirm(); }}
        onDecline={handleAdjDecline}
      />

      <ConfettiOverlay
        visible={showConfetti}
        onComplete={() => setShowConfetti(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  container: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 24,
    gap: 24,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: colors.border,
    borderRadius: 12,
    padding: 3,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.card,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.text,
  },
  uiMessageCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  uiHeadline: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.text,
  },
  uiSubline: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  uiHint: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.inactive,
    marginTop: 4,
  },
  frequencyCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
});
