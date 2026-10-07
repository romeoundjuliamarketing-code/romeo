// Utility functions for the sparring chat list screen.
import i18n from '../i18n';
import { systemMessageText } from './systemMessageText';
import { formatDate } from './formatDate';
import { localeFor, parseLanguage, type AppLanguage } from './language';

function currentLanguage(): AppLanguage {
  return parseLanguage(i18n.language) ?? 'de';
}

// Short weekday without trailing dot ("Mo" / "Mon").
function shortWeekday(date: Date, language: AppLanguage): string {
  return new Intl.DateTimeFormat(localeFor(language), { weekday: 'short' }).format(date).replace('.', '');
}

/**
 * Returns up to 2 uppercase initials from the first two words of a title.
 * Falls back to '?' when the title is empty.
 */
export function initialsFromTitle(title: string): string {
  const words = title.trim().split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return '?';
  const first  = words[0].charAt(0).toUpperCase();
  const second = words.length > 1 ? words[1].charAt(0).toUpperCase() : '';
  return first + second;
}

/**
 * Returns a short human-readable label for the last-message timestamp.
 * - null input  → ''
 * - today       → 'HH:MM'
 * - yesterday   → 'Gestern'
 * - within 7 days → short weekday ('Mo', 'Di', …)
 * - older       → 'TT.MM.' (e.g. '12.06.')
 */
export function lastMessageTimeLabel(iso: string | null, now?: Date): string {
  if (iso === null) return '';
  const date    = new Date(iso);
  const today   = now !== undefined ? new Date(now) : new Date();
  today.setHours(0, 0, 0, 0);

  const msgDay  = new Date(date);
  msgDay.setHours(0, 0, 0, 0);

  const diffMs   = today.getTime() - msgDay.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    // Same day: show time
    return formatDate(date, 'time', currentLanguage());
  }
  if (diffDays === 1) return i18n.t('chat.list.yesterday');
  if (diffDays < 7) {
    // Short weekday abbreviation
    return shortWeekday(date, currentLanguage());
  }
  // 'TT.MM.' format
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.`;
}

/**
 * Returns a short countdown label for the sparring event date.
 * - past        → 'Vorbei'
 * - today       → 'Heute · HH:MM'
 * - tomorrow    → 'Morgen · HH:MM'
 * - within 7 days → 'Wochentag · HH:MM' (e.g. 'Sa · 19:00')
 * - otherwise   → 'TT.MM. · HH:MM'
 */
export function sparringDateLabel(iso: string, now?: Date): string {
  const event   = new Date(iso);
  const today   = now !== undefined ? new Date(now) : new Date();
  const language = currentLanguage();
  const time    = formatDate(event, 'time', language);

  const todayMidnight = new Date(today);
  todayMidnight.setHours(0, 0, 0, 0);

  const eventMidnight = new Date(event);
  eventMidnight.setHours(0, 0, 0, 0);

  const diffMs   = eventMidnight.getTime() - todayMidnight.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (event < today) return i18n.t('chat.list.over');
  if (diffDays === 0) return i18n.t('chat.list.today', { time });
  if (diffDays === 1) return i18n.t('chat.list.tomorrow', { time });
  if (diffDays < 7) {
    // Short weekday abbreviation, strip trailing dot
    const weekday = shortWeekday(event, language);
    return `${weekday} · ${time}`;
  }
  const dd = String(event.getDate()).padStart(2, '0');
  const mm = String(event.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}. · ${time}`;
}

// ── Chat overview (redesign 2026-10-04) ──────────────────────────────────────

/**
 * City from a stored address ("Hauptstr. 1, 26441 Jever" / map picks without
 * commas). Only a "<PLZ> <Stadt>" match counts; a short digit-free address is
 * taken as the place itself. Anything else → null (omit, never guess).
 */
export function cityFromAddress(address: string | null): string | null {
  if (address === null) return null;
  const trimmed = address.trim();
  if (trimmed.length === 0) return null;
  const match = trimmed.match(/(?:^|\s)\d{5}\s+([A-Za-zÄÖÜäöüß][A-Za-zÄÖÜäöüß .-]*)/);
  const city = match?.[1]?.trim().replace(/[ ,.-]+$/, '');
  if (city !== undefined && city.length > 0) return city;
  if (!/\d/.test(trimmed) && trimmed.length <= 32) return trimmed.replace(/,.*$/, '').trim();
  return null;
}

