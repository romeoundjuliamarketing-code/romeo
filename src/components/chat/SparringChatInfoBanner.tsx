import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  address:     string;
  signupCount: number;
  maxSlots:    number;
}

export default function SparringChatInfoBanner({ address, signupCount, maxSlots }: Props) {
  function openMaps() {
    const encoded = encodeURIComponent(address);
    const url = Platform.OS === 'ios'
      ? `maps://maps.apple.com/?q=${encoded}`
      : `geo:0,0?q=${encoded}`;
    void Linking.openURL(url);
  }

  return (
    <View style={styles.banner}>
      <TouchableOpacity style={styles.addressRow} onPress={openMaps} activeOpacity={0.7}>
        <Ionicons name="location-outline" size={13} color={colors.accentBlue} />
        <Text style={styles.addressText} numberOfLines={1}>{address}</Text>
        <Ionicons name="chevron-forward" size={12} color={colors.accentBlue} />
      </TouchableOpacity>
      <View style={styles.divider} />
      <View style={styles.slotsRow}>
        <Ionicons name="people-outline" size={13} color={colors.textSecondary} />
        <Text style={styles.slotsText}>{signupCount} von {maxSlots} angemeldet</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection:     'row',
    alignItems:        'center',
    paddingHorizontal: 16,
    paddingVertical:    8,
    backgroundColor:   colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap:               8,
  },
  addressRow: {
    flex:          1,
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
    minWidth:      0,
  },
  addressText: {
    flex:       1,
    fontSize:   13,
    color:      colors.accentBlue,
    fontWeight: '500',
  },
  divider: {
    width:           1,
    height:          16,
    backgroundColor: colors.border,
  },
  slotsRow: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           4,
  },
  slotsText: {
    fontSize: 13,
    color:    colors.textSecondary,
  },
});
