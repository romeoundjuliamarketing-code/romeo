import { requireOptionalNativeModule } from 'expo';

// On-device face detection for profile photos (iOS: Apple Vision, Android:
// bundled ML Kit). Free, offline; the image never leaves the device.
// Coordinates are in pixels of the upright image (EXIF orientation applied),
// yaw in degrees (null when the platform does not report it).
export interface DetectedFace {
  x: number;
  y: number;
  width: number;
  height: number;
  yaw: number | null;
}

export interface FaceDetectionResult {
  imageWidth: number;
  imageHeight: number;
  faces: DetectedFace[];
}

interface SparrFaceDetectorNative {
  detectFaces(uri: string): Promise<FaceDetectionResult>;
}

const native = requireOptionalNativeModule<SparrFaceDetectorNative>('SparrFaceDetector');

/** False in builds made before the module existed (and in Jest). */
export function isFaceDetectionAvailable(): boolean {
  return native !== null;
}

export async function detectFaces(uri: string): Promise<FaceDetectionResult> {
  if (native === null) throw new Error('SparrFaceDetector native module is not available');
  return native.detectFaces(uri);
}
