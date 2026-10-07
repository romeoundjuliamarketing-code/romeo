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

const Tab = createBottomTabNavigator();

// Visible labels only — route names stay unchanged (deep links, navigate()).
const TAB_CONFIG: Record<string, TabItemConfig> = {
  Home:     { label: 'Start',     active: 'home',           inactive: 'home-outline' },
  Karten:   { label: 'Spiel',     active: 'cards-playing',  inactive: 'cards-playing-outline' },
  Sparring: { label: 'Entdecken', active: 'map-marker',     inactive: 'map-marker-outline', overContent: true },
  Profil:   { label: 'Profil',    active: 'account',        inactive: 'account-outline' },
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
