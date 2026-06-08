import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Modal,
  TextInput,
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
  visible:  boolean;
  onSubmit: (kg: number) => void;
  onLater:  () => void;
}

export default function WeightCheckInModal({ visible, onSubmit, onLater }: Props) {
  const { width: screenW } = useWindowDimensions();
  const contentW = Math.min(screenW, 600);
  const mascotSize = Math.round(contentW * 0.78);

  const [draft, setDraft] = useState('');

  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const slideX        = useRef(new Animated.Value(screenW)).current;
  const bubbleScale   = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;

    overlayOpacity.setValue(0);
    slideX.setValue(screenW);
    bubbleScale.setValue(0);
    bubbleOpacity.setValue(0);

    Animated.sequence([
      // 1) Fade in dark overlay
      Animated.timing(overlayOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      // 2) Mascot slides in from right
      Animated.spring(slideX, {
        toValue: 0,
        tension: 48,
        friction: 9,
        useNativeDriver: true,
      }),
      // 3) Speech bubble pops in
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

  const parsedKg: number | null = (() => {
    const v = parseFloat(draft.replace(',', '.'));
    return Number.isFinite(v) && v >= 30 && v <= 300 ? v : null;
  })();

  function handleSubmit(): void {
    if (parsedKg === null) return;
    setDraft('');
    onSubmit(parsedKg);
  }

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Dark overlay */}
        <Animated.View style={[styles.overlay, { opacity: overlayOpacity }]} />

        {/* Content: bubble above, mascot below — slides from right */}
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
              <Text style={styles.question}>
                Wie viel wiegst du diese Woche?
              </Text>

              <TextInput
                style={[
                  styles.input,
                  parsedKg === null && draft.length > 0 && styles.inputError,
                ]}
                value={draft}
                onChangeText={setDraft}
                placeholder="Gewicht in kg"
                placeholderTextColor={colors.inactive}
                keyboardType="decimal-pad"
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />

              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.submitBtn, parsedKg === null && styles.btnDisabled]}
                  onPress={handleSubmit}
                  disabled={parsedKg === null}
                  activeOpacity={0.85}
                >
                  <Text style={styles.submitBtnText}>Eintragen</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.laterBtn}
                  onPress={onLater}
                  activeOpacity={0.7}
                >
                  <Text style={styles.laterBtnText}>Später eintragen</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Tail pointing down toward mascot */}
            <View style={styles.tail} />
          </Animated.View>

          {/* Mascot */}
          <Image source={WAAGE_IMG} style={[styles.mascot, { width: mascotSize, height: mascotSize }]} resizeMode="contain" />
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
    shadowColor: colors.dark,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  question: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
    lineHeight: 24,
  },
  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: 'Inter_400Regular',
    color: colors.text,
    backgroundColor: colors.background,
    textAlign: 'center',
  },
  inputError: {
    borderColor: colors.deleteRed,
  },
  actions: {
    gap: 10,
  },
  submitBtn: {
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.accentBlue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.card,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  laterBtn: {
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  laterBtnText: {
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
