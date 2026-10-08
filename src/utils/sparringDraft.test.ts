import {
  emptyDraft,
  applyGym,
  applyStudio,
  selectPlace,
  clearPlace,
  clearLink,
  validateStep,
  firstStepWithError,
  isDraftDirty,
  buildPublishInput,
  serializeDraft,
  restoreDraft,
  placeNeedsLabel,
  gymSearchQuery,
  resolvedTitle,
  defaultSparringTitle,
  withDay,
  withTime,
  DEFAULT_DURATION_MIN,
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
const PLACE = { id: 'place-1', name: 'Phoenix Gym', address: 'Hauptstr. 1, 28195 Bremen', lat: 53.08, lng: 8.8, category: 'gym' };
const ADDRESS_PLACE = { ...PLACE, id: 'place-2', name: 'Hauptstr. 1', category: 'address' };

function complete() {
  return { ...selectPlace(applyGym(emptyDraft(NOW), GYM), PLACE), discipline: 'Boxen' };
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
  it('picking a gym keeps it linked but clears the place', () => {
    const d = applyGym(complete(), GYM);
    expect(d.gym?.id).toBe('gym-1');
    expect(d.place).toBeNull();
    expect(d.atStudio).toBe(false);
  });

  it('studio location drops a gym and its access note', () => {
    const d = applyStudio({ ...complete(), accessNote: 'Klingeln' });
    expect(d.gym).toBeNull();
    expect(d.accessNote).toBe('');
    expect(d.atStudio).toBe(true);
    expect(d.place).toBeNull();
  });

  it('clearPlace keeps the link, clearLink removes it', () => {
    const d = clearPlace({ ...complete(), placeLabel: 'x' });
    expect(d.place).toBeNull();
    expect(d.placeLabel).toBe('');
    expect(d.gym?.id).toBe('gym-1');
    expect(clearLink(d).gym).toBeNull();
  });

  it('builds a search query from name, address and city', () => {
    expect(gymSearchQuery(GYM)).toBe('Phoenix Gym, Hauptstr. 1, 28195 Bremen, Bremen');
    expect(gymSearchQuery({ ...GYM, address: null })).toBe('Phoenix Gym, Bremen');
  });

  it('only plain addresses need a venue name', () => {
    expect(placeNeedsLabel(PLACE)).toBe(false);
    expect(placeNeedsLabel(ADDRESS_PLACE)).toBe(true);
    expect(placeNeedsLabel(null)).toBe(false);
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

  it('step 2 asks for a venue name on an address place', () => {
    const d = selectPlace(complete(), ADDRESS_PLACE);
    expect(validateStep(2, d, NOW).place).toBeDefined();
    expect(validateStep(2, { ...d, placeLabel: 'B' }, NOW).place).toBeDefined();
    expect(validateStep(2, { ...d, placeLabel: 'Boxclub Nord' }, NOW)).toEqual({});
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

describe('buildPublishInput', () => {
  it('maps a place onto the publish contract', () => {
    const input = buildPublishInput({ ...complete(), accessNote: ' Gäste nach Absprache ', maxSlots: 4, permissionConfirmed: true }, null);
    expect(input).toEqual({
      placeId: 'place-1',
      placeLabel: null,
      title: 'Boxen – Sparring',
      discipline: 'Boxen',
      notes: null,
      scheduledAt: complete().scheduledAt.toISOString(),
      durationMin: DEFAULT_DURATION_MIN,
      maxSlots: 4,
      verifiedOnly: false,
      permissionConfirmed: true,
      gymId: 'gym-1',
      studioId: null,
      accessNote: 'Gäste nach Absprache',
    });
  });

  it('sends the venue name only for address places', () => {
    const d = { ...selectPlace(complete(), ADDRESS_PLACE), placeLabel: ' Boxclub Nord ' };
    expect(buildPublishInput(d, null)?.placeLabel).toBe('Boxclub Nord');
    expect(buildPublishInput({ ...d, placeLabel: '' }, null)).toBeNull();
  });

  it('marks the studio location and drops the gym', () => {
    const d = { ...selectPlace(applyStudio(emptyDraft(NOW)), PLACE), discipline: 'MMA' };
    const input = buildPublishInput(d, 'studio-1');
    expect(input?.studioId).toBe('studio-1');
    expect(input?.gymId).toBeNull();
  });

  it('rejects durations outside 30..300', () => {
    expect(buildPublishInput({ ...complete(), durationMin: 20 }, null)).toBeNull();
    expect(buildPublishInput({ ...complete(), durationMin: 301 }, null)).toBeNull();
  });

  it('returns null without a place or discipline', () => {
    expect(buildPublishInput(emptyDraft(NOW), null)).toBeNull();
    expect(buildPublishInput({ ...emptyDraft(NOW), discipline: 'BJJ' }, null)).toBeNull();
  });
});

describe('draft storage', () => {
  it('round-trips through the stored form', () => {
    const d = { ...complete(), placeLabel: 'x', permissionConfirmed: true, durationMin: 120 };
    const stored = JSON.parse(JSON.stringify(serializeDraft(d)));
    expect(restoreDraft(stored, NOW)).toEqual(d);
  });

  it('replaces a time in the past with the default slot', () => {
    const stored = serializeDraft({ ...complete(), scheduledAt: new Date(2026, 9, 1, 10, 0) });
    expect(restoreDraft(stored, NOW)?.scheduledAt.getDate()).toBe(5);
  });

  it('returns null for unusable data', () => {
    expect(restoreDraft(null, NOW)).toBeNull();
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
