// Rules for a profile photo that shows the person's face. Input is the result
// of the on-device face detection (modules/sparr-face-detector); pure, so the
// thresholds are testable.

export interface FaceBox {
  x: number;
  y: number;
  width: number;
  height: number;
  /** Head turn left/right in degrees; null when the platform does not report it. */
  yaw: number | null;
}

export interface FaceScan {
  imageWidth: number;
  imageHeight: number;
  faces: readonly FaceBox[];
}

export type FaceProblem = 'none' | 'multiple' | 'tooSmall' | 'notFrontal';

export type FaceVerdict = { ok: true } | { ok: false; problem: FaceProblem };

/** Face edge relative to the longer image edge; below this it is a distant shot. */
export const FACE_MIN_SIZE_RATIO = 0.15;
/** A second face at least this large (area vs. the main face) counts as a group photo. */
export const FACE_SECOND_AREA_RATIO = 0.5;
/** Larger head turns are side views. Older iOS reports yaw in 45 degree steps, so 45 still passes. */
export const FACE_MAX_YAW_DEG = 45;

function area(f: FaceBox): number {
  return Math.max(0, f.width) * Math.max(0, f.height);
}

export function evaluateFacePhoto(scan: FaceScan): FaceVerdict {
  const faces = scan.faces.filter((f) => area(f) > 0);
  if (faces.length === 0) return { ok: false, problem: 'none' };

  const sorted = [...faces].sort((a, b) => area(b) - area(a));
  const main = sorted[0];
  const second = sorted[1];
  if (second !== undefined && area(second) >= area(main) * FACE_SECOND_AREA_RATIO) {
    return { ok: false, problem: 'multiple' };
  }

  const longEdge = Math.max(scan.imageWidth, scan.imageHeight);
  const faceEdge = Math.max(main.width, main.height);
  if (longEdge <= 0 || faceEdge / longEdge < FACE_MIN_SIZE_RATIO) {
    return { ok: false, problem: 'tooSmall' };
  }

  if (main.yaw !== null && Number.isFinite(main.yaw) && Math.abs(main.yaw) > FACE_MAX_YAW_DEG) {
    return { ok: false, problem: 'notFrontal' };
  }
  return { ok: true };
}
