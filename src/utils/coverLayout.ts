// Cover photo framing. React Native's Image has no object-position, so the
// cover is drawn at "cover" size inside a clipping frame and shifted by the
// stored focus point (0..1 per axis, 0.5 = centred). The same math drives the
// framing editor, so what the user positions is exactly what the profile shows.

export interface Size {
  width:  number;
  height: number;
}

export interface Focus {
  x: number;
  y: number;
}

export interface CoverLayout {
  width:  number;
  height: number;
  /** Maximum shift on each axis (>= 0); the image moves from 0 to -overflow. */
  overflowX: number;
  overflowY: number;
  left: number;
  top:  number;
}

export const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5);

export function coverLayout(frame: Size, image: Size, focus: Focus): CoverLayout {
  if (frame.width <= 0 || frame.height <= 0 || image.width <= 0 || image.height <= 0) {
    return { width: frame.width, height: frame.height, overflowX: 0, overflowY: 0, left: 0, top: 0 };
  }
  const scale = Math.max(frame.width / image.width, frame.height / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  const overflowX = Math.max(0, width - frame.width);
  const overflowY = Math.max(0, height - frame.height);
  return {
    width,
    height,
    overflowX,
    overflowY,
    left: -overflowX * clamp01(focus.x),
    top:  -overflowY * clamp01(focus.y),
  };
}

// Inverse of coverLayout for the framing editor: an image offset (<= 0)
// back to a focus value. Without overflow the axis stays centred.
export function focusFromOffset(offset: number, overflow: number): number {
  if (overflow <= 0) return 0.5;
  return clamp01(-offset / overflow);
}

// Cover height for the profile: about a third of the screen, bounded so it
// neither dwarfs small phones nor eats large tablets.
export function coverHeightFor(screenHeight: number): number {
  return Math.round(Math.min(380, Math.max(240, screenHeight * 0.36)));
}
