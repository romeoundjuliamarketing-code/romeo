import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import WorkoutScreen from '../screens/WorkoutScreen';
import TimerScreen from '../screens/TimerScreen';
import TeamScreen from '../screens/TeamScreen';
import SettingsScreen from '../screens/SettingsScreen';
import PaywallScreen from '../screens/PaywallScreen';
import WeightHistoryScreen from '../screens/WeightHistoryScreen';
import PointsBreakdownScreen from '../screens/PointsBreakdownScreen';
import AttendanceHistoryScreen from '../screens/AttendanceHistoryScreen';
import WorkoutHistoryScreen from '../screens/WorkoutHistoryScreen';
import SparringMapScreen from '../screens/SparringMapScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import type { RootStackParamList, AuthStackParamList } from './types';
import OfflineBanner from '../components/common/OfflineBanner';

const AppStack  = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function AppNavigator({ showOnboarding }: { showOnboarding: boolean }) {
  return (
    <AppStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {showOnboarding ? (
        <AppStack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : null}
      <AppStack.Screen name="Tabs"    component={TabNavigator}  />
      <AppStack.Screen name="Team"     component={TeamScreen}     />
      <AppStack.Screen name="Settings" component={SettingsScreen} />
      <AppStack.Screen name="Paywall" component={PaywallScreen} />
      <AppStack.Screen name="WeightHistory"    component={WeightHistoryScreen}    />
      <AppStack.Screen name="PointsBreakdown" component={PointsBreakdownScreen} />
      <AppStack.Screen name="AttendanceHistory" component={AttendanceHistoryScreen} />
      <AppStack.Screen name="WorkoutHistory" component={WorkoutHistoryScreen} />
      <AppStack.Screen
        name="SparringMap"
        component={SparringMapScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <AppStack.Screen name="Workout"  component={WorkoutScreen}  />
      <AppStack.Screen name="Timer"    component={TimerScreen}    />
    </AppStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <AuthStack.Screen name="Login"    component={LoginScreen}    />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setOnboardingCompleted(null);
      return;
    }

    // Check whether this user has completed onboarding
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', session.user.id)
          .single();
        // If the column doesn't exist yet or is null, treat as not completed
        setOnboardingCompleted(data?.onboarding_completed ?? false);
      } catch {
        // Graceful fallback: skip onboarding on fetch error
        setOnboardingCompleted(true);
      }
    })();
  }, [session]);

  const isLoading = loading || (session !== null && onboardingCompleted === null);

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  if (session === null) {
    return (
      <View style={styles.root}>
        <AuthNavigator />
        <OfflineBanner />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <AppNavigator showOnboarding={onboardingCompleted === false} />
      <OfflineBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loader: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
