import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme/colors';
import { configureRevenueCat } from './src/lib/revenuecat';

// Crash + error reporting only. DSN comes from the env; if it is missing Sentry
// stays inert (no crash), so the app still runs before the DSN is configured.
// NOTE: performance tracing/profiling is intentionally NOT enabled — it crashes
// (SIGSEGV) on the New Architecture (getsentry/sentry-react-native#4188), and we
// only need crash/error capture here.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // debug logs the event pipeline to the console — useful while verifying the setup.
  debug: __DEV__,
});

configureRevenueCat();

const NAV_THEME = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: colors.background,
  },
};

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <NavigationContainer theme={NAV_THEME}>
            {/* No backgroundColor: edge-to-edge (SDK 55) draws under the bar;
                the prop only triggers the deprecated Window.setStatusBarColor. */}
            <StatusBar style="dark" />
            <RootNavigator />
          </NavigationContainer>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap enables automatic error-boundary + native crash capture.
export default Sentry.wrap(App);
