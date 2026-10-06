import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { View, Text, Pressable, TouchableOpacity, BackHandler, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

export interface GymMenuItem {
  key:          string;
  icon:         IconName;
  label:        string;
  onPress:      () => void;
  destructive?: boolean;
}

// Menu of the gym page by role. Operator items only from real rights
// (owner of the row / confirmed coach); the home gym grants none.
export function gymMenuItems(f: {
  isOwner: boolean; canHandleRequests: boolean; isHome: boolean; hasLegacy: boolean;
  onEdit: () => void; onRequests: () => void; onCorrection: () => void;
  onSwitchHome: () => void; onRemoveHome: () => void; onLegacy: () => void;
}): GymMenuItem[] {
  const items: GymMenuItem[] = [];
  if (f.isOwner) items.push({ key: 'edit', icon: 'create-outline', label: i18n.t('gym.menu.edit'), onPress: f.onEdit });
  if (f.canHandleRequests) items.push({ key: 'requests', icon: 'mail-outline', label: i18n.t('gym.menu.requests'), onPress: f.onRequests });
  if (!f.isOwner) items.push({ key: 'correction', icon: 'flag-outline', label: i18n.t('gym.menu.correction'), onPress: f.onCorrection });
  if (f.isHome) {
    items.push({ key: 'switch', icon: 'swap-horizontal', label: i18n.t('gym.menu.switchHome'), onPress: f.onSwitchHome });
    items.push({ key: 'remove', icon: 'remove-circle-outline', label: i18n.t('gym.menu.removeHome'), onPress: f.onRemoveHome, destructive: true });
  }
  if (f.hasLegacy) items.push({ key: 'legacy', icon: 'document-text-outline', label: i18n.t('gym.menu.legacy'), onPress: f.onLegacy });
  return items;
}

// Quiet action menu of the gym page, drawn inside the screen (no extra
// Modal): whatever an item opens afterwards — a sheet or a new screen —
// appears above it without stacking modals. Android back closes it.
export default function GymMenu({ visible, items, onClose }: {
  visible: boolean;
  items:   GymMenuItem[];
  onClose: () => void;
}): React.ReactElement | null {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => sub.remove();
  }, [visible, onClose]);

  if (!visible) return null;
  return (
    <View style={StyleSheet.absoluteFill}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel={t('gym.menu.close')} />
      <Animated.View
        entering={FadeIn.duration(120)}
        exiting={FadeOut.duration(100)}
        style={[styles.menu, { top: insets.top + 56 }]}
        accessibilityViewIsModal
      >
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.item, i > 0 && styles.itemBorder]}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            accessibilityRole="menuitem"
          >
            <Ionicons name={item.icon} size={20} color={item.destructive === true ? colors.deleteRed : colors.accentBlue} />
            <Text style={[styles.label, item.destructive === true && styles.labelDestructive]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  menu: {
    position:        'absolute',
    right:           16,
    minWidth:        240,
    maxWidth:        320,
    borderRadius:    16,
    overflow:        'hidden',
    backgroundColor: colors.card,
    shadowColor:     colors.dark,
    shadowOpacity:   0.18,
    shadowRadius:    16,
    shadowOffset:    { width: 0, height: 8 },
    elevation:       8,
  },
  item: {
    flexDirection:     'row',
    alignItems:        'center',
    gap:               16,
    minHeight:         48,
    paddingHorizontal: 16,
    paddingVertical:   8,
  },
  itemBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.hairline,
  },
  label: {
    flex:       1,
    fontSize:   16,
    fontWeight: '600',
    color:      colors.text,
  },
  labelDestructive: {
    color: colors.deleteRed,
  },
});
