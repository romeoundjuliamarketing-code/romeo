// Sparring chat system messages are stored as German text by the server
// ("<name> hat sich angemeldet" / "<name> hat abgesagt"); render them in the
// active language. Unknown system text is shown as stored.
type SystemKey = 'chat.system.joined' | 'chat.system.cancelled';

const PATTERNS: readonly { re: RegExp; key: SystemKey }[] = [
  { re: /^(.+) hat sich angemeldet$/, key: 'chat.system.joined' },
  { re: /^(.+) hat abgesagt$/,        key: 'chat.system.cancelled' },
];

export function systemMessageText(
  content: string,
  t: (key: SystemKey, opts: { name: string }) => string,
): string {
  for (const { re, key } of PATTERNS) {
    const m = content.match(re);
    if (m) return t(key, { name: m[1] });
  }
  return content;
}
