import React from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  onImageSelected: (localUri: string) => void;
  disabled:        boolean;
}

export default function ChatImagePicker({ onImageSelected, disabled }: Props) {
  async function pick() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Berechtigung benötigt', 'Bitte erlaube den Zugriff auf deine Fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality:    0.8,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0]!.uri;
      onImageSelected(uri);
    }
  }

  return (
    <TouchableOpacity
      style={[styles.btn, disabled && styles.btnDisabled]}
      onPress={() => { void pick(); }}
      disabled={disabled}
    >
      <Ionicons name="image-outline" size={22} color={disabled ? colors.textSecondary : colors.accentBlue} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width:          40,
    height:         40,
    alignItems:     'center',
    justifyContent: 'center',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
