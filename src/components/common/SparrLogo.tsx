import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Tightly cropped 512x512 version of the brand mark from assets/logo-home.png.
// The source asset is 1024x1536 and 2.1 MB with a lot of transparent padding —
// decoding that for a 14 pt logo made the mark appear with a visible delay.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const SPARR_LOGO_SOURCE = require('../../../assets/logo-mark.png');

interface Props {
  size:     number;
  opacity?: number;
}

// The Sparr brand mark, same artwork as the home header and the map markers.
export default function SparrLogo({ size, opacity = 1 }: Props): React.ReactElement {
  return (
    <Image
      source={SPARR_LOGO_SOURCE}
      style={[styles.logo, { width: size, height: size, opacity }]}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}

const styles = StyleSheet.create({
  logo: {
    // Sizing comes from the props; kept here so no inline-only style is needed.
  },
});
