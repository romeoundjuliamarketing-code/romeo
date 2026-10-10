// Sparring chat system messages are stored as German text by the server
// ("<name> hat sich angemeldet" / "<name> hat abgesagt" / "<name> ist nicht
// mehr dabei"); render them in the active language. Unknown system text is
// shown as stored. The server writes "Jemand" when the name is missing; pass
// `someone` to show that in the active language.
type SystemKey = 'chat.system.joined' | 'chat.system.cancelled' | 'chat.system.expired';

const SERVER_FALLBACK_NAME = 'Jemand';

const KIND_OF: Record<SystemKey, SystemEventKind> = {
  'chat.system.joined':    'joined',
  'chat.system.cancelled': 'cancelled',
  'chat.system.expired':   'expired',
};

const PATTERNS: readonly { re: RegExp; key: SystemKey }[] = [
  { re: /^(.+) hat sich angemeldet$/,    key: 'chat.system.joined' },
  { re: /^(.+) hat abgesagt$/,           key: 'chat.system.cancelled' },
  { re: /^(.+) ist nicht mehr dabei$/,   key: 'chat.system.expired' },
];

export type SystemEventKind = 'joined' | 'cancelled' | 'expired';

export interface ParsedSystemMessage {
  kind: SystemEventKind;
  key:  SystemKey;
  name: string;
}

/** Recognised server system text, or null for anything else. */
export function parseSystemMessage(content: string, someone?: string): ParsedSystemMessage | null {
  for (const { re, key } of PATTERNS) {
    const m = content.match(re);
    if (!m) continue;
    const name = m[1] === SERVER_FALLBACK_NAME && someone !== undefined ? someone : m[1];
    return { kind: KIND_OF[key], key, name };
  }
  return null;
}

export function systemMessageText(
  content: string,
  t: (key: SystemKey, opts: { name: string }) => string,
  someone?: string,
): string {
  const parsed = parseSystemMessage(content, someone);
  return parsed !== null ? t(parsed.key, { name: parsed.name }) : content;
}
