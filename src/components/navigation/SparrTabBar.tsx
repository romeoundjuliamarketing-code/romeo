import React, { useContext, useRef } from 'react';
import { View, Text, Pressable, Animated, StyleSheet } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useReducedMotion } from 'react-native-reanimated';
import {
  BottomTabBarHeightCallbackContext,
  BottomTabBarHeightContext,
} from '@react-navigation/bottom-tabs';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { colors } from '../../theme/colors';

type IconName = React.ComponentProps<typeof MaterialCommunityIcons>['name'];

export interface TabItemConfig {
  label:    string;
  active:   IconName;
  inactive: IconName;
  /** Screen content runs visibly under the bar (map). Otherwise the bar stands on
   *  a strip in the page colour, so dark cards never scroll right behind it. */
  overContent?: boolean;
}

const ICON_SIZE = 24;

// Floating dark tab bar. It lies OVER the screens (position absolute), so its
// measured height is reported to React Navigation; screens read it through
// useTabBarOverlap() to keep their last content reachable.
export default function SparrTabBar({
  state, descriptors, navigation, insets, config,
}: BottomTabBarProps & { config: Record<string, TabItemConfig> }): React.ReactElement {
  const reportHeight = useContext(BottomTabBarHeightCallbackContext);
  const onLayout = (e: LayoutChangeEvent) => reportHeight?.(e.nativeEvent.layout.height);
  // Sits on the home indicator / Android nav bar inset; 16 where there is none.
  const bottom = insets.bottom > 0 ? insets.bottom : 16;
  const focusedRoute = state.routes[state.index];
  const overContent = focusedRoute !== undefined && config[focusedRoute.name]?.overContent === true;

  return (
    <View
      style={[styles.wrapper, !overContent && styles.wrapperBackdrop, { paddingBottom: bottom }]}
      onLayout={onLayout}
      // The strip hides content behind it, so it must not pass taps through.
      pointerEvents={overContent ? 'box-none' : 'auto'}
    >
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const cfg = config[route.name];
          const descriptor = descriptors[route.key];
          if (cfg === undefined || descriptor === undefined) return null;
          const focused = state.index === index;
          const hasBadge = descriptor.options.tabBarBadge !== undefined;

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <TabItem
              key={route.key}
              cfg={cfg}
              focused={focused}
              hasBadge={hasBadge}
              onPress={onPress}
              onLongPress={onLongPress}
            />
          );
        })}
      </View>
    </View>
  );
}

function TabItem({ cfg, focused, hasBadge, onPress, onLongPress }: {
  cfg: TabItemConfig; focused: boolean; hasBadge: boolean; onPress: () => void; onLongPress: () => void;
}): React.ReactElement {
  const scale = useRef(new Animated.Value(1)).current;
  const reducedMotion = useReducedMotion();

  // Short press-in shrink, then back to exactly 1 (timing, no spring) so the
  // icon rests sharp. Native driver: transform only.
  const pressTo = (to: number, duration: number) => {
    if (reducedMotion) return;
    Animated.timing(scale, { toValue: to, duration, useNativeDriver: true }).start();
  };

  const a11yLabel = hasBadge ? `${cfg.label}, neue Benachrichtigungen` : cfg.label;

  return (
    <Pressable
      style={styles.tab}
      onPress={onPress}
      onLongPress={onLongPress}
      onPressIn={() => pressTo(0.88, 90)}
      onPressOut={() => pressTo(1, 140)}
      accessibilityRole="tab"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ selected: focused }}
    >
      <Animated.View style={[styles.iconPill, focused && styles.iconPillActive, { transform: [{ scale }] }]}>
        <MaterialCommunityIcons
          name={focused ? cfg.active : cfg.inactive}
          size={ICON_SIZE}
          color={focused ? colors.dark : colors.tabInactive}
        />
        {hasBadge && <View style={styles.badge} />}
      </Animated.View>
      <Text
        style={[styles.label, focused && styles.labelActive]}
        numberOfLines={1}
        maxFontSizeMultiplier={1.3}
      >
        {cfg.label}
      </Text>
    </Pressable>
  );
}

// Height of the floating tab bar for content that must stay reachable above
// it. 0 outside the tab navigator (e.g. the same component in a modal).
export function useTabBarOverlap(): number {
  return useContext(BottomTabBarHeightContext) ?? 0;
}

// Last child of a tab screen's scroll content: keeps the final items above the
// floating bar.
export function TabBarSpacer(): React.ReactElement {
  const height = useTabBarOverlap();
  return <View style={[styles.spacer, { height }]} />;
}

const styles = StyleSheet.create({
  spacer: {
    width: '100%',
  },
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  wrapperBackdrop: {
    backgroundColor: colors.background,
  },
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.dark,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 8,
    shadowColor: colors.dark,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tab: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  iconPill: {
    width: 48,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconPillActive: {
    backgroundColor: colors.accentBlue,
  },
  // Small red dot (no number) for unread notifications.
  badge: {
    position: 'absolute',
    top: 2,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.deleteRed,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: colors.tabInactive,
  },
  labelActive: {
    fontWeight: '600',
    color: colors.headerTextPrimary,
  },
});
