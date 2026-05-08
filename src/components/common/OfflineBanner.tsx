import React, { useEffect, useRef, useState } from 'react';
import { Animated, AppState, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../theme/colors';
import {
  checkConnectivity,
  getNetworkOffline,
  subscribeNetworkStatus,
} from '../../lib/networkStatus';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(getNetworkOffline());
  const slideAnim = useRef(new Animated.Value(getNetworkOffline() ? 1 : 0)).current;
  const insets = useSafeAreaInsets();

  useEffect(() => {
    void checkConnectivity();

    const unsub = subscribeNetworkStatus((offline) => {
      setIsOffline(offline);
      Animated.timing(slideAnim, {
        toValue: offline ? 1 : 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    });

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void checkConnectivity();
      }
    });

    return () => {
      unsub();
      appStateSub.remove();
    };
  }, [slideAnim]);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-60, 0],
  });

  if (!isOffline) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingTop: insets.top + 8, transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.text}>Keine Internetverbindung</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: colors.deleteRed,
    paddingBottom: 8,
    alignItems: 'center',
  },
  text: {
    color: '#FFFFFF',
    fontFamily: 'Inter',
    fontSize: 13,
    fontWeight: '600',
  },
});
