import React from 'react';
import { Image, StyleSheet } from 'react-native';

// Two sizes of the same mark, both cropped out of assets/logo-home.png (1024x1536,
// 2.1 MB, mostly transparent padding). In a dev build every asset travels over HTTP
// from the Metro server, so the small file is what keeps the logo instant on a
// device over WiFi — only one place on the whole screen needs the large one.
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const SPARR_LOGO_SOURCE_SM = require('../../../assets/logo-mark-sm.png'); // 128 px, 19 KB
// eslint-disable-next-line @typescript-eslint/no-require-imports
export const SPARR_LOGO_SOURCE = require('../../../assets/logo-mark.png');       // 384 px, 154 KB

// 128 px covers every logo up to 42 pt on a 3x screen.
const SMALL_MAX_SIZE = 42;
// Below this the mark is background texture — its resolution is not perceivable.
const TEXTURE_OPACITY = 0.2;

interface Props {
  size:     number;
  opacity?: number;
}

// The Sparr brand mark, same artwork as the home header and the map markers.
export default function SparrLogo({ size, opacity = 1 }: Props): React.ReactElement {
  const useSmall = size <= SMALL_MAX_SIZE || opacity < TEXTURE_OPACITY;

  return (
    <Image
      source={useSmall ? SPARR_LOGO_SOURCE_SM : SPARR_LOGO_SOURCE}
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
