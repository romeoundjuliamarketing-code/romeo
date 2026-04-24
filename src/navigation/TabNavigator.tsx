import React, { useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, Animated, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';

import HomeScreen from '../screens/HomeScreen';
import TrainingScreen from '../screens/TrainingScreen';
import ProfilScreen from '../screens/ProfilScreen';
import ErnährungScreen from '../screens/ErnaehrungScreen';

const Tab = createBottomTabNavigator();

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { active: IoniconName; inactive: IoniconName; label: string }> = {
  Home:      { active: 'home', inactive: 'home-outline', label: 'Home' },
  Training:  { active: 'barbell', inactive: 'barbell-outline', label: 'Training' },
  Ernährung: { active: 'nutrition', inactive: 'nutrition-outline', label: 'Ernährung' },
  Profil:    { active: 'person', inactive: 'person-outline', label: 'Profil' },
};

// ─── Persistent animated values (module-level so they survive re-renders) ─────

const ICON_SCALES: Record<string, Animated.Value> = {
  Home: new Animated.Value(1.2),
  Training: new Animated.Value(1),
  Ernährung: new Animated.Value(1),
  Profil: new Animated.Value(1),
};

const INDICATOR_SCALES: Record<string, Animated.Value> = {
  Home: new Animated.Value(1),
  Training: new Animated.Value(0),
  Ernährung: new Animated.Value(0),
  Profil: new Animated.Value(0),
};

// ─── Animated icon ────────────────────────────────────────────────────────────

function TabIcon({ focused, name, tabName }: { focused: boolean; name: IoniconName; tabName: string }) {
  const scale = ICON_SCALES[tabName];

  const indicatorScale = INDICATOR_SCALES[tabName];

  useEffect(() => {
    if (scale === undefined || indicatorScale === undefined) return;
    Animated.spring(scale, {
      toValue: focused ? 1.2 : 1,
      useNativeDriver: true,
      damping: 10,
      stiffness: 120,
    }).start();
    Animated.spring(indicatorScale, {
      toValue: focused ? 1 : 0,
      useNativeDriver: true,
      damping: 10,
      stiffness: 120,
    }).start();
  }, [focused, scale, indicatorScale]);

  if (scale === undefined || indicatorScale === undefined) return null;

  return (
    <View style={tabStyles.iconWrap}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons
          name={name}
          size={26}
          color={focused ? colors.accentBlue : colors.inactive}
        />
      </Animated.View>
      <Animated.View style={[tabStyles.indicator, { transform: [{ scaleX: indicatorScale }] }]} />
    </View>
  );
}

// ─── Animated label ───────────────────────────────────────────────────────────

function TabLabel({ focused, label, color }: { focused: boolean; label: string; color: string }) {
  const scale = useRef(new Animated.Value(focused ? 1 : 0.88)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: focused ? 1 : 0.78,
      useNativeDriver: true,
      damping: 10,
      stiffness: 120,
    }).start();
  }, [focused, scale]);

  return (
    <Animated.Text style={[tabStyles.label, { color, transform: [{ scale }] }]}>
      {label}
    </Animated.Text>
  );
}

// ─── Navigator ────────────────────────────────────────────────────────────────

export default function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused }) => {
          const cfg = TAB_CONFIG[route.name];
          if (cfg === undefined) return null;
          return <TabIcon focused={focused} name={focused ? cfg.active : cfg.inactive} tabName={route.name} />;
        },
        tabBarLabel: ({ focused, color }) => (
          <TabLabel focused={focused} label={TAB_CONFIG[route.name]?.label ?? route.name} color={color} />
        ),
        tabBarActiveTintColor: colors.accentBlue,
        tabBarInactiveTintColor: colors.inactive,
        tabBarStyle: {
          backgroundColor: colors.tabBar,
          borderTopColor: colors.tabBarBorder,
          borderTopWidth: 1,
          height: 88,
          paddingBottom: 22,
          paddingTop: 10,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Training" component={TrainingScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Ernährung" component={ErnährungScreen} />
      <Tab.Screen name="Profil" component={ProfilScreen} />
    </Tab.Navigator>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const tabStyles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  indicator: {
    width: 20,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accentBlue,
  },
});
