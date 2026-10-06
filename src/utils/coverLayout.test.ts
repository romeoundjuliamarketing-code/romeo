import { coverLayout, focusFromOffset, coverHeightFor, clamp01 } from './coverLayout';

describe('coverLayout', () => {
  const frame = { width: 400, height: 300 };

  it('fills the frame with a portrait photo and shifts vertically by focus', () => {
    const top = coverLayout(frame, { width: 1000, height: 2000 }, { x: 0.5, y: 0 });
    expect(top.width).toBe(400);
    expect(top.height).toBe(800);
    expect(top.overflowY).toBe(500);
    expect(top.top).toBeCloseTo(0);
    expect(top.left).toBeCloseTo(0);

    const bottom = coverLayout(frame, { width: 1000, height: 2000 }, { x: 0.5, y: 1 });
    expect(bottom.top).toBe(-500);
  });

  it('shifts a wide photo horizontally', () => {
    const l = coverLayout(frame, { width: 4000, height: 1000 }, { x: 0.25, y: 0.5 });
    expect(l.height).toBe(300);
    expect(l.width).toBe(1200);
    expect(l.left).toBe(-200);
    expect(l.overflowY).toBe(0);
  });

  it('clamps an invalid focus and survives unknown sizes', () => {
    expect(coverLayout(frame, { width: 1000, height: 2000 }, { x: 0.5, y: 7 }).top).toBe(-500);
    expect(coverLayout(frame, { width: 0, height: 0 }, { x: 0.5, y: 0.5 })).toEqual({
      width: 400, height: 300, overflowX: 0, overflowY: 0, left: 0, top: 0,
    });
  });
});

describe('focusFromOffset', () => {
  it('inverts the layout offset', () => {
    expect(focusFromOffset(-250, 500)).toBe(0.5);
    expect(focusFromOffset(-900, 500)).toBe(1);
    expect(focusFromOffset(20, 500)).toBe(0);
    expect(focusFromOffset(-10, 0)).toBe(0.5);
  });
});

describe('clamp01', () => {
  it('falls back to the centre for non-numbers', () => {
    expect(clamp01(Number.NaN)).toBe(0.5);
  });
});

describe('coverHeightFor', () => {
  it('stays within bounds', () => {
    expect(coverHeightFor(568)).toBe(240);
    expect(coverHeightFor(844)).toBe(304);
    expect(coverHeightFor(1400)).toBe(380);
  });
});
