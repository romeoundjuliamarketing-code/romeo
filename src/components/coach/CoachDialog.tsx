import React, { useEffect, useRef } from 'react';
import { View, Pressable, ScrollView, Modal, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import CoachScene from './CoachScene';
import { CoachPrimaryButton, CoachSecondaryButton } from './CoachAnswerButtons';
import type { CoachFigure } from './coachFigures';

const GUTTER = 16;
const BOTTOM_GAP = 24;             // visible space above the tab bar

// Coach dialog over the evenly dimmed screen: CoachScene (bubble on top,
// coach bottom left, answers beside him) anchored at the bottom. Scrolls when
// the screen is too short. Back button and a tap on the free dim close it.
export default function CoachDialog({ visible, figure, bottomInset, title, body, primaryLabel, laterLabel, onPrimary, onClose }: {
  visible:      boolean;
  figure:       CoachFigure;
  /** Space to keep free at the bottom (safe area, floating tab bar). */
  bottomInset:  number;
  title:        string;
  body:         string;
  primaryLabel: string;
  laterLabel:   string;
  /** Called once per opening; the parent closes the dialog and navigates. */
  onPrimary:    () => void;
  onClose:      () => void;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Blocks double taps on the primary action until the next opening.
  const leavingRef = useRef(false);

  useEffect(() => {
    if (visible) leavingRef.current = false;
  }, [visible]);

  function handlePrimary(): void {
    if (leavingRef.current) return;
    leavingRef.current = true;
    onPrimary();
  }

  const sceneWidth = screenWidth - insets.left - insets.right - GUTTER * 2;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={styles.overlay} accessibilityViewIsModal>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, {
            paddingTop:    insets.top + GUTTER,
            paddingBottom: bottomInset + BOTTOM_GAP,
            paddingLeft:   insets.left + GUTTER,
            paddingRight:  insets.right + GUTTER,
          }]}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          {/* Free dimmed area above the scene closes it (screen readers use the answer buttons). */}
          <Pressable style={styles.spacer} onPress={onClose} accessible={false} importantForAccessibility="no" />
          <CoachScene
            visible={visible}
            figure={figure}
            width={sceneWidth}
            title={title}
            body={body}
            primary={<CoachPrimaryButton label={primaryLabel} onPress={handlePrimary} />}
            secondary={<CoachSecondaryButton label={laterLabel} onPress={onClose} />}
          />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex:            1,
    backgroundColor: colors.mapOverlay,
  },
  scroll: { flex: 1 },
  content: {
    flexGrow:       1,
    justifyContent: 'flex-end',
  },
  spacer: { flexGrow: 1 },
});
