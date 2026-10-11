import React, { useEffect } from 'react';
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
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import LoginScreen from '../screens/auth/LoginScreen';
import RegisterScreen from '../screens/auth/RegisterScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import ResetPasswordScreen from '../screens/auth/ResetPasswordScreen';
import { useAuth } from '../context/AuthContext';
import { usePasswordRecovery } from '../hooks/usePasswordRecovery';
import { colors } from '../theme/colors';
import type { RootStackParamList, AuthStackParamList } from './types';
import OfflineBanner from '../components/common/OfflineBanner';
import CacheWarmer from '../components/common/CacheWarmer';
import { NotificationsProvider } from '../context/NotificationsContext';
import { markWelcomeIntroSeen, useWelcomeIntroSeen } from '../lib/welcomeIntro';
import { authInitialRoute, isEntryLoading } from '../utils/authEntry';
import { useOnboardingGate } from '../hooks/useOnboardingGate';
import { TourProvider } from '../context/TourContext';
import TourOverlay from '../components/tour/TourOverlay';
import OnboardingScreen, { OnboardingGateError, OnboardingPreview } from '../screens/OnboardingScreen';

// Dev-only visual check: with EXPO_PUBLIC_PREVIEW_ONBOARDING=1 both onboarding
// steps show without an account; nothing is saved.
const PREVIEW_ONBOARDING = __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_ONBOARDING === '1';
// Dev-only: EXPO_PUBLIC_PREVIEW_TOUR=1 starts the coach tour on every app
// start for a signed-in account, without saving any tour state.
const PREVIEW_TOUR = __DEV__ && process.env.EXPO_PUBLIC_PREVIEW_TOUR === '1';

const AppStack  = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

function GatedChallenge(): React.ReactElement {
  return <CardGameGate><SparringChallengeScreen /></CardGameGate>;
}

// `tourEntry`: first entry right after the onboarding (or the tour preview)
// opens the own profile, where the coach tour starts, instead of Home.
function AppNavigator({ tourEntry }: { tourEntry: boolean }) {
  return (
    <NotificationsProvider>
    <AppStack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: 'transparent' } }}>
      <AppStack.Screen
        name="Tabs"
        component={TabNavigator}
        initialParams={tourEntry ? { screen: 'Profil' } : undefined}
      />
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
  const { session, loading, signOut } = useAuth();
  const { recoveryActive, endRecovery } = usePasswordRecovery();
  const introSeen = useWelcomeIntroSeen();
  // Decided before any app screen renders, so Home never flashes up first.
  const onboarding = useOnboardingGate(session?.user.id ?? null);

  // Anyone who has been signed in is an existing user: the intro must never
  // show up after their logout.
  useEffect(() => {
    if (session !== null && introSeen === false) markWelcomeIntroSeen();
  }, [session, introSeen]);

  if (PREVIEW_ONBOARDING) return <OnboardingPreview />;

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

  const isLoading = isEntryLoading(loading, session !== null, introSeen);

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

  if (onboarding.status === 'loading') {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={colors.accentBlue} />
      </View>
    );
  }

  if (onboarding.status === 'error') {
    return (
      <View style={styles.root}>
        <OnboardingGateError onRetry={onboarding.retry} onSignOut={() => { void signOut(); }} />
        <OfflineBanner />
      </View>
    );
  }

  if (onboarding.route !== null && onboarding.route !== 'done' && onboarding.state !== null) {
    const meta = session.user.user_metadata as Record<string, unknown> | undefined;
    const providerName = typeof meta?.full_name === 'string' ? meta.full_name
      : typeof meta?.name === 'string' ? meta.name : null;
    return (
      <View style={styles.root}>
        <OnboardingScreen
          userId={session.user.id}
          route={onboarding.route}
          state={onboarding.state}
          fallbackName={providerName}
          onSaveProfile={onboarding.saveProfile}
          onComplete={onboarding.complete}
          onBackToProfile={onboarding.backToProfile}
          onSignOut={() => { void signOut(); }}
        />
        <OfflineBanner />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* The tour is active from the first frame, so no page shows up unaccompanied. */}
      <TourProvider
        initialStatus={onboarding.state?.tour_status ?? null}
        initialStation={onboarding.state?.tour_station ?? null}
        autoStart={onboarding.finishedAt !== null || PREVIEW_TOUR}
        persistEnabled={!PREVIEW_TOUR}
        userName={onboarding.state?.name ?? null}
      >
        <AppNavigator tourEntry={onboarding.finishedAt !== null || PREVIEW_TOUR} />
        <TourOverlay layer="root" />
      </TourProvider>
      <CacheWarmer />
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
