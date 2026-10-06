import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Platform, Alert, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Gym } from '../../hooks/useGyms';
import { routeUrl, websiteLabel } from '../../utils/gymLinks';
import { BlockTitle } from '../profil/ProfileFacts';

const COLLAPSED_LINES = 4;
// Rough threshold from which four lines are likely exceeded.
const LONG_DESCRIPTION = 200;

function openUrl(url: string): void {
  Linking.openURL(url).catch(() => {
    Alert.alert('Konnte nicht geöffnet werden', 'Bitte versuche es später erneut.');
  });
}

// "Über das Gym": the quiet close of the gym page — description, then address
// with the route right next to it, website. Every line is optional; the whole
// block disappears when nothing is known. No embedded map — the route opens in
// the platform's maps app.
export default function GymInfoSection({ gym }: { gym: Gym }): React.ReactElement | null {
  const [expanded, setExpanded] = useState(false);
  const description = gym.description?.trim() ?? '';
  const address = gym.address?.trim() ?? '';
  const route = routeUrl(Platform.OS, { address, lat: gym.lat, lng: gym.lng, label: gym.name });
  const website = gym.website_url?.trim() ?? '';
  if (description.length === 0 && address.length === 0 && route === null && website.length === 0) return null;

  const collapsible = description.length > LONG_DESCRIPTION;

  return (
    <View style={styles.block}>
      <BlockTitle>Über das Gym</BlockTitle>
      {description.length > 0 && (
        <View style={styles.descriptionWrap}>
          <Text style={styles.description} numberOfLines={collapsible && !expanded ? COLLAPSED_LINES : undefined}>
            {description}
          </Text>
          {collapsible && (
            <TouchableOpacity style={styles.link} onPress={() => setExpanded((v) => !v)} accessibilityRole="button">
              <Text style={styles.linkText}>{expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {(address.length > 0 || route !== null) && (
        <View style={styles.factRow}>
          <Ionicons name="location-outline" size={20} color={colors.accentBlue} />
          <View style={styles.flex}>
            {address.length > 0 && <Text style={styles.fact}>{address}</Text>}
            {route !== null && (
              <TouchableOpacity style={styles.link} onPress={() => openUrl(route)} accessibilityRole="link">
                <Text style={styles.linkText}>Route öffnen</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}
      {website.length > 0 && (
        <TouchableOpacity style={styles.factRow} onPress={() => openUrl(website)} accessibilityRole="link" accessibilityLabel={`Website öffnen: ${websiteLabel(website)}`}>
          <Ionicons name="globe-outline" size={20} color={colors.accentBlue} />
          <Text style={[styles.fact, styles.flex, styles.websiteText]} numberOfLines={1}>{websiteLabel(website)}</Text>
          <Ionicons name="open-outline" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  descriptionWrap: {
    gap: 0,
  },
  description: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.text,
  },
  factRow: {
    flexDirection: 'row',
    alignItems:    'flex-start',
    gap:           12,
    minHeight:     44,
    paddingTop:    4,
  },
  flex: {
    flex: 1,
  },
  fact: {
    fontSize:   15,
    lineHeight: 22,
    color:      colors.textMuted,
  },
  websiteText: {
    fontWeight: '700',
  },
  link: {
    minHeight:      44,
    justifyContent: 'center',
    alignSelf:      'flex-start',
  },
  linkText: {
    fontSize:   15,
    fontWeight: '700',
    color:      colors.accentBlueText,
  },
});
