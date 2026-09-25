import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

// Animated shell for the centered sparring cards (join/cancel results, cancel
// question): full-screen dim layer, rounded card, pop in on mount and pop out
// before closing. Render it INSIDE the detail sheet's Modal so it always sits
// above the sheet (see CLAUDE.md, Modals/Sheets vs. Navigation).
//
// `children` receives `close(then?)`: plays the pop-out, then calls `onClose`
// and afterwards the optional follow-up action.
interface Props {
  onClose:  () => void;
  children: (close: (then?: () => void) => void) => React.ReactNode;
}

export const POP_IN_MS  = 800;
export const POP_OUT_MS = 250;
const POP_FROM_SCALE    = 0.85;

// Pop-in/pop-out animation shared by every centered sparring window. It pops in
// whenever `openKey` changes to a non-null value (pass a constant to pop in once
// on mount, or e.g. the selected sparring id). `close(then?)` pops out, then
// calls `onClose` and afterwards the optional follow-up action.
export function usePopAnimation(onClose: () => void, openKey: string | null = 'mounted') {
  const opacity    = useSharedValue(0);
  const scale      = useSharedValue(POP_FROM_SCALE);
  const closingRef = useRef(false);
  const thenRef    = useRef<(() => void) | undefined>(undefined);

  useEffect(() => {
    if (openKey === null) return;
    closingRef.current = false;
    opacity.value = 0;
    scale.value   = POP_FROM_SCALE;
    // Fixed-length pop: eases out with a slight overshoot, done after POP_IN_MS.
    opacity.value = withTiming(1, { duration: POP_IN_MS / 2 });
    scale.value   = withTiming(1, { duration: POP_IN_MS, easing: Easing.out(Easing.back(1.6)) });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openKey]);

  function finishClose(): void {
    onClose();
    thenRef.current?.();
  }

  function close(then?: () => void): void {
    if (closingRef.current) return;
    closingRef.current = true;
    thenRef.current = then;
    scale.value   = withTiming(POP_FROM_SCALE, { duration: POP_OUT_MS, easing: Easing.in(Easing.quad) });
    opacity.value = withTiming(0, { duration: POP_OUT_MS }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }

  const overlayStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  const cardStyle    = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return { overlayStyle, cardStyle, close };
}

export default function SparringPopCard({ onClose, children }: Props): React.ReactElement {
  const { overlayStyle, cardStyle, close } = usePopAnimation(onClose);

  return (
    // The dim layer covers the whole screen, so nothing bright shows around
    // the rounded card corners.
    <Animated.View style={[styles.overlay, overlayStyle]}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={() => close()} />
      <Animated.View style={[styles.card, cardStyle]}>
        {children(close)}
      </Animated.View>
    </Animated.View>
  );
}

interface BodyProps {
  icon:          React.ComponentProps<typeof Ionicons>['name'];
  iconColor?:    string;
  title:         string;
  sparringTitle: string;
  dateTimeLabel: string;
  body:          string;
}

// Shared card content: icon, title, the sparring it is about, explanation.
export function SparringPopCardBody({
  icon, iconColor = colors.accentBlue, title, sparringTitle, dateTimeLabel, body,
}: BodyProps): React.ReactElement {
  return (
    <>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={40} color={iconColor} />
      </View>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.sparringBox}>
        <Text style={styles.sparringTitle} numberOfLines={2}>{sparringTitle}</Text>
        <Text style={styles.sparringDate}>{dateTimeLabel}</Text>
      </View>
      <Text style={styles.body}>{body}</Text>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor:   colors.mapOverlay,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 24,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  card: {
    width:           '100%',
    maxWidth:        400,
    backgroundColor: colors.card,
    borderRadius:    24,
    padding:         24,
    alignItems:      'center',
    gap:             16,
  },
  iconCircle: {
    width:           72,
    height:          72,
    borderRadius:    36,
    backgroundColor: colors.accentBlueSoft,
    alignItems:      'center',
    justifyContent:  'center',
  },
  title: {
    fontSize:   22,
    fontWeight: '700',
    color:      colors.text,
    textAlign:  'center',
  },
  sparringBox: {
    width:           '100%',
    backgroundColor: colors.background,
    borderRadius:    16,
    padding:         16,
    gap:             8,
    alignItems:      'center',
  },
  sparringTitle: {
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
    textAlign:  'center',
  },
  sparringDate: {
    fontSize:  14,
    color:     colors.textSecondary,
    textAlign: 'center',
  },
  body: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
    textAlign:  'center',
  },
});
