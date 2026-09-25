import {
  sparringLocationLines,
  compactDateLabel,
  summarizeParticipants,
  initialsOf,
} from './sparringDetail';

function participant(userId: string, name: string | null, status: 'pending' | 'confirmed' | 'waitlisted' | 'attended' | 'no_show') {
  return {
    user_id:           userId,
    name,
    avatar_url:        null,
    gender:            null,
    status,
    is_confirmed:      status === 'confirmed',
    signed_up_at:      '2026-09-01T10:00:00Z',
    waitlist_position: status === 'waitlisted' ? 1 : null,
  };
}

describe('sparringLocationLines', () => {
  it('leads with the studio name and appends a missing city', () => {
    expect(sparringLocationLines({
      studioId: 's1', studioName: 'Boxwerk', studioCity: 'München', address: 'Hauptstr. 1',
    })).toEqual({ primary: 'Boxwerk', secondary: 'Hauptstr. 1 · München' });
  });

  it('does not repeat a city already in the studio address', () => {
    expect(sparringLocationLines({
      studioId: 's1', studioName: 'Boxwerk', studioCity: 'München', address: 'Hauptstr. 1, 80331 München',
    })).toEqual({ primary: 'Boxwerk', secondary: 'Hauptstr. 1, 80331 München' });
  });

  it('leads with the city of a private address that has a postcode', () => {
    expect(sparringLocationLines({
      studioId: null, studioName: 'Privat', studioCity: '', address: 'Hochstraße 6, 46236 Bottrop',
    })).toEqual({ primary: 'Bottrop', secondary: 'Hochstraße 6 · Privater Treffpunkt' });
  });

  it('keeps a private address without postcode exactly as entered', () => {
    expect(sparringLocationLines({
      studioId: null, studioName: 'Privat', studioCity: '', address: 'Hochstraße 6 bottrop',
    })).toEqual({ primary: 'Hochstraße 6 bottrop', secondary: 'Privater Treffpunkt' });
  });

  it('falls back for an empty private address', () => {
    expect(sparringLocationLines({
      studioId: null, studioName: 'Privat', studioCity: '', address: '  ',
    })).toEqual({ primary: 'Ort in der App', secondary: 'Privater Treffpunkt' });
  });
});

describe('compactDateLabel', () => {
  it('formats weekday, day, month and time in local time', () => {
    const local = new Date(2026, 4, 26, 18, 0); // Tue 26 May 2026, 18:00 local
    expect(compactDateLabel(local.toISOString())).toBe('DI · 26. MAI · 18:00');
  });

  it('pads minutes and hours', () => {
    const local = new Date(2026, 8, 6, 9, 5); // Sun 6 Sep 2026, 09:05 local
    expect(compactDateLabel(local.toISOString())).toBe('SO · 6. SEPT. · 09:05');
  });
});

describe('summarizeParticipants', () => {
  it('handles nobody taking part', () => {
    const s = summarizeParticipants([participant('a', 'Anna', 'waitlisted')], null);
    expect(s.takingPart).toHaveLength(0);
    expect(s.waitlistCount).toBe(1);
    expect(s.namesLine).toBeNull();
  });

  it('puts the current user first as "Du"', () => {
    const s = summarizeParticipants(
      [participant('a', 'Dejan Petrovic', 'pending'), participant('me', 'Romeo', 'confirmed')],
      'me',
    );
    expect(s.namesLine).toBe('Du, Dejan');
    expect(s.confirmedCount).toBe(1);
  });

  it('shortens long lists', () => {
    const s = summarizeParticipants(
      [
        participant('a', 'Dejan', 'pending'),
        participant('b', 'Philipp', 'pending'),
        participant('c', 'Ramadan', 'confirmed'),
        participant('d', 'Ben', 'pending'),
        participant('e', null, 'pending'),
      ],
      null,
    );
    expect(s.namesLine).toBe('Dejan, Philipp, Ramadan +2 weitere');
    expect(s.takingPart).toHaveLength(5);
  });

  it('counts recorded attendance as taking part', () => {
    const s = summarizeParticipants([participant('a', 'A', 'attended'), participant('b', 'B', 'no_show')], null);
    expect(s.takingPart).toHaveLength(2);
  });
});

describe('initialsOf', () => {
  it('builds up to two initials', () => {
    expect(initialsOf('dejan petrovic')).toBe('DP');
    expect(initialsOf('Ramadan')).toBe('R');
    expect(initialsOf(null)).toBe('?');
    expect(initialsOf('   ')).toBe('?');
  });
});
