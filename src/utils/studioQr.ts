// Studio QR payload helpers. A studio's rating QR encodes the studio id behind a
// fixed prefix so the scanner can tell it apart from fighter profile codes.
export const STUDIO_QR_PREFIX = 'STUDIO:';

// Builds the QR payload string that gets rendered into the studio's rating QR.
export function buildStudioQr(studioId: string): string {
  return `${STUDIO_QR_PREFIX}${studioId}`;
}

// Parses a scanned QR string into a studio id, or null if it is not a studio QR.
// Case-insensitive on the prefix and normalizes the id to lowercase, so it works
// regardless of any case-folding the scanner applies to the raw scanned value.
export function parseStudioQr(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed.toUpperCase().startsWith(STUDIO_QR_PREFIX)) return null;
  const id = trimmed.slice(STUDIO_QR_PREFIX.length).toLowerCase();
  return id.length > 0 ? id : null;
}
