import { evaluateFacePhoto, FACE_MAX_YAW_DEG } from './faceCheck';

const face = (size: number, yaw: number | null = 0) => ({ x: 100, y: 100, width: size, height: size, yaw });
const scan = (faces: ReturnType<typeof face>[], w = 1000, h = 1000) => ({ imageWidth: w, imageHeight: h, faces });

describe('evaluateFacePhoto', () => {
  it('accepts one large frontal face', () => {
    expect(evaluateFacePhoto(scan([face(400)]))).toEqual({ ok: true });
  });

  it('rejects a photo without a face', () => {
    expect(evaluateFacePhoto(scan([]))).toEqual({ ok: false, problem: 'none' });
  });

  it('ignores empty boxes', () => {
    expect(evaluateFacePhoto(scan([face(0)]))).toEqual({ ok: false, problem: 'none' });
  });

  it('rejects a group photo with two similar faces', () => {
    expect(evaluateFacePhoto(scan([face(400), face(300)]))).toEqual({ ok: false, problem: 'multiple' });
  });

  it('accepts a small face in the background', () => {
    expect(evaluateFacePhoto(scan([face(400), face(100)]))).toEqual({ ok: true });
  });

  it('rejects a distant shot', () => {
    expect(evaluateFacePhoto(scan([face(100)]))).toEqual({ ok: false, problem: 'tooSmall' });
  });

  it('measures against the longer image edge', () => {
    expect(evaluateFacePhoto(scan([face(160)], 600, 1000))).toEqual({ ok: true });
    expect(evaluateFacePhoto(scan([face(140)], 600, 1000))).toEqual({ ok: false, problem: 'tooSmall' });
  });

  it('rejects a side view', () => {
    expect(evaluateFacePhoto(scan([face(400, 70)]))).toEqual({ ok: false, problem: 'notFrontal' });
    expect(evaluateFacePhoto(scan([face(400, -70)]))).toEqual({ ok: false, problem: 'notFrontal' });
  });

  it('accepts the quantized 45 degree step', () => {
    expect(evaluateFacePhoto(scan([face(400, FACE_MAX_YAW_DEG)]))).toEqual({ ok: true });
  });

  it('accepts a face without yaw information', () => {
    expect(evaluateFacePhoto(scan([face(400, null)]))).toEqual({ ok: true });
  });

  it('rejects an image with invalid dimensions', () => {
    expect(evaluateFacePhoto(scan([face(400)], 0, 0))).toEqual({ ok: false, problem: 'tooSmall' });
  });
});
