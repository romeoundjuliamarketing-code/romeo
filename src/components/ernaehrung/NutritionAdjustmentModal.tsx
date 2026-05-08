import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TouchableOpacity,
  useWindowDimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { colors } from '../../theme/colors';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const WAAGE_IMG = require('../../../assets/waage.png') as number;

interface Props {
  visible:        boolean;
  adjustmentKcal: number;   // positive = add kcal, negative = reduce kcal
  isGain:         boolean;  // true = bulk, false = cut
  onConfirm:      () => void;
  onDecline:      () => void;
}

function buildMessage(adjustmentKcal: number, isGain: boolean): string {
  const abs = Math.abs(adjustmentKcal);
  if (isGain) {
    return adjustmentKcal > 0
      ? `Du nimmst etwas langsamer zu als geplant. Sollen wir deinen Plan um +${abs} kcal anpassen?`
      : `Du nimmst etwas schneller zu als geplant. Sollen wir deinen Plan um ${abs} kcal reduzieren?`;
  }
  return adjustmentKcal > 0
    ? `Du nimmst etwas zu schnell ab. Sollen wir deinen Plan um +${abs} kcal anpassen?`
    : `Du nimmst etwas zu langsam ab. Sollen wir deinen Plan um ${abs} kcal reduzieren?`;
}

export default function NutritionAdjustmentModal({
  visible,
  adjustmentKcal,
  isGain,
  onConfirm,
  onDecline,
}: Props) {
  const { width: screenW } = useWindowDimensions();
  const contentW = Math.min(screenW, 600);
  const mascotSize = Math.round(contentW * 0.72);

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideX         = useRef(new Animated.Value(screenW)).current;
  const bubbleScale    = useRef(new Animated.Value(0)).current;
  const bubbleOpacity  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    overlayOpacity.setValue(0);
    slideX.setValue(screenW);
    bubbleScale.setValue(0);
    bubbleOpacity.setValue(0);

    Animated.sequence([
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.spring(slideX, {
        toValue: 0,
        tension: 48,
        friction: 9,
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
    ]).start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  const message = buildMessage(adjustmentKcal, isGain);
  const confirmLabel = adjustmentKcal > 0
    ? `+${Math.abs(adjustmentKcal)} kcal anpassen`
    : `${Math.abs(adjustmentKcal)} kcal reduzieren`;

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />

        <Animated.View
          style={[styles.contentWrap, { transform: [{ translateX: slideX }] }]}
        >
          {/* Speech bubble */}
          <Animated.View
            style={[
              styles.bubbleOuter,
              { width: contentW - 32 },
              { opacity: bubbleOpacity, transform: [{ scale: bubbleScale }] },
            ]}
          >
            <View style={styles.bubble}>
              <Text style={styles.question}>{message}</Text>

              <View style={styles.actions}>
                <TouchableOpacity
                  style={styles.confirmBtn}
                  onPress={onConfirm}
                  activeOpacity={0.85}
                >
                  <Text style={styles.confirmBtnText}>{confirmLabel}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.declineBtn}
                  onPress={onDecline}
                  activeOpacity={0.7}
                >
                  <Text style={styles.declineBtnText}>Nein, so lassen</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={styles.tail} />
          </Animated.View>

          {/* Mascot */}
          <Image
            source={WAAGE_IMG}
            style={[styles.mascot, { width: mascotSize, height: mascotSize }]}
            resizeMode="contain"
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10,10,10,0.72)',
  },
  contentWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 0 : 16,
  },
  bubbleOuter: {
    alignItems: 'center',
    zIndex: 2,
  },
  bubble: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 20,
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  question: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  actions: {
    gap: 10,
  },
  confirmBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
  declineBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.inactive,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 14,
    borderRightWidth: 14,
    borderTopWidth: 14,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: colors.card,
    marginTop: -1,
  },
  mascot: {
  },
});
