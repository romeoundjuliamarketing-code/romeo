import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TabNavigator from './TabNavigator';
import SettingsScreen from '../screens/SettingsScreen';
import ImpressumScreen from '../screens/ImpressumScreen';
import SparringRulesScreen from '../screens/SparringRulesScreen';
import BlockedUsersScreen from '../screens/BlockedUsersScreen';
import PaywallScreen from '../screens/PaywallScreen';
import SparringMapScreen from '../screens/SparringMapScreen';
import PublicProfileScreen from '../screens/PublicProfileScreen';
import SparringChatListScreen  from '../screens/SparringChatListScreen';
import SparringGroupChatScreen from '../screens/SparringGroupChatScreen';
import EventGroupChatScreen    from '../screens/EventGroupChatScreen';
import GymDetailScreen from '../screens/GymDetailScreen';
import GymEditScreen from '../screens/GymEditScreen';
import GymFightersScreen from '../screens/GymFightersScreen';
import VenueDetailScreen from '../screens/VenueDetailScreen';
import StudioRequestsScreen from '../screens/studio/StudioRequestsScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SparringChallengeScreen from '../screens/SparringChallengeScreen';
import CardGameGate from '../components/challenge/CardGameGate';
import EditProfileScreen from '../screens/EditProfileScreen';
import VerificationScreen from '../screens/VerificationScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
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
import { NotificationsProvider } from '../context/NotificationsContext';
import { markWelcomeIntroSeen, useWelcomeIntroSeen } from '../lib/welcomeIntro';
import { authInitialRoute, isEntryLoading } from '../utils/authEntry';

const AppStack  = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function GatedChallenge(): React.ReactElement {
  return <CardGameGate><SparringChallengeScreen /></CardGameGate>;
}

function AppNavigator({ showOnboarding }: { showOnboarding: boolean }) {
  return (
    <NotificationsProvider>
    <AppStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      {showOnboarding ? (
        <AppStack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : null}
      <AppStack.Screen name="Tabs"    component={TabNavigator}  />
      <AppStack.Screen name="Settings" component={SettingsScreen} />
      <AppStack.Screen name="Impressum" component={ImpressumScreen} />
      <AppStack.Screen name="SparringRules" component={SparringRulesScreen} />
      <AppStack.Screen name="BlockedUsers" component={BlockedUsersScreen} />
      {/* Regular push: editing is part of the profile flow, not a stacked sheet */}
      <AppStack.Screen name="EditProfile" component={EditProfileScreen} />
      <AppStack.Screen
        name="Verification"
        component={VerificationScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen name="Paywall" component={PaywallScreen} />
      <AppStack.Screen
        name="SparringMap"
        component={SparringMapScreen}
        options={{ presentation: 'fullScreenModal' }}
      />
      <AppStack.Screen name="PublicProfile" component={PublicProfileScreen} />
      {/* Regular push: profiles opened from the gym page stack above it */}
      <AppStack.Screen name="GymDetail" component={GymDetailScreen} />
      <AppStack.Screen name="GymFighters" component={GymFightersScreen} />
      <AppStack.Screen name="GymEdit" component={GymEditScreen} />
      <AppStack.Screen name="SparringChatList"  component={SparringChatListScreen}  />
      <AppStack.Screen name="SparringGroupChat" component={SparringGroupChatScreen} />
      <AppStack.Screen name="EventGroupChat"    component={EventGroupChatScreen}    />
      <AppStack.Screen
        name="VenueDetail"
        component={VenueDetailScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen
        name="StudioRequests"
        component={StudioRequestsScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ presentation: 'modal' }}
      />
      <AppStack.Screen
        name="SparringChallenge"
        component={GatedChallenge}
        // A stage of its own: full screen, nothing of the previous page behind it.
        options={{ presentation: 'fullScreenModal' }}
      />
    </AppStack.Navigator>
    </NotificationsProvider>
  );
}

function AuthNavigator({ introSeen }: { introSeen: boolean }) {
  return (
    <AuthStack.Navigator
      initialRouteName={authInitialRoute(introSeen)}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}
    >
      <AuthStack.Screen name="Welcome"     component={WelcomeScreen}     />
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
  const introSeen = useWelcomeIntroSeen();

  // Anyone who has been signed in is an existing user: the intro must never
  // show up after their logout.
  useEffect(() => {
    if (session !== null && introSeen === false) markWelcomeIntroSeen();
  }, [session, introSeen]);

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

  const isLoading = isEntryLoading(loading, session !== null, introSeen)
    || (session !== null && onboardingCompleted === null);

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
        <AuthNavigator introSeen={introSeen === true} />
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
