import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import TrainingScreen from '../screens/TrainingScreen';
import ProfilScreen from '../screens/ProfilScreen';
import CoachScreen from '../screens/CoachScreen';

const Tab = createBottomTabNavigator();

const tabIcons: Record<string, string> = {
  Home:     '⌂',
  Training: '◎',
  Profil:   '○',
};

// ─── Shared icon wrapper with 2px underline indicator ─────────────────────────

function TabIcon({ focused, children }: { focused: boolean; children: React.ReactNode }) {
  return (
    <View style={tabStyles.iconWrap}>
      {children}
      <View style={[tabStyles.indicator, focused && tabStyles.indicatorActive]} />
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => (
          <TabIcon focused={focused}>
            <Text style={focused ? tabStyles.iconActive : tabStyles.iconInactive}>
              {tabIcons[route.name]}
            </Text>
          </TabIcon>
        ),
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTitleStyle: {
          color: colors.text,
          fontWeight: '700',
          fontSize: 18,
        },
        headerShadowVisible: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Training" component={TrainingScreen} options={{ headerShown: false }} />
      <Tab.Screen
        name="Coach"
        component={CoachScreen}
        options={{
          tabBarLabel: 'Coach',
          tabBarIcon: ({ focused }) => (
            <TabIcon focused={focused}>
              <Ionicons
                name="ellipse-outline"
                size={20}
                style={focused ? tabStyles.iconActive : tabStyles.iconInactive}
              />
            </TabIcon>
          ),
        }}
      />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    gap: 4,
  },
  iconActive: {
    fontSize: 20,
    color: colors.accentBlue,
  },
  iconInactive: {
    fontSize: 20,
    color: colors.inactive,
  },
  indicator: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: 'transparent',
  },
  indicatorActive: {
    backgroundColor: colors.accentBlue,
  },
});
