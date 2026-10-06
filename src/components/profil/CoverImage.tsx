import React, { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native';
import { coverLayout } from '../../utils/coverLayout';
import type { Focus, Size } from '../../utils/coverLayout';

// Cover photo drawn at "cover" size and shifted by the stored focus point, so
// the framing chosen in the editor is what everybody sees. Calls onError when
// the image cannot be loaded (the caller then shows the graphic fallback).
export default function CoverImage({ uri, focus, frame, onError }: {
  uri:     string;
  focus:   Focus;
  frame:   Size;
  onError: () => void;
}): React.ReactElement {
  const [natural, setNatural] = useState<Size | null>(null);

  function handleLoad(e: NativeSyntheticEvent<ImageLoadEventData>): void {
    const { width, height } = e.nativeEvent.source;
    if (width > 0 && height > 0) setNatural({ width, height });
  }

  // Until the real size is known the image simply covers the frame centred.
  const layout = natural !== null ? coverLayout(frame, natural, focus) : null;
  return (
    <View style={styles.clip} pointerEvents="none">
      <Image
        source={{ uri }}
        onLoad={handleLoad}
        onError={onError}
        resizeMode="cover"
        accessibilityIgnoresInvertColors
        style={layout !== null
          ? [styles.positioned, { width: layout.width, height: layout.height, left: layout.left, top: layout.top }]
          : StyleSheet.absoluteFill}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  positioned: {
    position: 'absolute',
  },
});
