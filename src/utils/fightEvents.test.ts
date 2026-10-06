import {
  fightEventEnd,
  pickNextFightEvent,
  availablePromotions,
  fightEventWhen,
  watchPartyMatches,
} from './fightEvents';

// Saturday 2026-10-03, 20:00 local time
const NOW = new Date(2026, 9, 3, 20, 0);

function ev(id: string, over: Partial<{
  promotion: 'UFC' | 'OKTAGON'; eventDate: string; prelimsAt: string | null; mainCardAt: string | null;
  endsAt: string | null; status: 'scheduled' | 'cancelled';
}> = {}) {
  return {
    id, name: `Event ${id}`, promotion: 'UFC' as const, eventDate: '2026-10-03',
    prelimsAt: null, mainCardAt: null, endsAt: null, status: 'scheduled' as const, ...over,
  };
}

const local = (y: number, mo: number, d: number, h: number, mi = 0) => new Date(y, mo - 1, d, h, mi).toISOString();

describe('pickNextFightEvent', () => {
  it('nimmt das früheste kommende Event des Veranstalters', () => {
    const list = [
      ev('spaet', { eventDate: '2026-10-10', mainCardAt: local(2026, 10, 11, 2) }),
      ev('bald', { eventDate: '2026-10-03', mainCardAt: local(2026, 10, 4, 2) }),
      ev('okt', { promotion: 'OKTAGON', eventDate: '2026-10-03', mainCardAt: local(2026, 10, 3, 19) }),
    ];
    expect(pickNextFightEvent(list, 'UFC', NOW)?.id).toBe('bald');
    expect(pickNextFightEvent(list, 'OKTAGON', NOW)?.id).toBe('okt');
  });

  it('schließt abgesagte Events aus', () => {
    const list = [ev('abgesagt', { mainCardAt: local(2026, 10, 4, 2), status: 'cancelled' })];
    expect(pickNextFightEvent(list, 'UFC', NOW)).toBeNull();
  });

  it('hält einen laufenden Abend sichtbar und wechselt erst nach dem Ende', () => {
    const running = ev('laeuft', { prelimsAt: local(2026, 10, 3, 18), mainCardAt: local(2026, 10, 3, 19) });
    const next = ev('naechstes', { eventDate: '2026-10-10', mainCardAt: local(2026, 10, 11, 2) });
    expect(pickNextFightEvent([running, next], 'UFC', NOW)?.id).toBe('laeuft');
    expect(pickNextFightEvent([running, next], 'UFC', new Date(2026, 9, 4, 3, 1))?.id).toBe('naechstes');
  });

  it('nutzt ein gespeichertes Ende', () => {
    const e = ev('mitEnde', { mainCardAt: local(2026, 10, 3, 19), endsAt: local(2026, 10, 3, 19, 30) });
    expect(fightEventEnd(e).toISOString()).toBe(local(2026, 10, 3, 19, 30));
    expect(pickNextFightEvent([e], 'UFC', NOW)).toBeNull();
  });
});

describe('availablePromotions', () => {
  it('bietet nur Veranstalter mit kommendem Event an', () => {
    expect(availablePromotions([ev('u', { mainCardAt: local(2026, 10, 4, 2) })], NOW)).toEqual(['UFC']);
    expect(availablePromotions([], NOW)).toEqual([]);
  });
});

describe('fightEventWhen', () => {
  it('zeigt die Main Card in Ortszeit, auch über die Datumsgrenze', () => {
    // US Saturday evening = Sunday 02:00 local
    const when = fightEventWhen(ev('u', { eventDate: '2026-10-03', mainCardAt: local(2026, 10, 4, 2) }), NOW);
    expect(when).toEqual({ segment: 'Main Card', day: 'Morgen', time: '02:00', running: false });
  });

  it('fällt auf Prelims zurück und meldet unbekannte Uhrzeiten', () => {
    expect(fightEventWhen(ev('p', { prelimsAt: local(2026, 10, 10, 23) }), NOW).segment).toBe('Prelims');
    expect(fightEventWhen(ev('x', { eventDate: '2026-10-17' }), NOW)).toEqual({ segment: null, day: 'Sa., 17. Okt.', time: null, running: false });
  });

  it('erkennt einen laufenden Abend', () => {
    expect(fightEventWhen(ev('l', { prelimsAt: local(2026, 10, 3, 18), mainCardAt: local(2026, 10, 3, 22) }), NOW).running).toBe(true);
  });
});

describe('watchPartyMatches', () => {
  const anchor = { start: local(2026, 10, 4, 0), eventDate: '2026-10-03' };

  it('verlangt den Veranstalter im Titel oder der Fight Card', () => {
    expect(watchPartyMatches({ title: 'Public Viewing', fightCard: 'UFC 332 – Silva vs Wang', scheduledAt: local(2026, 10, 3, 23) }, 'UFC', anchor)).toBe(true);
    expect(watchPartyMatches({ title: 'Champions League gucken', fightCard: 'Bayern – Real', scheduledAt: local(2026, 10, 3, 23) }, 'UFC', anchor)).toBe(false);
    expect(watchPartyMatches({ title: 'Oktagon 80 schauen', fightCard: null, scheduledAt: local(2026, 10, 3, 23) }, 'UFC', anchor)).toBe(false);
    expect(watchPartyMatches({ title: 'Stufc Party', fightCard: null, scheduledAt: local(2026, 10, 3, 23) }, 'UFC', anchor)).toBe(false);
  });

  it('passt nur zeitlich zum Kampfabend', () => {
    expect(watchPartyMatches({ title: 'UFC Abend', fightCard: null, scheduledAt: local(2026, 10, 3, 22) }, 'UFC', anchor)).toBe(true);
    expect(watchPartyMatches({ title: 'UFC Abend', fightCard: null, scheduledAt: local(2026, 10, 10, 22) }, 'UFC', anchor)).toBe(false);
    expect(watchPartyMatches({ title: 'UFC Abend', fightCard: null, scheduledAt: local(2026, 10, 4, 1) }, 'UFC', { start: null, eventDate: '2026-10-03' })).toBe(true);
  });
});
