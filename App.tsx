import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { useFonts, Inter_400Regular, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { View, ActivityIndicator } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as Sentry from '@sentry/react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { AuthProvider } from './src/context/AuthContext';
import { colors } from './src/theme/colors';
import { configureRevenueCat } from './src/lib/revenuecat';

// Crash + error reporting. DSN comes from the env; if it is missing Sentry stays
// inert (no crash), so the app still runs before the DSN is configured.
Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  // debug logs the event pipeline to the console — useful while verifying the setup.
  debug: __DEV__,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
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

  // TEMP: fire one test event to verify the Sentry wiring. REMOVE after confirming.
  useEffect(() => {
    const t = setTimeout(() => {
      Sentry.captureException(new Error('Sentry Verifizierungs-Test (iOS Sim)'));
    }, 3000);
    return () => clearTimeout(t);
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer theme={NAV_THEME}>
          <StatusBar style="dark" backgroundColor={colors.background} />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap enables automatic error-boundary + native crash capture.
export default Sentry.wrap(App);
