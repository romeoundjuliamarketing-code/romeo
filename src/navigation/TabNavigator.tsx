import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';

import HomeScreen from '../screens/HomeScreen';
import CardsScreen from '../screens/CardsScreen';
import ProfilScreen from '../screens/ProfilScreen';
import SparringMapScreen from '../screens/SparringMapScreen';
import { useNotificationsContext } from '../context/NotificationsContext';
import SparrTabBar from '../components/navigation/SparrTabBar';
import type { TabItemConfig } from '../components/navigation/SparrTabBar';
import i18n from '../i18n';

const Tab = createBottomTabNavigator();

// Visible labels only — route names stay unchanged (deep links, navigate()).
const TAB_CONFIG: Record<string, TabItemConfig> = {
  // label is a getter so it follows the active language (SparrTabBar re-renders on change).
  Home:     { get label() { return i18n.t('common.tabs.home'); },     active: 'home',           inactive: 'home-outline' },
  Karten:   { get label() { return i18n.t('common.tabs.cards'); },    active: 'cards-playing',  inactive: 'cards-playing-outline' },
  Sparring: { get label() { return i18n.t('common.tabs.discover'); }, active: 'map-marker',     inactive: 'map-marker-outline', overContent: true },
  Profil:   { get label() { return i18n.t('common.tabs.profile'); },  active: 'account',        inactive: 'account-outline' },
};

const renderTabBar = (props: BottomTabBarProps) => <SparrTabBar {...props} config={TAB_CONFIG} />;

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function TabNavigator() {
  const { unreadCount } = useNotificationsContext();
  return (
    <Tab.Navigator
      tabBar={renderTabBar}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerShown: false,
          // Red dot on the Home tab while there are unread notifications.
          tabBarBadge: unreadCount > 0 ? '' : undefined,
        }}
      />
      <Tab.Screen name="Karten" component={CardsScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Sparring" component={SparringMapScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}
