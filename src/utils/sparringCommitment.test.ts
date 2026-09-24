import {
  hasStarted,
  isBeforeCancelDeadline,
  isInConfirmWindow,
  isSparringChatMember,
  resolveCommitmentCta,
} from './sparringCommitment';

// Fixed reference sparring: 2026-01-10T20:00:00.000Z
const SCHEDULED_AT = '2026-01-10T20:00:00.000Z';

function hoursBefore(hours: number): Date {
  return new Date(new Date(SCHEDULED_AT).getTime() - hours * 60 * 60 * 1000);
}

function hoursAfter(hours: number): Date {
  return new Date(new Date(SCHEDULED_AT).getTime() + hours * 60 * 60 * 1000);
}

describe('hasStarted', () => {
  it('ist false deutlich vor Beginn', () => {
    expect(hasStarted(SCHEDULED_AT, hoursBefore(48))).toBe(false);
  });

  it('ist true genau bei Beginn', () => {
    expect(hasStarted(SCHEDULED_AT, new Date(SCHEDULED_AT))).toBe(true);
  });

  it('ist true nach Beginn', () => {
    expect(hasStarted(SCHEDULED_AT, hoursAfter(1))).toBe(true);
  });
});

describe('isBeforeCancelDeadline', () => {
  it('ist true weit vor der 6h-Frist', () => {
    expect(isBeforeCancelDeadline(SCHEDULED_AT, hoursBefore(48))).toBe(true);
  });

  it('ist true genau an der Frist', () => {
    expect(isBeforeCancelDeadline(SCHEDULED_AT, hoursBefore(6))).toBe(true);
  });

  it('ist false innerhalb der letzten 6h', () => {
    expect(isBeforeCancelDeadline(SCHEDULED_AT, hoursBefore(3))).toBe(false);
  });

  it('ist false nach Beginn', () => {
    expect(isBeforeCancelDeadline(SCHEDULED_AT, hoursAfter(1))).toBe(false);
  });
});

describe('isInConfirmWindow', () => {
  it('ist false weit vor dem 24h-Fenster', () => {
    expect(isInConfirmWindow(SCHEDULED_AT, hoursBefore(48))).toBe(false);
  });

  it('ist true genau am Fensterbeginn (24h vorher)', () => {
    expect(isInConfirmWindow(SCHEDULED_AT, hoursBefore(24))).toBe(true);
  });

  it('ist true kurz vor Beginn', () => {
    expect(isInConfirmWindow(SCHEDULED_AT, hoursBefore(1))).toBe(true);
  });

  it('ist false nach Beginn (nichts mehr zu bestaetigen)', () => {
    expect(isInConfirmWindow(SCHEDULED_AT, hoursAfter(1))).toBe(false);
  });
});

describe('isSparringChatMember', () => {
  it('Organisator hat immer Zugriff, unabhaengig vom Status', () => {
    expect(isSparringChatMember(true, null)).toBe(true);
    expect(isSparringChatMember(true, 'waitlisted' as const)).toBe(true);
  });

  it('pending/confirmed/attended/no_show duerfen chatten', () => {
    expect(isSparringChatMember(false, 'pending' as const)).toBe(true);
    expect(isSparringChatMember(false, 'confirmed' as const)).toBe(true);
    expect(isSparringChatMember(false, 'attended' as const)).toBe(true);
    expect(isSparringChatMember(false, 'no_show' as const)).toBe(true);
  });

  it('waitlisted und kein Status duerfen NICHT chatten', () => {
    expect(isSparringChatMember(false, 'waitlisted' as const)).toBe(false);
    expect(isSparringChatMember(false, null)).toBe(false);
  });

  it('cancelled/cancelled_late/expired duerfen nicht chatten', () => {
    expect(isSparringChatMember(false, 'cancelled' as const)).toBe(false);
    expect(isSparringChatMember(false, 'cancelled_late' as const)).toBe(false);
    expect(isSparringChatMember(false, 'expired' as const)).toBe(false);
  });
});

describe('resolveCommitmentCta', () => {
  it('nicht angemeldet, Platz frei -> join (nicht full)', () => {
    const cta = resolveCommitmentCta({
      myStatus: null,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'join', full: false });
  });

  it('nicht angemeldet, voll -> join mit full=true (Warteliste)', () => {
    const cta = resolveCommitmentCta({
      myStatus: null,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: true,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'join', full: true });
  });

  it('nicht angemeldet, verified_only blockiert -> verified_required', () => {
    const cta = resolveCommitmentCta({
      myStatus: null,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: true,
    });
    expect(cta).toEqual({ type: 'verified_required' });
  });

  it('cancelled/expired verhalten sich wie nicht angemeldet', () => {
    const cancelled = resolveCommitmentCta({
      myStatus: 'cancelled' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    const expired = resolveCommitmentCta({
      myStatus: 'expired' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cancelled).toEqual({ type: 'join', full: false });
    expect(expired).toEqual({ type: 'join', full: false });
  });

  it('pending ausserhalb des 24h-Fensters -> confirmUrgent false', () => {
    const cta = resolveCommitmentCta({
      myStatus: 'pending' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'pending', confirmUrgent: false, cancelIsFree: true });
  });

  it('pending innerhalb des 24h-Fensters -> confirmUrgent true', () => {
    const cta = resolveCommitmentCta({
      myStatus: 'pending' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(12),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'pending', confirmUrgent: true, cancelIsFree: true });
  });

  it('pending innerhalb der Cancel-Frist -> cancelIsFree false', () => {
    const cta = resolveCommitmentCta({
      myStatus: 'pending' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(3),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'pending', confirmUrgent: true, cancelIsFree: false });
  });

  it('confirmed -> nur Absage-CTA, abhaengig von der Frist', () => {
    const early = resolveCommitmentCta({
      myStatus: 'confirmed' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(48),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    const late = resolveCommitmentCta({
      myStatus: 'confirmed' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(1),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(early).toEqual({ type: 'confirmed', cancelIsFree: true });
    expect(late).toEqual({ type: 'confirmed', cancelIsFree: false });
  });

  it('waitlisted -> waitlisted, unabhaengig von der Frist', () => {
    const cta = resolveCommitmentCta({
      myStatus: 'waitlisted' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursBefore(1),
      isFull: true,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'waitlisted' });
  });

  it('nach Beginn: kein CTA fuer Teilnehmer', () => {
    const cta = resolveCommitmentCta({
      myStatus: 'confirmed' as const,
      scheduledAt: SCHEDULED_AT,
      now: hoursAfter(1),
      isFull: false,
      isCreator: false,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'none' });
  });

  it('nach Beginn: Organisator bekommt started_organizer', () => {
    const cta = resolveCommitmentCta({
      myStatus: null,
      scheduledAt: SCHEDULED_AT,
      now: hoursAfter(1),
      isFull: false,
      isCreator: true,
      verifiedBlock: false,
    });
    expect(cta).toEqual({ type: 'started_organizer' });
  });
});
