import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export interface IllustrationProps {
  width:  number;
  height: number;
  active: boolean;
}

interface Props {
  width:          number;
  illustrationHeight: number;
  title:          string;
  text:           string;
  active:         boolean;
  small:          boolean;
  Illustration:   React.ComponentType<IllustrationProps>;
}

const GUTTER = 24;

// One page of the welcome intro: illustration panel on top, headline and a
// short sentence below. Scrolls vertically when large system fonts or a short
// screen need more room, so nothing is ever cut off.
export default function WelcomeSlide({
  width, illustrationHeight, title, text, active, small, Illustration,
}: Props): React.ReactElement {
  return (
    <ScrollView
      style={[styles.page, { width }]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      // Only the visible page is exposed to screen readers.
      importantForAccessibility={active ? 'auto' : 'no-hide-descendants'}
      accessibilityElementsHidden={!active}
    >
      {/* Decorative example; the text below carries the meaning */}
      <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Illustration width={width - GUTTER * 2} height={illustrationHeight} active={active} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, small && styles.titleSmall]} accessibilityRole="header" maxFontSizeMultiplier={1.4}>
          {title}
        </Text>
        <Text style={styles.text}>{text}</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 0,
  },
  content: {
    paddingHorizontal: GUTTER,
    paddingTop:        8,
    paddingBottom:     16,
    gap:               24,
  },
  textBlock: {
    gap: 8,
  },
  title: {
    fontSize:      30,
    lineHeight:    34,
    fontWeight:    '900',
    letterSpacing: -0.8,
    color:         colors.text,
  },
  titleSmall: {
    fontSize:   26,
    lineHeight: 30,
  },
  text: {
    fontSize:   16,
    lineHeight: 24,
    color:      colors.textMuted,
  },
});
