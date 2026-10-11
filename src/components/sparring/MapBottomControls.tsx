import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { useTranslation } from 'react-i18next';

interface Props {
  onChat:       () => void;
  totalUnread:  number;
  /** Main action label; null hides it (studio mode has no create action). */
  primaryLabel: string | null;
  onPrimary:    () => void;
}

// One row along the bottom edge of the map: secondary tools left in one
// shared surface (sparring chats), the main action fills the rest.
// The screen stacks the sparring preview above it, so nothing overlaps.
export default function MapBottomControls({
  onChat, totalUnread, primaryLabel, onPrimary,
}: Props): React.ReactElement {
  const { t } = useTranslation();
  return (
    <View style={styles.row} pointerEvents="box-none">
      <View style={styles.tools}>
        <TouchableOpacity
          style={styles.toolBtn}
          onPress={onChat}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel={totalUnread > 0 ? t('map.bottom.chatsUnread', { count: totalUnread }) : t('map.bottom.chats')}
        >
          <Ionicons name="chatbubbles-outline" size={20} color={colors.text} />
          {totalUnread > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalUnread > 99 ? '99+' : String(totalUnread)}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {primaryLabel !== null && (
        <View style={styles.primaryWrap}>
          <TouchableOpacity
            style={styles.primary}
            onPress={onPrimary}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Ionicons name="add" size={20} color={colors.card} />
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const SHADOW = {
  shadowColor:   colors.dark,
  shadowOffset:  { width: 0, height: 1 },
  shadowOpacity: 0.15,
  shadowRadius:  4,
  elevation:     4,
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           8,
  },
  tools: {
    flexDirection:   'row',
    height:          48,
    borderRadius:    16,
    backgroundColor: colors.card,
    ...SHADOW,
  },
  toolBtn: {
    width:          48,
    height:         48,
    alignItems:     'center',
    justifyContent: 'center',
  },
  badge: {
    position:          'absolute',
    top:               4,
    right:             4,
    minWidth:          18,
    height:            18,
    borderRadius:      9,
    backgroundColor:   colors.deleteRed,
    alignItems:        'center',
    justifyContent:    'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    fontSize:   10,
    fontWeight: '700',
    color:      colors.card,
  },
  primaryWrap: { flex: 1 },
  primary: {
    flexDirection:     'row',
    alignItems:        'center',
    justifyContent:    'center',
    gap:               8,
    height:            48,
    borderRadius:      16,
    paddingHorizontal: 16,
    backgroundColor:   colors.accentBlue,
    ...SHADOW,
  },
  primaryText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.card,
  },
});
