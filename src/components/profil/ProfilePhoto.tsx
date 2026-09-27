import React, { useState } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import { getInitials } from '../../utils/initials';

// Profile photo with the Sparr frame (rounded, thin dark contour, white inset).
// Shared by the profile header and "Profil bearbeiten".
export default function ProfilePhoto({ uri, name, size }: {
  uri:  string | null;
  name: string | null;
  size: number;
}): React.ReactElement {
  const [failed, setFailed] = useState(false);
  const hasPhoto = uri !== null && uri.length > 0 && !failed;
  const radius = Math.round(size / 4);
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: radius }]}>
      {hasPhoto ? (
        <Image
          source={{ uri: uri as string }}
          style={[styles.fill, { borderRadius: radius - 4 }]}
          onError={() => setFailed(true)}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View style={[styles.fill, styles.fallback, { borderRadius: radius - 4 }]}>
          <Text style={[styles.initials, { fontSize: Math.round(size / 3) }]}>{getInitials(name)}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    borderWidth:     2,
    borderColor:     colors.dark,
    padding:         2,
    backgroundColor: colors.card,
  },
  fill: {
    flex: 1,
  },
  fallback: {
    backgroundColor: colors.dark,
    alignItems:      'center',
    justifyContent:  'center',
  },
  initials: {
    fontWeight: '900',
    color:      colors.card,
  },
});
