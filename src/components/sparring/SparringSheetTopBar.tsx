import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  Extrapolation, interpolate, useAnimatedStyle, type SharedValue,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { colors } from '../../theme/colors';

const FADE_DISTANCE = 32;
const BUTTON = 48;
const EDGE_GAP = 8;
/** Room content next to the floating buttons must keep free on the right. */
export const TOP_BAR_CLEARANCE = 2 * BUTTON + EDGE_GAP + 8;

// Share + close at the top right of the sparring sheet.
// overlay: floats above the head (reserves no space); as soon as the content
//   scrolls, a compact bar with title, date/time and place fades in behind the
//   buttons, so the top never shows an empty area.
// fixed (very large text): a plain row above the content, no summary, so
//   nothing ever overlaps text.
export default function SparringSheetTopBar({ mode, summary, scrollY, onShare, onClose }: {
  mode:    'overlay' | 'fixed';
  summary: { title: string; line: string };
  scrollY: SharedValue<number>;
  onShare: () => void;
  onClose: () => void;
}): React.ReactElement {
  const { t } = useTranslation();
  const summaryStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, FADE_DISTANCE], [0, 1], Extrapolation.CLAMP),
  }));

  const buttons = (
    <View style={styles.buttons}>
      <TouchableOpacity
        style={styles.iconTouch}
        onPress={onShare}
        accessibilityRole="button"
        accessibilityLabel={t('sparring.invite.share')}
      >
        <View style={styles.disc}>
          <Ionicons name="share-outline" size={20} color={colors.text} />
        </View>
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.iconTouch}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel={t('sparring.detailHeader.close')}
      >
        <View style={styles.disc}>
          <Ionicons name="close" size={22} color={colors.text} />
        </View>
      </TouchableOpacity>
    </View>
  );

  if (mode === 'fixed') {
    return <View style={styles.fixedRow}>{buttons}</View>;
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {/* Decorative duplicate of the head: screen readers read the head itself. */}
      <Animated.View
        style={[styles.summaryBar, summaryStyle]}
        pointerEvents="none"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Text style={styles.summaryTitle} numberOfLines={1}>{summary.title}</Text>
        <Text style={styles.summaryLine} numberOfLines={1}>{summary.line}</Text>
      </Animated.View>
      {buttons}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position:      'absolute',
    top:           0,
    left:          0,
    right:         0,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop:    EDGE_GAP,
    paddingRight:  EDGE_GAP,
  },
  summaryBar: {
    ...StyleSheet.absoluteFillObject,
    justifyContent:    'center',
    paddingLeft:       24,
    // Keeps the text clear of the two buttons.
    paddingRight:      TOP_BAR_CLEARANCE,
    paddingTop:        8,
    backgroundColor:   colors.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  summaryTitle: {
    fontSize:   16,
    lineHeight: 20,
    fontWeight: '800',
    color:      colors.text,
  },
  summaryLine: {
    fontSize:   13,
    lineHeight: 18,
    fontWeight: '600',
    color:      colors.accentBlueText,
  },
  fixedRow: {
    flexDirection:  'row',
    justifyContent: 'flex-end',
    paddingTop:     EDGE_GAP,
    paddingRight:   EDGE_GAP,
  },
  buttons: {
    flexDirection: 'row',
  },
  iconTouch: {
    width:          BUTTON,
    height:         BUTTON,
    alignItems:     'center',
    justifyContent: 'center',
  },
  disc: {
    width:           36,
    height:          36,
    borderRadius:    18,
    backgroundColor: colors.hairline,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
