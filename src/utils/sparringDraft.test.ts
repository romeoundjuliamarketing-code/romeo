import {
  emptyDraft,
  applyGym,
  applyStudio,
  toCustomMeetingPoint,
  clearPlace,
  validateStep,
  firstStepWithError,
  isDraftDirty,
  buildCreateInput,
  resolvedTitle,
  defaultSparringTitle,
  withDay,
  withTime,
  CREATE_DURATION_MIN,
} from './sparringDraft';

const NOW = new Date(2026, 9, 4, 12, 0, 0);

const GYM = {
  id: 'gym-1',
  name: 'Phoenix Gym',
  city: 'Bremen',
  address: 'Hauptstr. 1, 28195 Bremen',
  lat: 53.08,
  lng: 8.8,
};
const GYM_NO_ADDRESS = { ...GYM, id: 'gym-2', address: null, lat: null, lng: null };
const STUDIO = { id: 'studio-1', address: 'Ringweg 5, Bremen', lat: 53.1, lng: 8.9 };

function complete() {
  return { ...applyGym(emptyDraft(NOW), GYM), discipline: 'Boxen' };
}

describe('emptyDraft', () => {
  it('starts tomorrow at 18:00 local time without a discipline', () => {
    const d = emptyDraft(NOW);
    expect(d.discipline).toBeNull();
    expect(d.scheduledAt.getDate()).toBe(5);
    expect(d.scheduledAt.getHours()).toBe(18);
    expect(d.maxSlots).toBe(10);
  });
});

describe('titles', () => {
  it('uses the automatic name without an own title', () => {
    expect(resolvedTitle(complete())).toBe(defaultSparringTitle('Boxen'));
    expect(resolvedTitle(complete())).toBe('Boxen – Sparring');
  });
  it('prefers a trimmed own title', () => {
    expect(resolvedTitle({ ...complete(), title: '  Freitagssparring ' })).toBe('Freitagssparring');
  });
  it('is empty without discipline and title', () => {
    expect(resolvedTitle(emptyDraft(NOW))).toBe('');
  });
});

describe('place', () => {
  it('takes address and coordinates from a gym', () => {
    const d = applyGym(emptyDraft(NOW), GYM);
    expect(d.source).toBe('gym');
    expect(d.address).toBe(GYM.address);
    expect(d.coord).toEqual({ lat: 53.08, lng: 8.8 });
  });

  it('keeps a gym without address linked but asks for the meeting point', () => {
    const d = applyGym(emptyDraft(NOW), GYM_NO_ADDRESS);
    expect(d.gym?.id).toBe('gym-2');
    expect(d.source).toBe('custom');
    expect(d.address).toBe('');
    expect(validateStep(2, d, NOW).place).toBe('Gib an, wo ihr euch trefft.');
  });

  it('does not carry the old gym address over to a gym without address', () => {
    const d = applyGym(applyGym(emptyDraft(NOW), GYM), GYM_NO_ADDRESS);
    expect(d.address).toBe('');
    expect(d.coord).toBeNull();
  });

  it('keeps a typed meeting point when switching to a gym without address', () => {
    const typed = { ...emptyDraft(NOW), source: 'custom' as const, address: 'Parkplatz Nord' };
    expect(applyGym(typed, GYM_NO_ADDRESS).address).toBe('Parkplatz Nord');
  });

  it('a different meeting point keeps the gym link', () => {
    const d = toCustomMeetingPoint(applyGym(emptyDraft(NOW), GYM));
    expect(d.gym?.id).toBe('gym-1');
    expect(d.source).toBe('custom');
    expect(d.address).toBe('');
    expect(d.coord).toBeNull();
  });

  it('studio location drops a gym and its access note', () => {
    const d = applyStudio({ ...applyGym(emptyDraft(NOW), GYM), accessNote: 'Klingeln' }, STUDIO);
    expect(d.gym).toBeNull();
    expect(d.accessNote).toBe('');
    expect(d.address).toBe(STUDIO.address);
  });

  it('clearPlace resets everything location related', () => {
    const d = clearPlace(applyGym(emptyDraft(NOW), GYM));
    expect(d.source).toBeNull();
    expect(d.gym).toBeNull();
    expect(d.address).toBe('');
  });
});

