import React, { useEffect, useRef } from 'react';
import {
  View,
  Image,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { colors } from '../../theme/colors';

const SCREEN_WIDTH = Dimensions.get('window').width;
const MASCOT_SIZE = Math.round(SCREEN_WIDTH * 0.88);

interface Props {
  image: ImageSourcePropType;
  text: string;
  /** Changing this value re-triggers the entrance animation */
  stepKey: number;
}

export default function MascotBubble({ image, text, stepKey }: Props) {
  const translateX = useRef(new Animated.Value(-SCREEN_WIDTH)).current;
  const bubbleScale = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    translateX.setValue(-SCREEN_WIDTH);
    bubbleScale.setValue(0);
    bubbleOpacity.setValue(0);

    // 1) Mascot slides in from left
    // 2) Speech bubble pops up below mascot
    Animated.sequence([
      Animated.spring(translateX, {
        toValue: 0,
        tension: 50,
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
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <View style={styles.container}>
      {/* Mascot — large, centered, slides in from left */}
      <Animated.View style={[styles.mascotShadow, { transform: [{ translateX }] }]}>
        <Image source={image} style={styles.mascot} resizeMode="contain" />
      </Animated.View>

      {/* Speech bubble — below mascot, pops up after arrival */}
      <Animated.View
        style={[
          styles.bubbleWrap,
          {
            opacity: bubbleOpacity,
            transform: [{ scale: bubbleScale }],
          },
        ]}
      >
        {/* Tail pointing up toward mascot */}
        <View style={styles.tail} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{text}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    width: '100%',
  },
  mascotShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  mascot: {
    width: MASCOT_SIZE,
    height: MASCOT_SIZE,
  },
  bubbleWrap: {
    width: SCREEN_WIDTH - 48,
    alignItems: 'center',
    marginTop: 4,
  },
  tail: {
    width: 0,
    height: 0,
    borderLeftWidth: 12,
    borderRightWidth: 12,
    borderBottomWidth: 12,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: colors.card,
    marginBottom: -1,
  },
  bubble: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 4,
  },
  bubbleText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    lineHeight: 24,
    textAlign: 'center',
  },
});
