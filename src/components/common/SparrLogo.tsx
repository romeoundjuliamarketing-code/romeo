import React from 'react';
import { Image } from 'react-native';

// The brand mark, cropped out of assets/logo-home.png (1024x1536, 2.1 MB, mostly
// transparent padding) and stored as a 384 px palette PNG — 26 KB. That is small
// enough for every use, from the 14 pt footer mark to the card back, so there is
// exactly one file: one transfer in a dev build, one decode, one cache entry.
// Note: HeroSection and the map markers still render logo-home.png directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO = require('../../../assets/logo-mark.png');

interface Props {
  size:     number;
  opacity?: number;
}

// The Sparr brand mark.
export default function SparrLogo({ size, opacity = 1 }: Props): React.ReactElement {
  return (
    <Image
      source={LOGO}
      style={{ width: size, height: size, opacity }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}

// Warms the mark so it is already decoded when a card first renders.
export function prefetchSparrLogo(): void {
  const source = Image.resolveAssetSource(LOGO);
  if (source?.uri === undefined) return;
  void Image.prefetch(source.uri).catch(() => undefined);
}
