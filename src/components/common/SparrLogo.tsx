import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

// assets/logo-home.png carries transparent padding around the mark: the opaque
// content is a 735x735 square at x=145, y=332 inside a 1024x1536 canvas. The values
// below crop to exactly that square so the logo fills the requested box.
const CONTENT_SCALE   = 1024 / 735;  // box width -> image width
const IMAGE_RATIO     = 1536 / 1024; // image height / image width
const CONTENT_LEFT    = 145 / 1024;
const CONTENT_TOP     = 332 / 1536;

interface Props {
  size: number;
}

// The Sparr brand mark, same asset as the home header and the map markers.
export default function SparrLogo({ size }: Props): React.ReactElement {
  const imageWidth  = size * CONTENT_SCALE;
  const imageHeight = imageWidth * IMAGE_RATIO;

  return (
    <View style={[styles.clip, { width: size, height: size }]}>
      <Image
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../../assets/logo-home.png')}
        style={[
          styles.image,
          {
            width:  imageWidth,
            height: imageHeight,
            left:   -imageWidth * CONTENT_LEFT,
            top:    -imageHeight * CONTENT_TOP,
          },
        ]}
        resizeMode="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: 'hidden',
  },
  image: {
    position: 'absolute',
  },
});
