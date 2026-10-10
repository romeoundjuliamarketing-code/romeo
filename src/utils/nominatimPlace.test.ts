import {
  normalizePin,
  normalizePlace,
  photonToNominatim,
  pinKey,
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

describe('pinKey', () => {
  it('ist eindeutig, ganzzahlig und rundet auf ca. 1 m', () => {
    const a = pinKey(53.079312, 8.801749);
    expect(Number.isSafeInteger(a)).toBe(true);
    expect(pinKey(53.079314, 8.801751)).toBe(a);
    expect(pinKey(53.07932, 8.80175)).not.toBe(a);
    expect(pinKey(-53.07931, 8.80175)).not.toBe(a);
    expect(Number.isSafeInteger(pinKey(90, 180))).toBe(true);
    expect(pinKey(-90, -180)).toBeGreaterThanOrEqual(0);
  });
});

describe('normalizePin', () => {
  const reverse = {
    name: 'Bürgerpark',
    address: { road: 'Parkallee', postcode: '28209', city: 'Bremen', country: 'Deutschland' },
  };

  it('nimmt die getippten Koordinaten (gerundet) und die nächste Straße als Adresse', () => {
    expect(normalizePin(53.0912344, 8.8123456, reverse)).toEqual({
      osm_type: 'pin',
      osm_id: pinKey(53.0912344, 8.8123456),
      name: 'Bürgerpark',
      address: 'Parkallee, 28209 Bremen, Deutschland',
      lat: 53.09123,
      lng: 8.81235,
      category: 'address',
    });
  });

  it('fällt ohne Namen auf Straße, ohne Straße auf den Ort zurück', () => {
    expect(normalizePin(53, 8, { address: { road: 'Parkallee', city: 'Bremen' } })?.name).toBe('Parkallee');
    const noRoad = normalizePin(53, 8, { address: { postcode: '28209', village: 'Lilienthal' } });
    expect(noRoad?.name).toBe('Lilienthal');
    expect(noRoad?.address).toBe('28209 Lilienthal');
  });

  it('lehnt Punkte ohne Ort (z. B. auf dem Meer) und ungültige Koordinaten ab', () => {
    expect(normalizePin(54.5, 7.5, { address: { country: 'Deutschland' } })).toBeNull();
    expect(normalizePin(54.5, 7.5, {})).toBeNull();
    expect(normalizePin(91, 8, reverse)).toBeNull();
    expect(normalizePin(Number.NaN, 8, reverse)).toBeNull();
  });
});

describe('photonToNominatim', () => {
  const photonGym = {
    geometry: { coordinates: [7.8912963, 53.5774356] as [number, number] },
    properties: {
      osm_type: 'W', osm_id: 77632215, osm_key: 'leisure', osm_value: 'fitness_centre', type: 'house',
      name: 'Fitnesspark Am Freibad', housenumber: '6', street: 'Jahnstraße', postcode: '26441',
      city: 'Jever', country: 'Deutschland',
    },
  };

  it('übersetzt einen Photon-Ort in denselben Ort wie bei Nominatim', () => {
    expect(normalizePlace(photonToNominatim(photonGym))).toEqual({
      osm_type: 'way',
      osm_id: 77632215,
      name: 'Fitnesspark Am Freibad',
      address: 'Jahnstraße 6, 26441 Jever, Deutschland',
      lat: 53.5774356,
      lng: 7.8912963,
      category: 'leisure:fitness_centre',
    });
  });

  it('nimmt bei einem Straßen-Feature den Namen als Straße', () => {
    const street = photonToNominatim({
      geometry: { coordinates: [8.8, 53.07] },
      properties: { osm_type: 'W', osm_id: 5, type: 'street', name: 'Hauptstraße', city: 'Bremen' },
    });
    expect(street.address?.road).toBe('Hauptstraße');
    expect(normalizePin(53.07, 8.8, street)?.address).toBe('Hauptstraße, Bremen');
  });

  it('verwirft unvollständige Features', () => {
    expect(normalizePlace(photonToNominatim({}))).toBeNull();
    expect(normalizePlace(photonToNominatim({ ...photonGym, properties: { ...photonGym.properties, housenumber: undefined } }))).toBeNull();
  });
});
