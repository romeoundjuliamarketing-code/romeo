import React, { useMemo, useRef } from 'react';
import { StyleSheet, View, Dimensions } from 'react-native';
import Svg, { Line, Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

const W              = Dimensions.get('window').width;
const CONNECTION_DIST = 100;
const EXCLUSION_R    = 68;   // empty zone around streak number
const OCTAGON_R      = 78;   // octagon sits just outside exclusion zone
const OCTAGON_N      = 8;
const PATTERN_ZONE   = 0.38; // fraction of hero height used for the pattern
const GLOW_BLEED     = 30;   // max glow radius — SVG viewport extends this far below the node zone

// Static node/glow radii (formerly the midpoint of the breathe animation)
const DOT_R      = 3.2;
const GLOW_R     = 19;
const OCT_DOT_R  = 3.6;
const OCT_GLOW_R = 22;

// Poisson-disk parameters
const MIN_DIST  = 52;  // minimum px between any two random nodes
const MAX_PTS   = 28;  // max random nodes to place
const MAX_TRIES = 30;  // attempts per active sample before giving up

// ── Seeded PRNG (Mulberry32) ───────────────────────────────────────────────
function makePrng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
  };
}

type NodePos = { x: number; y: number };

// ── Poisson-Disk Sampling ─────────────────────────────────────────────────
// Guarantees minDist between every pair of nodes → even, non-clustered spread.
// The exclusion zone around (exX, exY) is respected automatically.
function poissonDisk(
  width: number,
  height: number,
  seed: number,
  exX: number | null,
  exY: number | null,
): NodePos[] {
  const rand   = makePrng(seed);
  const cell   = MIN_DIST / Math.SQRT2; // background grid cell size
  const cols   = Math.ceil(width  / cell);
  const rows   = Math.ceil(height / cell);
  const grid   = new Array<number | null>(cols * rows).fill(null);
  const pts: NodePos[] = [];
  const active: number[] = [];

  const minD2 = MIN_DIST * MIN_DIST;
  // Slightly enlarge exclusion so nodes don't sit right on its edge
  const excR2 = (EXCLUSION_R + 6) * (EXCLUSION_R + 6);

  const toCell = (x: number, y: number) =>
    Math.floor(y / cell) * cols + Math.floor(x / cell);

  const isValid = (x: number, y: number): boolean => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    if (exX !== null && exY !== null) {
      const dx = x - exX;
      const dy = y - exY;
      if (dx * dx + dy * dy < excR2) return false;
    }
    const gx = Math.floor(x / cell);
    const gy = Math.floor(y / cell);
    for (let iy = Math.max(0, gy - 2); iy <= Math.min(rows - 1, gy + 2); iy++) {
      for (let ix = Math.max(0, gx - 2); ix <= Math.min(cols - 1, gx + 2); ix++) {
        const idx = grid[iy * cols + ix];
        if (idx !== null) {
          const dx = x - pts[idx].x;
          const dy = y - pts[idx].y;
          if (dx * dx + dy * dy < minD2) return false;
        }
      }
    }
    return true;
  };

  const addPt = (x: number, y: number) => {
    const i = pts.length;
    pts.push({ x, y });
    active.push(i);
    grid[toCell(x, y)] = i;
  };

  // Seed the first point
  let att = 0;
  let sx = 0, sy = 0;
  do { sx = rand() * width; sy = rand() * height; }
  while (!isValid(sx, sy) && ++att < 300);
  if (att < 300) addPt(sx, sy);

  // Grow the sample set
  while (active.length > 0 && pts.length < MAX_PTS) {
    const ai = Math.floor(rand() * active.length);
    const p  = pts[active[ai]];
    let placed = false;

    for (let k = 0; k < MAX_TRIES; k++) {
      const angle = rand() * 2 * Math.PI;
      const r     = MIN_DIST * (1 + rand()); // [minDist, 2·minDist]
      const nx = p.x + r * Math.cos(angle);
      const ny = p.y + r * Math.sin(angle);
      if (isValid(nx, ny)) { addPt(nx, ny); placed = true; break; }
    }
    if (!placed) active.splice(ai, 1);
  }

  return pts;
}

// ── Octagon vertices ───────────────────────────────────────────────────────
function buildOctagon(cx: number, cy: number): NodePos[] {
  return Array.from({ length: OCTAGON_N }, (_, i) => {
    const angle = -Math.PI / 2 + i * ((2 * Math.PI) / OCTAGON_N);
    return { x: cx + OCTAGON_R * Math.cos(angle), y: cy + OCTAGON_R * Math.sin(angle) };
  });
}

