import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme, type LinkingOptions } from '@react-navigation/native';
import * as Linking from 'expo-linking';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme/colors';
import { configureRevenueCat } from './src/lib/revenuecat';
import type { RootStackParamList } from './src/navigation/types';

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

// Deep links: https://sparrapp.com/s/<id> and sparr://s/<id> open the
// sparring detail sheet. SparringMap is a direct screen on the root
// AppStack (not nested), so the config stays flat.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL('/'), 'sparr://', 'https://sparrapp.com'],
  config: {
    screens: {
      SparringMap: 's/:focusSparringId',
    },
  },
};

function App() {
  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_600SemiBold,
    Inter_700Bold,
    // Condensed sport face for short headlines only (see src/theme/typography.ts).
    BarlowCondensed_800ExtraBold: require('./assets/fonts/BarlowCondensed-ExtraBold.ttf'),
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
          <NavigationContainer theme={NAV_THEME} linking={linking}>
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
