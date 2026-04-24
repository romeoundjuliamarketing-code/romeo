import React, { useEffect, useState } from 'react';
import { View, Text, Image, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface AvatarPickerProps {
  avatarUrl: string | null;
  initials: string;
  onUpload: (localUri: string) => Promise<void>;
}

export default function AvatarPicker({ avatarUrl, initials, onUpload }: AvatarPickerProps) {
  const [uploading, setUploading] = useState(false);
  // Local URI is shown immediately after picking — no waiting for profile refetch
  const [localUri, setLocalUri] = useState<string | null>(null);

  // When the network URL finally arrives from the profile, drop the local preview
  useEffect(() => {
    if (avatarUrl !== null) setLocalUri(null);
  }, [avatarUrl]);

  const displayUri = localUri ?? avatarUrl;

  async function handlePress(): Promise<void> {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) return;

    const uri = result.assets[0].uri;
    setLocalUri(uri);   // show immediately from device storage
    setUploading(true);
    await onUpload(uri);
    setUploading(false);
  }

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.8} style={styles.container}>
      {displayUri !== null ? (
        <Image
          source={{ uri: displayUri }}
          style={styles.image}
          onError={() => setLocalUri(null)}
        />
      ) : (
        <View style={styles.placeholder}>
          <Text style={styles.initials}>{initials}</Text>
        </View>
      )}

      <View style={styles.badge}>
        {uploading ? (
          <ActivityIndicator size={12} color={colors.headerTextPrimary} />
        ) : (
          <MaterialCommunityIcons name="camera" size={14} color={colors.headerTextPrimary} />
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 56,
    height: 56,
  },
  image: {
    width: 56,
    height: 56,
    borderRadius: 28,
    overflow: 'hidden', // required for borderRadius on Android
  },
  placeholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accentBlueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    color: colors.accentBlue,
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  badge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.dark,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
});
