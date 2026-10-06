import React, { useEffect, useState } from 'react';
import { View, Text, Image, Modal, StyleSheet, TouchableOpacity, ActivityIndicator, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { coverHeightFor, coverLayout, focusFromOffset } from '../../utils/coverLayout';
import type { Focus, Size } from '../../utils/coverLayout';
import { PrimaryButton } from './ProfileParts';

const AVATAR_MARK = 88;

// Framing editor for the cover photo. The frame has the exact proportions of
// the profile hero; the user drags the photo until faces sit where they should.
// The dark band and the avatar circle show what the name and the avatar will
// cover later. Saves only a focus point — the photo itself is not cropped.
export default function CoverEditorModal({ uri, initialFocus, visible, saving, onCancel, onSave }: {
  uri:          string | null;
  initialFocus: Focus;
  visible:      boolean;
  saving:       boolean;
  onCancel:     () => void;
  onSave:       (focus: Focus) => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const frameW = Math.min(screenW - 32, 600);
  const frame: Size = {
    width:  frameW,
    height: Math.round(frameW * ((coverHeightFor(screenH) + insets.top) / screenW)),
  };

  const [natural, setNatural] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [focus, setFocus] = useState<Focus>(initialFocus);

  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const startX = useSharedValue(0);
  const startY = useSharedValue(0);
  const maxX = useSharedValue(0);
  const maxY = useSharedValue(0);

  useEffect(() => {
    if (!visible || uri === null) return;
    setNatural(null);
    setFailed(false);
    setFocus(initialFocus);
    Image.getSize(uri, (width, height) => setNatural({ width, height }), () => setFailed(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, uri]);

  const layout = natural !== null ? coverLayout(frame, natural, initialFocus) : null;
  useEffect(() => {
    if (layout === null) return;
    tx.value = layout.left;
    ty.value = layout.top;
    maxX.value = layout.overflowX;
    maxY.value = layout.overflowY;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout?.width, layout?.height, frame.width, frame.height]);

  const commit = (x: number, y: number, ox: number, oy: number): void => {
    setFocus({ x: focusFromOffset(x, ox), y: focusFromOffset(y, oy) });
  };

  const pan = Gesture.Pan()
    .onStart(() => {
      startX.value = tx.value;
      startY.value = ty.value;
    })
    .onUpdate((e) => {
      tx.value = Math.min(0, Math.max(-maxX.value, startX.value + e.translationX));
      ty.value = Math.min(0, Math.max(-maxY.value, startY.value + e.translationY));
    })
    .onEnd(() => {
      runOnJS(commit)(tx.value, ty.value, maxX.value, maxY.value);
    });

  const imageStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }, { translateY: ty.value }],
  }));

  const movable = layout !== null && (layout.overflowX > 1 || layout.overflowY > 1);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={saving ? () => {} : onCancel} statusBarTranslucent>
      <GestureHandlerRootView style={[styles.root, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={onCancel} disabled={saving} accessibilityRole="button" accessibilityLabel="Abbrechen">
            <Ionicons name="close" size={24} color={colors.headerTextPrimary} />
          </TouchableOpacity>
          <Text style={styles.title} accessibilityRole="header">Ausschnitt wählen</Text>
          <View style={styles.iconBtn} />
        </View>

        <View style={styles.body}>
          <View style={[styles.frame, { width: frame.width, height: frame.height }]}>
            {failed ? (
              <Text style={styles.message}>Das Bild konnte nicht geladen werden.</Text>
            ) : layout === null || uri === null ? (
              <ActivityIndicator color={colors.headerTextPrimary} />
            ) : (
              <GestureDetector gesture={pan}>
                <Animated.View style={StyleSheet.absoluteFill} accessibilityLabel="Titelbild verschieben">
                  <Animated.Image
                    source={{ uri }}
                    style={[styles.image, { width: layout.width, height: layout.height }, imageStyle]}
                    accessibilityIgnoresInvertColors
                  />
                  {/* Preview of what the name and the avatar will cover */}
                  <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                    <Defs>
                      <LinearGradient id="editorScrim" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0.5" stopColor={colors.dark} stopOpacity="0" />
                        <Stop offset="1" stopColor={colors.dark} stopOpacity="0.88" />
                      </LinearGradient>
                    </Defs>
                    <Rect x="0" y="0" width="100%" height="100%" fill="url(#editorScrim)" />
                  </Svg>
                  <View style={styles.avatarMark} pointerEvents="none" />
                </Animated.View>
              </GestureDetector>
            )}
          </View>
          <Text style={styles.message}>
            {movable
              ? 'Zieh das Bild, bis der Ausschnitt passt. Unten stehen später dein Name und dein Profilbild.'
              : 'Das Bild passt genau in den Rahmen. Unten stehen später dein Name und dein Profilbild.'}
          </Text>
        </View>

        <View style={styles.footer}>
          <PrimaryButton
            icon="checkmark"
            label="Titelbild übernehmen"
            loading={saving}
            disabled={layout === null || failed}
            onPress={() => onSave(focus)}
          />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex:            1,
    backgroundColor: colors.dark,
  },
  header: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 8,
  },
  iconBtn: {
    width:          44,
    height:         44,
    alignItems:     'center',
    justifyContent: 'center',
  },
  title: {
    flex:       1,
    textAlign:  'center',
    fontSize:   17,
    fontWeight: '800',
    color:      colors.headerTextPrimary,
  },
  body: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    gap:            24,
    paddingHorizontal: 16,
  },
  frame: {
    overflow:        'hidden',
    borderRadius:    16,
    alignItems:      'center',
    justifyContent:  'center',
    backgroundColor: colors.text,
  },
  image: {
    position: 'absolute',
    left:     0,
    top:      0,
  },
  avatarMark: {
    position:     'absolute',
    right:        16,
    bottom:       -AVATAR_MARK / 3,
    width:        AVATAR_MARK,
    height:       AVATAR_MARK,
    borderRadius: AVATAR_MARK / 4,
    borderWidth:  2,
    borderColor:  colors.headerTextPrimary,
    borderStyle:  'dashed',
  },
  message: {
    fontSize:   14,
    lineHeight: 20,
    textAlign:  'center',
    color:      colors.coverTextMuted,
  },
  footer: {
    paddingHorizontal: 16,
  },
});
