import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Image,
  Text,
  Animated,
  StyleSheet,
  useWindowDimensions,
} from 'react-native';
import type { ImageSourcePropType } from 'react-native';
import { colors } from '../../theme/colors';

interface Props {
  image: ImageSourcePropType;
  text: string;
  /** Changing this value re-triggers the entrance animation */
  stepKey: number;
}

export default function MascotBubble({ image, text, stepKey }: Props) {
  const { width: screenWidth } = useWindowDimensions();
  const contentWidth = Math.min(screenWidth, 600);
  const mascotSize = Math.round(contentWidth * 0.88);
  const bubbleWidth = contentWidth - 48;

  const translateX    = useRef(new Animated.Value(-screenWidth)).current;
  const bubbleScale   = useRef(new Animated.Value(0)).current;
  const bubbleOpacity = useRef(new Animated.Value(0)).current;

  // Image and text only update while the mascot is off-screen so the user
  // never sees the wrong image on-screen during a transition.
  const [displayedImage, setDisplayedImage] = useState<ImageSourcePropType>(image);
  const [displayedText,  setDisplayedText]  = useState(text);
  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      setDisplayedImage(image);
      setDisplayedText(text);
      translateX.setValue(-screenWidth);
      bubbleScale.setValue(0);
      bubbleOpacity.setValue(0);
      slideIn();
      return;
    }

    // Slide out (bubble hides, mascot exits left), then swap content, then slide in.
    Animated.parallel([
      Animated.timing(bubbleOpacity, { toValue: 0, duration: 80, useNativeDriver: true }),
      Animated.spring(translateX, { toValue: -screenWidth, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start(() => {
      setDisplayedImage(image);
      setDisplayedText(text);
      bubbleScale.setValue(0);
      slideIn();
    });
  }, [stepKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function slideIn() {
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
  }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.mascotShadow, { transform: [{ translateX }] }]}>
        <Image source={displayedImage} style={[styles.mascot, { width: mascotSize, height: mascotSize }]} resizeMode="contain" />
      </Animated.View>

      <Animated.View
        style={[
          styles.bubbleWrap,
          { width: bubbleWidth },
          {
            opacity: bubbleOpacity,
            transform: [{ scale: bubbleScale }],
          },
        ]}
      >
        <View style={styles.tail} />
        <View style={styles.bubble}>
          <Text style={styles.bubbleText}>{displayedText}</Text>
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
  },
  bubbleWrap: {
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
