import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

export type ProfileTab = 'overview' | 'record' | 'stats';

interface ProfileTabBarProps {
  activeTab: ProfileTab;
  onTabPress: (tab: ProfileTab) => void;
}

const TABS: { id: ProfileTab; label: string }[] = [
  { id: 'overview', label: 'ÜBERSICHT' },
  { id: 'record',   label: 'REKORD'    },
  { id: 'stats',    label: 'STATS'     },
];

export default function ProfileTabBar({ activeTab, onTabPress }: ProfileTabBarProps): React.ReactElement {
  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <TouchableOpacity
            key={tab.id}
            style={[styles.tab, isActive && styles.tabActive]}
            onPress={() => onTabPress(tab.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    marginBottom: 8,
  },
  tab: {
    flex: 1,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.accentBlue,
  },
  tabText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.inactive,
    letterSpacing: 0.5,
  },
  tabTextActive: {
    color: colors.accentBlue,
  },
});
