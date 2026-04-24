import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Easing,
  Image,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../../theme/colors';
import type { HydrationMode } from '../../types/hydration';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const PENGUIN_IMG = require('../../../assets/coach/halber_coach.png') as number;

const PENGUIN_W     = 148;
const PENGUIN_H     = 148;
const BUBBLE_SPACE  = 112; // room to the right of penguin for the bubble
const PEEK_OFFSET   = 152;
// Vertical center of penguin's head within the image (approx. top 28%)
const HEAD_FROM_TOP = Math.round(PENGUIN_H * 0.28);

const BOTTLE_BODY_HEIGHT = 92;
const BOTTLE_BODY_WIDTH  = 56;
const GOAL_TEXT_DIVISOR  = 1000;

const MESSAGES = [
  'Stay hydrated',
  'Mehr trinken',
  'Trinken nicht vergessen',
  'Denk an Wasser',
] as const;

interface WaterBottleCardProps {
  amountMl:      number;
  goalMl:        number;
  hydrationMode: HydrationMode;
  onHydrationModeChange: (mode: HydrationMode) => void;
  loading:       boolean;
  onAdd250:      () => void;
  onAdd500:      () => void;
  focusTrigger?: number;
}

const HYDRATION_MODE_OPTIONS: Array<{ value: HydrationMode; label: string }> = [
  { value: 'everyday', label: 'Alltag' },
  { value: 'active', label: 'Aktiv' },
  { value: 'intense', label: 'Intensiv' },
];

function formatLiters(valueMl: number, digits: number): string {
  return (valueMl / GOAL_TEXT_DIVISOR).toFixed(digits).replace('.', ',');
}

