import React from 'react';
import { Image, PixelRatio } from 'react-native';

// Two sizes of the same mark, cropped out of assets/logo-home.png (1024x1536, 2.1 MB,
// mostly transparent padding). In a dev build every asset travels over HTTP from the
// Metro server, so the small file is what keeps the logo instant on a device over WiFi.
// Note: HeroSection and the map markers still render logo-home.png directly.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_SM = require('../../../assets/logo-mark-sm.png');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const LOGO_LG = require('../../../assets/logo-mark.png');

const LOGO_SM_PIXEL_WIDTH = 128;

// Largest point size the small file still covers sharply on this device.
const SMALL_MAX_SIZE = LOGO_SM_PIXEL_WIDTH / PixelRatio.get();

interface Props {
  size: number;
  opacity?: number;
  // 'texture' is a faint background element — it always uses the small file, however
  // large it is drawn. Keeping this explicit means changing `opacity` for design
  // reasons can never silently switch which asset is loaded.
  variant?: 'mark' | 'texture';
}

// The Sparr brand mark.
export default function SparrLogo({
  size,
  opacity = 1,
  variant = 'mark',
}: Props): React.ReactElement {
  const useSmall = variant === 'texture' || size <= SMALL_MAX_SIZE;

  return (
    <Image
      source={useSmall ? LOGO_SM : LOGO_LG}
      style={{ width: size, height: size, opacity }}
      resizeMode="contain"
      fadeDuration={0}
    />
  );
}

// Warms both files so the mark is already decoded when a card first renders.
export function prefetchSparrLogo(): void {
  for (const asset of [LOGO_SM, LOGO_LG]) {
    const source = Image.resolveAssetSource(asset);
    if (source?.uri === undefined) continue;
    void Image.prefetch(source.uri).catch(() => undefined);
  }
}
