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
import PublicProfileScreen from '../screens/PublicProfileScreen';
import SparringChatListScreen  from '../screens/SparringChatListScreen';
import SparringGroupChatScreen from '../screens/SparringGroupChatScreen';
import EventGroupChatScreen    from '../screens/EventGroupChatScreen';
import StudioDetailScreen from '../screens/StudioDetailScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import VerificationScreen from '../screens/VerificationScreen';
import StudioProfileEditScreen from '../screens/StudioProfileEditScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { useAuth } from '../context/AuthContext';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { supabase } from '../lib/supabase';
import { colors } from '../theme/colors';
import type { RootStackParamList, AuthStackParamList } from './types';
import OfflineBanner from '../components/common/OfflineBanner';
import CacheWarmer from '../components/common/CacheWarmer';
import { getCached, setCached } from '../lib/queryCache';
import { onboardingCacheKey } from '../lib/onboardingCache';

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
      <AppStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{ presentation: 'modal' }}
      />
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
      <AppStack.Screen name="PublicProfile" component={PublicProfileScreen} />
      <AppStack.Screen name="SparringChatList"  component={SparringChatListScreen}  />
      <AppStack.Screen name="SparringGroupChat" component={SparringGroupChatScreen} />
      <AppStack.Screen name="EventGroupChat"    component={EventGroupChatScreen}    />
      <AppStack.Screen
        name="StudioDetail"
        component={StudioDetailScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen
        name="StudioProfileEdit"
        component={StudioProfileEditScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen name="Workout"  component={WorkoutScreen}  />
      <AppStack.Screen name="Timer"    component={TimerScreen}    />
      <AppStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal' }}
      />
    </AppStack.Navigator>
  );
}

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <AuthStack.Screen name="Login"       component={LoginScreen}       />
      <AuthStack.Screen name="Register"    component={RegisterScreen}    />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
    </AuthStack.Navigator>
  );
}

export default function RootNavigator() {
  const { session, loading } = useAuth();
  const { recoveryActive, endRecovery } = usePasswordRecovery();
  const [onboardingCompleted, setOnboardingCompleted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!session) {
      setOnboardingCompleted(null);
      return;
    }

    const userId = session.user.id;
    let cancelled = false;

    // Fast path: a returning, already-onboarded user. queryCache is hydrated
    // before any UI renders, so this read is synchronous — the app unblocks at
    // once. We only short-circuit on `true`; "not completed" is rare (brand-new
    // users) and worth waiting for the authoritative answer to avoid flashing
    // the onboarding screen. The flag lives in queryCache so it is cleared on
    // sign-out / account switch, unlike a standalone AsyncStorage key.
    const cached = getCached<boolean>(onboardingCacheKey(userId));
    if (cached === true) {
      setOnboardingCompleted(true);
    }

    // Revalidate against the server (silently if we already unblocked above).
    void (async () => {
      try {
        const { data } = await supabase
          .from('profiles')
          .select('onboarding_completed')
          .eq('id', userId)
          .single();
        // If the column doesn't exist yet or is null, treat as not completed
        const value = data?.onboarding_completed ?? false;
        if (!cancelled) setOnboardingCompleted(value);
        setCached<boolean>(onboardingCacheKey(userId), value);
      } catch {
        // Graceful fallback: skip onboarding on fetch error (only if we have
        // no cached answer to fall back on)
        if (!cancelled && cached === undefined) setOnboardingCompleted(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [session]);

  // Password recovery deep link takes priority over normal auth routing:
  // the user arrived here from the email link to set a new password.
  if (recoveryActive) {
    return (
      <View style={styles.root}>
        <ResetPasswordScreen onDone={endRecovery} />
        <OfflineBanner />
      </View>
    );
  }

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
      {onboardingCompleted !== false && <CacheWarmer />}
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
