import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { colors } from '../../theme/colors';
import ProfilePhoto from './ProfilePhoto';

const ZOOM_MAX = 360;
const ZOOM_GUTTER = 48;

// Profile photo that enlarges on long press (own profile tab and foreign profiles).
// The enlarged view sits in a transparent Modal over everything; a tap anywhere
// or the Android back button closes it. Without a photo (initials only) there is
// nothing to enlarge, so the long press is disabled.
export default function ZoomableProfilePhoto({ uri, name, size }: {
  uri:  string | null;
  name: string | null;
  size: number;
}): React.ReactElement {
  const { width } = useWindowDimensions();
  const [zoomed, setZoomed] = useState(false);
  const hasPhoto = uri !== null && uri.length > 0;
  const zoomSize = Math.min(width - ZOOM_GUTTER, ZOOM_MAX);

  return (
    <>
      <Pressable
        onLongPress={() => setZoomed(true)}
        delayLongPress={300}
        disabled={!hasPhoto}
        accessibilityRole={hasPhoto ? 'imagebutton' : 'image'}
        accessibilityLabel="Profilbild"
        accessibilityHint={hasPhoto ? 'Gedrückt halten zum Vergrößern' : undefined}
        accessibilityActions={hasPhoto ? [{ name: 'longpress', label: 'Profilbild vergrößern' }] : undefined}
        onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'longpress') setZoomed(true); }}
      >
        <ProfilePhoto uri={uri} name={name} size={size} />
      </Pressable>

      <Modal
        visible={zoomed}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setZoomed(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setZoomed(false)}
          accessibilityRole="button"
          accessibilityLabel="Vergrößertes Profilbild schließen"
        >
          {zoomed && (
            // ZoomIn ends exactly at scale 1, so the photo rests sharp.
            <Animated.View entering={ZoomIn.duration(180)}>
              <View pointerEvents="none">
                <ProfilePhoto uri={uri} name={name} size={zoomSize} />
              </View>
            </Animated.View>
          )}
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex:            1,
    backgroundColor: colors.mapOverlay,
    alignItems:      'center',
    justifyContent:  'center',
  },
});
