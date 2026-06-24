import React from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import type { VenuePhoto } from '../../types/database.types';

interface Props {
  photos: VenuePhoto[];
  editable: boolean;
  onAdd?: () => void;
  onRemovePhoto?: (id: string) => void;
}

const TILE_SIZE = 120;

export default function VenuePhotoGallery({
  photos,
  editable,
  onAdd,
  onRemovePhoto,
}: Props): React.ReactElement {
  const isEmpty = photos.length === 0;

  // Empty, non-editable state
  if (isEmpty && !editable) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Noch keine Fotos vorhanden.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scrollContent}
      style={styles.scrollView}
    >
      {/* Leading "add photo" tile when editable */}
      {editable && (
        <TouchableOpacity style={styles.addTile} onPress={onAdd} activeOpacity={0.8}>
          <Ionicons name="add" size={32} color={colors.textSecondary} />
          <Text style={styles.addLabel}>Foto{'\n'}hinzufügen</Text>
        </TouchableOpacity>
      )}

      {photos.map((photo) => (
        <View key={photo.id} style={styles.tile}>
          <Image source={{ uri: photo.url }} style={styles.tileImage} />
          {editable && (
            <TouchableOpacity
              style={styles.deleteOverlay}
              onPress={() => onRemovePhoto?.(photo.id)}
              activeOpacity={0.8}
            >
              <Ionicons name="close" size={14} color={colors.card} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  emptyContainer: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  addTile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    backgroundColor: colors.darkMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  addLabel: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  tile: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
  },
  tileImage: {
    width: TILE_SIZE,
    height: TILE_SIZE,
    borderRadius: 8,
    resizeMode: 'cover',
  },
  deleteOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.heroFloatingBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
