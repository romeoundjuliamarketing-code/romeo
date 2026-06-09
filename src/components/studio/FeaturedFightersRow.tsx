import React from 'react';
import {
  ScrollView,
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors } from '../../theme/colors';
import type { FeaturedFighter } from '../../hooks/useFeaturedFighters';
import type { RootStackParamList } from '../../navigation/types';

const CARD_SIZE = 80;

function getInitials(name: string | null): string {
  if (name === null || name.trim().length === 0) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

interface Props {
  fighters: FeaturedFighter[];
  loading: boolean;
  currentUserId: string | null;
  onRemoveSelf: () => void;
}

export default function FeaturedFightersRow({
  fighters,
  loading,
  currentUserId,
  onRemoveSelf,
}: Props): React.ReactElement | null {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator color={colors.accentBlue} />
      </View>
    );
  }

  if (fighters.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {fighters.map((f) => {
        const isSelf = f.userId === currentUserId;
        return (
          <TouchableOpacity
            key={f.id}
            style={styles.card}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('PublicProfile', { userId: f.userId })}
          >
            {f.avatarUrl !== null ? (
              <Image source={{ uri: f.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.initials}>{getInitials(f.name)}</Text>
              </View>
            )}
            <Text style={styles.fighterName} numberOfLines={1}>
              {f.name ?? 'Unbekannt'}
            </Text>
            {f.discipline !== null && (
              <Text style={styles.fighterMeta} numberOfLines={1}>{f.discipline}</Text>
            )}
            {isSelf && (
              <TouchableOpacity
                style={styles.removeBtn}
                onPress={onRemoveSelf}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Ionicons name="close-circle" size={20} color={colors.deleteRed} />
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  card: {
    width: CARD_SIZE + 16,
    alignItems: 'center',
    gap: 6,
  },
  avatar: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
  },
  avatarPlaceholder: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: CARD_SIZE / 2,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentBlue,
  },
  fighterName: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    width: CARD_SIZE + 16,
  },
  fighterMeta: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  removeBtn: {
    position: 'absolute',
    top: -4,
    right: 0,
  },
});