/** Place shown in a chat row: gym/studio/venue name, else the city. */
export function chatPlaceLabel(placeName: string | null, address: string | null): string | null {
  const name = placeName?.trim() ?? '';
  if (name.length > 0) return name;
  return cityFromAddress(address);
}

function dayDiff(a: Date, b: Date): number {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const db = new Date(b); db.setHours(0, 0, 0, 0);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

/**
 * Meeting date for a chat row. Upcoming: "Heute, 18:00" / "Morgen, 18:00" /
 * "Sa, 18:00" (within a week) / "10.10., 18:00". Past (archive): the real
 * date "Sa, 12.09." (with year when not the current one), no "Vorbei".
 */
export function chatWhenLabel(iso: string, now: Date = new Date()): string {
  const when = new Date(iso);
  const language = currentLanguage();
  const time = formatDate(when, 'time', language);
  const weekday = shortWeekday(when, language);
  const dd = String(when.getDate()).padStart(2, '0');
  const mm = String(when.getMonth() + 1).padStart(2, '0');
  const diff = dayDiff(now, when);
  if (diff < 0) {
    const year = when.getFullYear() !== now.getFullYear() ? String(when.getFullYear()) : '';
    return `${weekday}, ${dd}.${mm}.${year}`;
  }
  if (diff === 0) return i18n.t('chat.list.whenToday', { time });
  if (diff === 1) return i18n.t('chat.list.whenTomorrow', { time });
  if (diff < 7) return `${weekday}, ${time}`;
  return `${dd}.${mm}., ${time}`;
}

export interface ChatPreview {
  /** "Du", the sender's first name, or null (system message / unknown). */
  sender: string | null;
  text:   string;
  /** No message yet: text is the invitation copy. */
  empty:  boolean;
}

export function chatPreview(input: {
  kind:           'sparring' | 'event';
  lastText:       string | null;
  lastSenderName: string | null;
  lastFromMe:     boolean;
  lastIsSystem:   boolean;
}): ChatPreview {
  if (input.lastText === null) {
    return {
      sender: null,
      text: input.kind === 'sparring'
        ? i18n.t('chat.list.emptySparring')
        : i18n.t('chat.list.emptyEvent'),
      empty: true,
    };
  }
  const text = input.lastText.replace(/\s+/g, ' ').trim();
  if (input.lastIsSystem) {
    return { sender: null, text: systemMessageText(text, (key, opts) => i18n.t(key, opts)), empty: false };
  }
  if (input.lastFromMe) return { sender: i18n.t('chat.list.you'), text, empty: false };
  const first = input.lastSenderName?.trim().split(/\s+/)[0] ?? '';
  return { sender: first.length > 0 ? first : null, text, empty: false };
}

/** Statuses that count as "zugesagt" for the next-up highlight. */
const COMMITTED = new Set(['organizer', 'confirmed']);

/**
 * Key of the chat for the soonest upcoming sparring the user committed to
 * (organizer or confirmed). Independent from the list order; null if none.
 */
export function nextUpChatKey(
  chats: { key: string; kind: 'sparring' | 'event'; scheduledAt: string; myStatus: string | null }[],
  now: Date = new Date(),
): string | null {
  let best: { key: string; at: number } | null = null;
  for (const c of chats) {
    if (c.kind !== 'sparring' || c.myStatus === null || !COMMITTED.has(c.myStatus)) continue;
    const at = new Date(c.scheduledAt).getTime();
    if (at <= now.getTime()) continue;
    if (best === null || at < best.at) best = { key: c.key, at };
  }
  return best?.key ?? null;
}

/** Same rule as before the redesign: archived once the meeting has ended. */
export function isChatArchived(scheduledAt: string, durationMin: number, now: Date = new Date()): boolean {
  return new Date(scheduledAt).getTime() + durationMin * 60_000 < now.getTime();
}
