import {
  normalizePlace,
  rankPlaces,
  validQuery,
  viewboxAround,
} from '../../supabase/functions/resolve-sparring-place/nominatimPlace';

const gym = {
  osm_type: 'node',
  osm_id: 123,
  lat: '53.0793',
  lon: '8.8017',
  category: 'leisure',
  type: 'sports_centre',
  name: 'Boxclub Nord',
  address: { road: 'Hauptstraße', house_number: '12', postcode: '28195', city: 'Bremen', country: 'Deutschland' },
};

describe('normalizePlace', () => {
  it('übernimmt Name, vollständige Adresse und Koordinaten', () => {
    expect(normalizePlace(gym)).toEqual({
      osm_type: 'node',
      osm_id: 123,
      name: 'Boxclub Nord',
      address: 'Hauptstraße 12, 28195 Bremen, Deutschland',
      lat: 53.0793,
      lng: 8.8017,
      category: 'leisure:sports_centre',
    });
  });

  it('verwirft Treffer ohne Hausnummer, Straße oder Ort', () => {
    expect(normalizePlace({ ...gym, address: { ...gym.address, house_number: undefined } })).toBeNull();
    expect(normalizePlace({ ...gym, address: { ...gym.address, road: undefined } })).toBeNull();
    expect(normalizePlace({ ...gym, address: { ...gym.address, city: undefined } })).toBeNull();
  });

  it('akzeptiert Ortsteil-Varianten (town, village)', () => {
    const p = normalizePlace({ ...gym, address: { road: 'Dorfweg', house_number: '1', village: 'Lilienthal' } });
    expect(p?.address).toBe('Dorfweg 1, Lilienthal');
  });

  it('markiert reine Adressen, damit der Ort benannt werden muss', () => {
    const p = normalizePlace({ ...gym, name: '', category: 'place', type: 'house' });
    expect(p?.category).toBe('address');
    expect(p?.name).toBe('Hauptstraße 12');
  });

  it('verwirft ungültige Koordinaten und OSM-Typen', () => {
    expect(normalizePlace({ ...gym, lat: '95' })).toBeNull();
    expect(normalizePlace({ ...gym, lon: 'abc' })).toBeNull();
    expect(normalizePlace({ ...gym, osm_type: 'area' })).toBeNull();
  });
});

describe('rankPlaces', () => {
  it('stellt Sportstätten vor andere Orte und Adressen und entfernt Duplikate', () => {
    const sport = normalizePlace(gym)!;
    const cafe = normalizePlace({ ...gym, osm_id: 2, category: 'amenity', type: 'cafe', name: 'Café' })!;
    const addr = normalizePlace({ ...gym, osm_id: 3, name: '' })!;
    expect(rankPlaces([addr, cafe, sport, sport]).map((p) => p.osm_id)).toEqual([123, 2, 3]);
  });
});

describe('viewboxAround / validQuery', () => {
  it('begrenzt die Suchbox auf gültige Werte', () => {
    expect(viewboxAround(89.5, 179.5)).toBe('178.5,90,180,88.5');
    expect(viewboxAround(Number.NaN, 8)).toBeNull();
  });
  it('lehnt zu kurze oder zu lange Suchen ab', () => {
    expect(validQuery('ab')).toBeNull();
    expect(validQuery('  Boxclub   Bremen ')).toBe('Boxclub Bremen');
    expect(validQuery('x'.repeat(161))).toBeNull();
    expect(validQuery(42)).toBeNull();
  });
});
