import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, useWindowDimensions } from 'react-native';
import { colors } from '../../theme/colors';

const PARTICLE_COUNT = 28;
const FALL_DURATION_MIN  = 1_400; // ms
const FALL_DURATION_MAX  = 2_200;

// Colors used for confetti pieces — drawn from the design system.
const CONFETTI_COLORS: string[] = [
  colors.accent,
  colors.accentBlue,
  colors.catTrittkraft,
  colors.catMobility,
  colors.catCore,
  colors.catCardio,
  colors.deleteRed,
  colors.chartBoxen,
];

interface ParticleData {
  startX:    number;
  driftX:    number;
  width:     number;
  height:    number;
  color:     string;
  delay:     number;
  duration:  number;
  rotations: number;
  animY: Animated.Value;
  animX: Animated.Value;
  animO: Animated.Value;
  animR: Animated.Value;
}

function makeParticles(screenW: number): ParticleData[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
    const duration = FALL_DURATION_MIN + Math.random() * (FALL_DURATION_MAX - FALL_DURATION_MIN);
    return {
      startX:    Math.random() * screenW,
      driftX:    (Math.random() - 0.5) * 130,
      width:     6  + Math.random() * 7,
      height:    10 + Math.random() * 10,
      color:     CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      delay:     i * 50,
      duration,
      rotations: 1 + Math.floor(Math.random() * 3),
      animY: new Animated.Value(-30),
      animX: new Animated.Value(0),
      animO: new Animated.Value(1),
      animR: new Animated.Value(0),
    };
  });
}

interface ConfettiOverlayProps {
  visible:    boolean;
  onComplete: () => void;
}

export default function ConfettiOverlay({ visible, onComplete }: ConfettiOverlayProps) {
  const { width: screenW, height: screenH } = useWindowDimensions();
  const particlesRef = useRef<ParticleData[]>(makeParticles(screenW));

  useEffect(() => {
    if (!visible) return;

    const particles = particlesRef.current;

    // Reset all values before animating
    particles.forEach(p => {
      p.animY.setValue(-30);
      p.animX.setValue(0);
      p.animO.setValue(1);
      p.animR.setValue(0);
    });

    let completed = 0;

    const animations = particles.map(p =>
      Animated.parallel([
        // Fall down
        Animated.timing(p.animY, {
          toValue:        screenH + 80,
          duration:       p.duration,
          delay:          p.delay,
          useNativeDriver: true,
        }),
        // Horizontal drift
        Animated.timing(p.animX, {
          toValue:        p.driftX,
          duration:       p.duration,
          delay:          p.delay,
          useNativeDriver: true,
        }),
        // Fade out in the last 35% of the flight
        Animated.sequence([
          Animated.delay(p.delay + p.duration * 0.65),
          Animated.timing(p.animO, {
            toValue:        0,
            duration:       p.duration * 0.35,
            useNativeDriver: true,
          }),
        ]),
        // Rotation
        Animated.timing(p.animR, {
          toValue:        p.rotations,
          duration:       p.duration,
          delay:          p.delay,
          useNativeDriver: true,
        }),
      ]),
    );

    animations.forEach(anim => {
      anim.start(() => {
        completed += 1;
        if (completed === particles.length) {
          onComplete();
        }
      });
    });

    return () => {
      animations.forEach(a => a.stop());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.overlay} pointerEvents="none">
      {particlesRef.current.map((p, i) => {
        const rotate = p.animR.interpolate({
          inputRange:  [0, 1],
          outputRange: ['0deg', '360deg'],
        });
        return (
          <Animated.View
            key={i}
            style={[
              styles.particle,
              {
                left:   p.startX,
                width:  p.width,
                height: p.height,
                backgroundColor: p.color,
                opacity: p.animO,
                transform: [
                  { translateY: p.animY },
                  { translateX: p.animX },
                  { rotate },
                ],
              },
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position:   'absolute',
    top:        0,
    left:       0,
    right:      0,
    bottom:     0,
    overflow:   'hidden',
  },
  particle: {
    position:     'absolute',
    top:          0,
    borderRadius: 2,
  },
});