describe('validateStep', () => {
  it('step 1 needs a discipline', () => {
    expect(validateStep(1, emptyDraft(NOW), NOW).discipline).toBeDefined();
    expect(validateStep(1, complete(), NOW)).toEqual({});
  });

  it('step 1 rejects less than one slot', () => {
    expect(validateStep(1, { ...complete(), maxSlots: 0 }, NOW).maxSlots).toBeDefined();
  });

  it('step 1 does not check the place', () => {
    expect(validateStep(1, { ...emptyDraft(NOW), discipline: 'BJJ' }, NOW)).toEqual({});
  });

  it('step 2 needs a place and a future time', () => {
    const errors = validateStep(2, { ...emptyDraft(NOW), scheduledAt: new Date(2026, 9, 4, 11, 0) }, NOW);
    expect(errors.place).toBeDefined();
    expect(errors.scheduledAt).toBeDefined();
    expect(errors.discipline).toBeUndefined();
  });

  it('step 3 checks everything', () => {
    const errors = validateStep(3, emptyDraft(NOW), NOW);
    expect(Object.keys(errors).sort()).toEqual(['discipline', 'place']);
    expect(firstStepWithError(errors)).toBe(1);
    expect(firstStepWithError({ place: 'x' })).toBe(2);
    expect(firstStepWithError({})).toBeNull();
  });
});

describe('isDraftDirty', () => {
  it('detects changes against the initial draft', () => {
    const initial = emptyDraft(NOW);
    expect(isDraftDirty(initial, initial)).toBe(false);
    expect(isDraftDirty({ ...initial, notes: 'Mundschutz' }, initial)).toBe(true);
    expect(isDraftDirty({ ...initial, scheduledAt: new Date(initial.scheduledAt.getTime() + 60000) }, initial)).toBe(true);
  });
});

describe('buildCreateInput', () => {
  it('maps a gym place onto the existing contract', () => {
    const input = buildCreateInput({ ...complete(), accessNote: ' Gäste nach Absprache ', maxSlots: 4 }, null);
    expect(input).toEqual({
      address: GYM.address,
      lat: 53.08,
      lng: 8.8,
      gymId: 'gym-1',
      accessNote: 'Gäste nach Absprache',
      title: 'Boxen – Sparring',
      discipline: 'Boxen',
      scheduledAt: complete().scheduledAt.toISOString(),
      durationMin: CREATE_DURATION_MIN,
      maxSlots: 4,
      notes: '',
    });
  });

  it('a typed address without coordinates is geocoded later', () => {
    const d = { ...complete(), gym: null, source: 'custom' as const, address: 'Parkstr. 2', coord: null };
    const input = buildCreateInput(d, null);
    expect(input).not.toBeNull();
    expect(input !== null && 'lat' in input).toBe(false);
    expect(input !== null && 'gymId' in input).toBe(false);
  });

  it('keeps the gym link with a different meeting point', () => {
    const d = { ...toCustomMeetingPoint(complete()), address: 'Parkplatz Nord' };
    const input = buildCreateInput(d, null);
    expect(input?.address).toBe('Parkplatz Nord');
    expect(input !== null && 'gymId' in input ? input.gymId : null).toBe('gym-1');
  });

  it('marks the studio location', () => {
    const d = { ...applyStudio(emptyDraft(NOW), STUDIO), discipline: 'MMA' };
    const input = buildCreateInput(d, STUDIO.id);
    expect(input !== null && 'isAtStudio' in input ? input.isAtStudio : false).toBe(true);
    expect(input !== null && 'atStudioId' in input ? input.atStudioId : null).toBe('studio-1');
  });

  it('returns null for an incomplete draft', () => {
    expect(buildCreateInput(emptyDraft(NOW), null)).toBeNull();
  });
});

describe('date helpers', () => {
  it('withDay keeps the time, withTime keeps the day', () => {
    const current = new Date(2026, 9, 5, 18, 30);
    const day = withDay(current, new Date(2026, 9, 9, 7, 0));
    expect([day.getDate(), day.getHours(), day.getMinutes()]).toEqual([9, 18, 30]);
    const time = withTime(current, new Date(2026, 0, 1, 20, 15));
    expect([time.getDate(), time.getHours(), time.getMinutes()]).toEqual([5, 20, 15]);
  });
});
