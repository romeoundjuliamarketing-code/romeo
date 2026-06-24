import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { Venue } from '../../types/database.types';

interface Props {
  venue: Venue;
}

// Day key order Mo–So
const DAY_ORDER: string[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<string, string> = {
  mon: 'Mo',
  tue: 'Di',
  wed: 'Mi',
  thu: 'Do',
  fri: 'Fr',
  sat: 'Sa',
  sun: 'So',
};

function openAddress(address: string): void {
  void Linking.openURL('https://maps.apple.com/?q=' + encodeURIComponent(address));
}

function openInstagram(url: string): void {
  void Linking.openURL(url);
}

export default function VenueInfoSection({ venue }: Props): React.ReactElement {
  const hasDescription = venue.description !== null && venue.description.trim().length > 0;
  const hasAddress = venue.address !== null && venue.address.trim().length > 0;
  const hasCapacity = venue.capacity !== null;
  const hasOpeningHours = venue.opening_hours !== null && Object.keys(venue.opening_hours).length > 0;
  const hasTags = venue.tags !== null && venue.tags.length > 0;
  const hasInstagram = venue.instagram !== null && venue.instagram.trim().length > 0;

  return (
    <View style={styles.root}>
      {/* Description */}
      {hasDescription && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Beschreibung</Text>
          <Text style={styles.bodyText}>{venue.description}</Text>
        </View>
      )}

      {/* Venue type */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Typ</Text>
        <Text style={styles.bodyText}>{venue.venue_type}</Text>
      </View>

      {/* Address — tappable */}
      {hasAddress && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Adresse</Text>
          <TouchableOpacity
            onPress={() => openAddress(venue.address as string)}
            activeOpacity={0.7}
          >
            <View style={styles.addressRow}>
              <Ionicons name="location-outline" size={16} color={colors.accentBlue} />
              <Text style={styles.linkText}>{venue.address}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Capacity */}
      {hasCapacity && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Kapazität</Text>
          <Text style={styles.bodyText}>{venue.capacity} Personen</Text>
        </View>
      )}

      {/* Opening hours */}
      {hasOpeningHours && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Öffnungszeiten</Text>
          {DAY_ORDER.filter((key) => (venue.opening_hours as Record<string, string>)[key] !== undefined).map((key) => (
            <View key={key} style={styles.hoursRow}>
              <Text style={styles.dayLabel}>{DAY_LABELS[key]}</Text>
              <Text style={styles.bodyText}>{(venue.opening_hours as Record<string, string>)[key]}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Tags as chips */}
      {hasTags && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tags</Text>
          <View style={styles.tagRow}>
            {(venue.tags as string[]).map((tag) => (
              <View key={tag} style={styles.chip}>
                <Text style={styles.chipText}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Instagram link */}
      {hasInstagram && (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Instagram</Text>
          <TouchableOpacity
            onPress={() => openInstagram(venue.instagram as string)}
            activeOpacity={0.7}
          >
            <View style={styles.addressRow}>
              <Ionicons name="logo-instagram" size={16} color={colors.accentBlue} />
              <Text style={styles.linkText}>{venue.instagram}</Text>
            </View>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  section: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  bodyText: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 22,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkText: {
    fontSize: 15,
    color: colors.accentBlue,
    flex: 1,
  },
  hoursRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 4,
  },
  dayLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    width: 24,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    backgroundColor: colors.accentBlueSoft,
    borderWidth: 1,
    borderColor: colors.accentBlueMuted,
  },
  chipText: {
    fontSize: 13,
    color: colors.accentBlue,
    fontWeight: '500',
  },
});