export default function WaterBottleCard({
  amountMl,
  goalMl,
  hydrationMode,
  onHydrationModeChange,
  loading,
  onAdd250,
  onAdd500,
  focusTrigger = 0,
}: WaterBottleCardProps) {
  const ratio = Math.min(amountMl / goalMl, 1);

  const fillHeight    = useRef(new Animated.Value(ratio * BOTTLE_BODY_HEIGHT)).current;
  const penguinY      = useRef(new Animated.Value(0)).current;
  const bubbleScale   = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const isAnimating   = useRef(false);
  const msgIndex      = useRef(0);
  const lastTrigger   = useRef(-1);

  const [message, setMessage] = useState<string>(MESSAGES[0]);

  useEffect(() => {
    Animated.timing(fillHeight, {
      toValue: ratio * BOTTLE_BODY_HEIGHT,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [fillHeight, ratio]);

  const playPenguin = useCallback((force = false) => {
    if (isAnimating.current && !force) return;
    isAnimating.current = true;

    // Advance message
    msgIndex.current = (msgIndex.current + 1) % MESSAGES.length;
    setMessage(MESSAGES[msgIndex.current]);

    penguinY.setValue(0);
    bubbleScale.setValue(0);
    bubbleOpacity.setValue(0);

    Animated.sequence([
      Animated.spring(penguinY, {
        toValue: -PEEK_OFFSET,
        tension: 48,
        friction: 8,
        useNativeDriver: true,
      }),
      Animated.parallel([
        Animated.spring(bubbleScale, {
          toValue: 1,
          tension: 90,
          friction: 6,
          useNativeDriver: true,
        }),
        Animated.timing(bubbleOpacity, {
          toValue: 1,
          duration: 80,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(2400),
      Animated.timing(bubbleOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(penguinY, {
        toValue: 0,
        tension: 40,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start(() => {
      isAnimating.current = false;
    });
  }, [bubbleOpacity, bubbleScale, penguinY]);

  // One-time preview trigger — fires on first focus regardless of conditions
  const previewFired = useRef(false);

  useEffect(() => {
    // Wait for data to load after focus
    if (loading) return;
    // Only process each focus event once
    if (focusTrigger === lastTrigger.current) return;
    lastTrigger.current = focusTrigger;

    async function checkReminder(): Promise<void> {
      const hour      = new Date().getHours();
      const todayIso  = new Date().toISOString().split('T')[0];
      const underHalf = amountMl < goalMl * 0.5;
      const isEvening = hour >= 20;
      const notFull   = amountMl < goalMl;

      // One-time preview on very first focus (for testing)
      if (!previewFired.current) {
        previewFired.current = true;
        setTimeout(playPenguin, 900);
        return;
      }

      // Before 15:00 and under 50%: remind on every tab focus
      if (underHalf && hour < 15) {
        setTimeout(playPenguin, 900);
        return;
      }

      // After 20:00 and not full: remind once per day
      if (isEvening && notFull) {
        const shown = await AsyncStorage.getItem('penguin_evening');
        if (shown !== todayIso) {
          await AsyncStorage.setItem('penguin_evening', todayIso);
          setTimeout(playPenguin, 900);
        }
      }
    }

    void checkReminder();
  }, [focusTrigger, loading, amountMl, goalMl, playPenguin]);

  const animatedFillStyle = useMemo(
    () => ({ height: fillHeight }),
    [fillHeight],
  );

  const isGoalReached = amountMl >= goalMl;
  const remainingMl   = Math.max(goalMl - amountMl, 0);

  return (
    <View style={styles.wrapper}>
      {/* Penguin — behind the card (zIndex 0) */}
      <Animated.View
        style={[styles.penguinWrap, { transform: [{ translateY: penguinY }] }]}
      >
        <Image source={PENGUIN_IMG} style={styles.penguin} resizeMode="contain" />

        {/* Speech bubble — centered directly above penguin head, tail points down */}
        <Animated.View
          style={[
            styles.bubbleAbs,
            { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] },
          ]}
        >
          <View style={styles.bubble}>
            <Text style={styles.bubbleText}>{message}</Text>
          </View>
          <View style={styles.bubbleTail} />
        </Animated.View>
      </Animated.View>

      {/* Card — above penguin (zIndex 1) */}
      <View style={styles.card}>
        <View style={styles.bottleWrap}>
          <View style={styles.bottleNeck} />
          <View style={styles.bottleBody}>
            <Animated.View style={[styles.bottleFill, animatedFillStyle]} />
          </View>
        </View>

        <View style={styles.content}>
          <Text style={styles.title}>Wasser</Text>
          <Text style={styles.amount}>
            {formatLiters(amountMl, 2)}L / {formatLiters(goalMl, 2)}L
          </Text>
          <Text style={styles.progressText}>
            {isGoalReached
              ? 'Tagesziel erreicht!'
              : `Noch ${formatLiters(remainingMl, 1)}L bis zum Ziel`}
          </Text>

          <View style={styles.modeRow}>
            {HYDRATION_MODE_OPTIONS.map((option) => {
              const selected = hydrationMode === option.value;
              return (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.modeChip, selected && styles.modeChipActive]}
                  onPress={() => onHydrationModeChange(option.value)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.modeChipLabel, selected && styles.modeChipLabelActive]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onAdd250}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.buttonText}>+250ml</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={onAdd500}
              activeOpacity={0.85}
              disabled={loading}
            >
              <Text style={styles.buttonText}>+500ml</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  wrapper: {
    // overflow visible — penguin rises above the card boundary
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    flexDirection: 'row',
    gap: 16,
    alignItems: 'center',
    zIndex: 1,
  },
  penguinWrap: {
    position: 'absolute',
    right: -8,
    bottom: -8,
    zIndex: 0,
    // Wider than the penguin so the bubble fits to his right
    width: PENGUIN_W + BUBBLE_SPACE,
  },
  penguin: {
    width: PENGUIN_W,
    height: PENGUIN_H,
  },
  // Bubble 2px to the right of the penguin's head
  bubbleAbs: {
    position: 'absolute',
    top: HEAD_FROM_TOP - 32,
    left: PENGUIN_W - 6,
  },
  bubble: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
    maxWidth: BUBBLE_SPACE,
  },
  bubbleText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  // Triangle pointing LEFT toward the penguin's head
  bubbleTail: {
    position: 'absolute',
    left: -7,
    top: 10,
    width: 0,
    height: 0,
    borderTopWidth: 6,
    borderBottomWidth: 6,
    borderRightWidth: 7,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRightColor: colors.card,
  },
  bottleWrap: {
    width: 60,
    height: 110,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  bottleNeck: {
    width: 20,
    height: 14,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 4,
    backgroundColor: colors.textSecondary,
    marginBottom: 4,
  },
  bottleBody: {
    width: BOTTLE_BODY_WIDTH,
    height: BOTTLE_BODY_HEIGHT,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
    backgroundColor: colors.darkMuted,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bottleFill: {
    width: '100%',
    backgroundColor: colors.accentBlue,
  },
  content: {
    flex: 1,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  amount: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  progressText: {
    fontSize: 14,
    color: colors.inactive,
    fontWeight: '500',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  modeChipActive: {
    backgroundColor: colors.dark,
    borderColor: colors.dark,
  },
  modeChipLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
  },
  modeChipLabelActive: {
    color: colors.headerTextPrimary,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  button: {
    flex: 1,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.card,
  },
});
