// Pure time/CTA helpers for the sparring commitment lifecycle (spec
// docs/superpowers/specs/sparring-verbindlichkeit.md, section 8 + 16.13).
//
// The server is authoritative for every deadline — these helpers only derive
// UI state from the real time delta to `scheduled_at` (never invent new
// deadlines client-side) and from the status the server already assigned.
// Reliability (attended/committed ratio) is computed ONLY in the get_reliability
// SQL RPC (see src/utils/sparringReliability.ts) — nothing here re-derives it.
import {
  SPARRING_CANCEL_DEADLINE_HOURS,
  SPARRING_CONFIRM_WINDOW_HOURS,
} from '../data/sparringConfig';
import type { SparringSignupStatus } from '../types/database.types';

const HOUR_MS = 60 * 60 * 1000;

// True once the sparring's start time has passed.
export function hasStarted(scheduledAt: string, now: Date): boolean {
  return now.getTime() >= new Date(scheduledAt).getTime();
}

// True while cancelling still carries no consequence (mirrors
// sparring_cancel_deadline() in the RPC migration).
export function isBeforeCancelDeadline(scheduledAt: string, now: Date): boolean {
  const deadline = new Date(scheduledAt).getTime() - SPARRING_CANCEL_DEADLINE_HOURS * HOUR_MS;
  return now.getTime() <= deadline;
}

// True during the final-confirmation window before the start (mirrors
// sparring_confirm_window() in the RPC migration). Once the sparring has
// started there is nothing left to confirm.
export function isInConfirmWindow(scheduledAt: string, now: Date): boolean {
  const windowStart = new Date(scheduledAt).getTime() - SPARRING_CONFIRM_WINDOW_HOURS * HOUR_MS;
  return now.getTime() >= windowStart && !hasStarted(scheduledAt, now);
}

// Statuses that keep a user able to read the sparring's group chat (mirrors
// the "chat member" set in the RPC migration comment). Waitlisted users can
// never read the chat.
const CHAT_MEMBER_STATUSES: ReadonlySet<SparringSignupStatus> = new Set([
  'pending',
  'confirmed',
  'attended',
  'no_show',
]);

export function isSparringChatMember(isCreator: boolean, myStatus: SparringSignupStatus | null): boolean {
  if (isCreator) return true;
  return myStatus !== null && CHAT_MEMBER_STATUSES.has(myStatus);
}

// Small union of CTA states the detail sheet renders. Kept intentionally
// narrow — no reliability math, no invented deadlines, just what the current
// status + time delta imply.
export type CommitmentCta =
  | { type: 'join'; full: boolean }
  | { type: 'verified_required' }
  | { type: 'pending'; confirmUrgent: boolean; cancelIsFree: boolean }
  | { type: 'confirmed'; cancelIsFree: boolean }
  | { type: 'waitlisted' }
  | { type: 'started_organizer' }
  | { type: 'none' };

export interface ResolveCommitmentCtaParams {
  myStatus:      SparringSignupStatus | null;
  scheduledAt:   string;
  now:           Date;
  isFull:        boolean;
  isCreator:     boolean;
  verifiedBlock: boolean;
}

export function resolveCommitmentCta({
  myStatus, scheduledAt, now, isFull, isCreator, verifiedBlock,
}: ResolveCommitmentCtaParams): CommitmentCta {
  // After the start there is no more join/confirm/cancel CTA. The organizer
  // gets a distinct state so the sheet knows to point at the attendance UI.
  if (hasStarted(scheduledAt, now)) {
    return isCreator ? { type: 'started_organizer' } : { type: 'none' };
  }

  if (myStatus === 'pending') {
    return {
      type: 'pending',
      confirmUrgent: isInConfirmWindow(scheduledAt, now),
      cancelIsFree: isBeforeCancelDeadline(scheduledAt, now),
    };
  }
  if (myStatus === 'confirmed') {
    return { type: 'confirmed', cancelIsFree: isBeforeCancelDeadline(scheduledAt, now) };
  }
  if (myStatus === 'waitlisted') {
    return { type: 'waitlisted' };
  }

  // Not joined, or a past commitment ended (cancelled / cancelled_late /
  // expired) — free to join again, possibly onto the waitlist.
  if (verifiedBlock) {
    return { type: 'verified_required' };
  }
  return { type: 'join', full: isFull };
}