// ── Connection pairs within distance threshold ─────────────────────────────
function buildConnections(nodes: NodePos[]): [number, number][] {
  const pairs: [number, number][] = [];
  const d2 = CONNECTION_DIST * CONNECTION_DIST;
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      if (dx * dx + dy * dy < d2) pairs.push([i, j]);
    }
  }
  return pairs;
}

// ── Component ───────────────────────────────────────────────────────────────

type Props = { height: number; exclusionCenter?: { x: number; y: number } | null };

export default function HeroNetworkPattern({ height, exclusionCenter = null }: Props) {
  const zoneHeight = height * PATTERN_ZONE;

  // Fixed seed per mount so pattern is stable during the session
  const seed = useRef(Math.floor(Math.random() * 0xffffff)).current;

  // Random nodes via Poisson-disk — even spread, respects exclusion zone
  const randomNodes = useMemo(
    () =>
      zoneHeight > 0
        ? poissonDisk(W, zoneHeight, seed, exclusionCenter?.x ?? null, exclusionCenter?.y ?? null)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [zoneHeight, seed, exclusionCenter?.x, exclusionCenter?.y],
  );

  // Octagon vertices (appended after random nodes; index offset = randomNodes.length)
  const octagonNodes = useMemo(
    () => (exclusionCenter !== null ? buildOctagon(exclusionCenter.x, exclusionCenter.y) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exclusionCenter?.x, exclusionCenter?.y],
  );

  const allNodes = useMemo(
    () => [...randomNodes, ...octagonNodes],
    [randomNodes, octagonNodes],
  );

  // All connections across the combined node set
  const allConnections = useMemo(() => buildConnections(allNodes), [allNodes]);

  // Split: octagon perimeter edges (bright) vs. everything else
  const octBase = randomNodes.length;
  const { regularConns, octagonConns } = useMemo(() => {
    const regular: [number, number][] = [];
    const octagon: [number, number][] = [];
    allConnections.forEach(([a, b]) => {
      if (a >= octBase && b >= octBase) {
        const diff = Math.abs((a - octBase) - (b - octBase));
        if (diff === 1 || diff === OCTAGON_N - 1) { octagon.push([a, b]); return; }
      }
      regular.push([a, b]);
    });
    return { regularConns: regular, octagonConns: octagon };
  }, [allConnections, octBase]);

  if (height === 0 || allNodes.length === 0) return null;

  return (
    <View style={[StyleSheet.absoluteFillObject, styles.container]} pointerEvents="none">
      <Svg width={W} height={zoneHeight + GLOW_BLEED}>
        <Defs>
          <RadialGradient id="nodeGlow" cx="50%" cy="50%" r="50%" gradientUnits="objectBoundingBox">
            <Stop offset="0%"   stopColor="#4A90D9" stopOpacity={0.18} />
            <Stop offset="60%"  stopColor="#4A90D9" stopOpacity={0.07} />
            <Stop offset="100%" stopColor="#4A90D9" stopOpacity={0}    />
          </RadialGradient>
        </Defs>

        {/* Network connections (random↔random, random↔octagon cross-links) */}
        {regularConns.map(([i, j]) => (
          <Line
            key={`r${i}-${j}`}
            x1={allNodes[i].x} y1={allNodes[i].y}
            x2={allNodes[j].x} y2={allNodes[j].y}
            stroke="#4A90D9" strokeWidth={1.2} opacity={0.12}
          />
        ))}

        {/* Octagon perimeter — brighter accent */}
        {octagonConns.map(([i, j]) => (
          <Line
            key={`o${i}-${j}`}
            x1={allNodes[i].x} y1={allNodes[i].y}
            x2={allNodes[j].x} y2={allNodes[j].y}
            stroke="#4A90D9" strokeWidth={1.2} opacity={0.32}
          />
        ))}

        {/* Random network dots */}
        {randomNodes.map((n, i) => (
          <React.Fragment key={`rn${i}`}>
            <Circle cx={n.x} cy={n.y} r={GLOW_R} fill="url(#nodeGlow)" />
            <Circle cx={n.x} cy={n.y} r={DOT_R}  fill="#4A90D9" opacity={0.28} />
          </React.Fragment>
        ))}

        {/* Octagon vertex dots — slightly brighter */}
        {octagonNodes.map((n, i) => (
          <React.Fragment key={`on${i}`}>
            <Circle cx={n.x} cy={n.y} r={OCT_GLOW_R} fill="url(#nodeGlow)" />
            <Circle cx={n.x} cy={n.y} r={OCT_DOT_R}  fill="#4A90D9" opacity={0.48} />
          </React.Fragment>
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
