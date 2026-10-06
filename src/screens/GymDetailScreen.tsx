import React, { useCallback, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../navigation/types';
import { useAuth } from '../context/AuthContext';
import { useFocusRefetch } from '../hooks/useFocusRefetch';
import { useProfile } from '../hooks/useProfile';
import { useMyStudioRequests } from '../hooks/useMyStudioRequests';
import { useGym, useGymFighters, useGymSparrings } from '../hooks/useGyms';
import { useHomeGymChoice } from '../hooks/useHomeGymChoice';
import FocusedStatusBar from '../components/common/FocusedStatusBar';
import { isRunningContract, isRunningTrial } from '../components/profil/MyRequestsCard';
import GymHero, { GYM_PAGE_GUTTER, coverHeight } from '../components/gym/GymHero';
import GymTopBar, { GYM_BAR_HEIGHT, useGymBarScroll } from '../components/gym/GymTopBar';
import GymMainSections from '../components/gym/GymMainSections';
import GymHomeAction from '../components/gym/GymHomeAction';
import GymInfoSection from '../components/gym/GymInfoSection';
import GymMenu, { gymMenuItems } from '../components/gym/GymMenu';
import GymPageState from '../components/gym/GymPageState';
import GymPickerSheet from '../components/gym/GymPickerSheet';
import GymCorrectionSheet from '../components/gym/GymCorrectionSheet';
import GymLegacySheet from '../components/gym/GymLegacySheet';

type Nav = NativeStackNavigationProp<RootStackParamList, 'GymDetail'>;
type Route = RouteProp<RootStackParamList, 'GymDetail'>;

const PREVIEW_FIGHTERS = 8;

// Compact gym page: recognise the gym, see the team, organise a sparring,
// find the facts. Order once the sparrings have loaded: with an upcoming
// sparring it comes before the team, otherwise the team leads and the empty
// sparring block follows. Operators see the same page; editing, the main-gym
// switch and running legacy matters sit in the menu. One top bar (GymTopBar)
// turns opaque with the gym name once the head has scrolled away.
export default function GymDetailScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { gymId } = useRoute<Route>().params;
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [focusTrigger, setFocusTrigger] = useState(0);
  const refresh = useCallback(() => setFocusTrigger((n) => n + 1), []);
  useFocusRefetch(refresh);

  const { gym, status, refetch } = useGym(gymId, focusTrigger);
  const { profile, updateProfile } = useProfile(focusTrigger);
  const homeGymId = profile?.home_gym_id ?? null;
  const { gym: otherHomeGym } = useGym(homeGymId !== null && homeGymId !== gymId ? homeGymId : null);
  const fighters = useGymFighters(gymId, focusTrigger, PREVIEW_FIGHTERS);
  const sparrings = useGymSparrings(gymId, focusTrigger);
  const { trialBookings, contracts } = useMyStudioRequests(focusTrigger);

  const home = useHomeGymChoice({
    currentHomeGymId:   homeGymId,
    currentHomeGymName: otherHomeGym?.name ?? null,
    updateProfile,
    onChanged:          refresh,
  });

  const [menuVisible, setMenuVisible] = useState(false);
  const closeMenu = useCallback(() => setMenuVisible(false), []);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [correctionVisible, setCorrectionVisible] = useState(false);
  const [legacyVisible, setLegacyVisible] = useState(false);

  const [nameBottom, setNameBottom] = useState<number | null>(null);
  const solidFrom = (gym !== null ? coverHeight(gym) : 0) - GYM_BAR_HEIGHT;
  const { scrollY, onScroll, barSolid } = useGymBarScroll(solidFrom);

  if (gym === null) {
    return <GymPageState status={status} onBack={() => navigation.goBack()} onRetry={refetch} />;
  }

  const isHome = homeGymId === gym.id;
  // Rights come only from the operator role on the gym row (checked again by
  // RLS on save) or the confirmed coach team — never from "Hier trainiere ich".
  const isOwner = user !== null && gym.owner_user_id === user.id;
  const canHandleRequests = isOwner || (profile?.is_coach === true && profile.studio_id === gym.id);
  const hasLegacy = trialBookings.some((b) => b.studio_id === gym.id && isRunningTrial(b))
    || contracts.some((c) => c.studio_id === gym.id && isRunningContract(c));

  const planSparring = () => navigation.navigate('SparringMap', { openCreate: true, createAtGymId: gym.id });
  const openProfile = (userId: string) => navigation.push('PublicProfile', { userId });

  const menuItems = gymMenuItems({
    isOwner, canHandleRequests, isHome, hasLegacy,
    onEdit:       () => navigation.navigate('GymEdit', { gymId: gym.id }),
    onRequests:   () => navigation.navigate('StudioRequests', { studioId: gym.id }),
    onCorrection: () => setCorrectionVisible(true),
    onSwitchHome: () => setPickerVisible(true),
    onRemoveHome: () => { void home.remove(); },
    onLegacy:     () => setLegacyVisible(true),
  });

  return (
    <View style={styles.safe}>
      <FocusedStatusBar style={barSolid ? 'dark' : 'light'} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]}
        showsVerticalScrollIndicator={false}
      >
        <GymHero gym={gym} isHome={isHome} onNameBottom={setNameBottom} />

        <View style={styles.page}>
          {profile !== null && !isHome && (
            <GymHomeAction busy={home.busy} onSet={() => { void home.choose(gym); }} />
          )}

          <GymMainSections
            fighters={fighters}
            sparrings={sparrings}
            onOpenFighters={() => navigation.push('GymFighters', { gymId: gym.id, gymName: gym.name })}
            onOpenProfile={openProfile}
            onOpenSparring={(id) => navigation.navigate('SparringMap', { focusSparringId: id })}
            onPlan={planSparring}
          />

          <GymInfoSection gym={gym} />
        </View>
      </Animated.ScrollView>

      <GymTopBar
        title={gym.name}
        scrollY={scrollY}
        solidFrom={solidFrom}
        titleFrom={(nameBottom ?? solidFrom + 64) - insets.top - GYM_BAR_HEIGHT}
        onBack={() => navigation.goBack()}
        onMenu={() => setMenuVisible(true)}
      />
      <GymMenu visible={menuVisible} items={menuItems} onClose={closeMenu} />

      <GymPickerSheet
        visible={pickerVisible}
        title="Hauptgym ändern"
        currentGymId={homeGymId}
        onClose={() => setPickerVisible(false)}
        onSelect={home.choose}
        removeLabel="Als Hauptgym entfernen"
        onRemove={home.remove}
      />
      {!isOwner && <GymCorrectionSheet gym={gym} visible={correctionVisible} onClose={() => setCorrectionVisible(false)} />}
      {(hasLegacy || legacyVisible) && <GymLegacySheet visible={legacyVisible} studioId={gym.id} onClose={() => setLegacyVisible(false)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: colors.background,
  },
  content: {
    flexGrow: 1,
  },
  page: {
    width:             '100%',
    maxWidth:          600,
    alignSelf:         'center',
    paddingHorizontal: GYM_PAGE_GUTTER,
    paddingTop:        24,
    gap:               32,
  },
});
