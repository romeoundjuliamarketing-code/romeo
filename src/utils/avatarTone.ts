// Deterministic pastel background for avatar fallbacks: the same id (user or
// chat) always maps to the same tone, on every render and every screen.
import { colors } from '../theme/colors';

export const AVATAR_TONES: readonly string[] = [
  colors.avatarSky,
  colors.avatarSage,
  colors.avatarSand,
  colors.avatarLavender,
];

// FNV-1a 32-bit: cheap, stable across platforms, spreads similar UUIDs well.
function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function avatarToneIndex(id: string): number {
  return hashId(id) % AVATAR_TONES.length;
}

export function avatarTone(id: string): string {
  return AVATAR_TONES[avatarToneIndex(id)];
}
