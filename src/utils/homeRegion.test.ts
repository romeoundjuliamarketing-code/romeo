import { regionForPoint, isValidHomeRegion, HOME_REGIONS } from './homeRegion';
import { DACH_REGIONS } from '../data/dachRegions';

function region(lat: number, lng: number): string {
  const r = regionForPoint(lat, lng);
  return r === 'outside' ? 'outside' : r.region;
}

describe('regionForPoint – Deutschland', () => {
  it.each([
    ['Berlin',      52.520, 13.405, 'DE-BE'],
    ['Hamburg',     53.551,  9.994, 'DE-HH'],
    ['München',     48.137, 11.576, 'DE-BY'],
    ['Köln',        50.938,  6.960, 'DE-NW'],
    ['Düsseldorf',  51.227,  6.773, 'DE-NW'],
    ['Stuttgart',   48.776,  9.183, 'DE-BW'],
    ['Frankfurt',   50.110,  8.682, 'DE-HE'],
    ['Bremen',      53.079,  8.802, 'DE-HB'],
    ['Hannover',    52.376,  9.732, 'DE-NI'],
    ['Leipzig',     51.340, 12.375, 'DE-SN'],
    ['Dresden',     51.050, 13.737, 'DE-SN'],
    ['Erfurt',      50.978, 11.029, 'DE-TH'],
    ['Magdeburg',   52.121, 11.628, 'DE-ST'],
    ['Potsdam',     52.391, 13.064, 'DE-BB'],
    ['Schwerin',    53.636, 11.401, 'DE-MV'],
    ['Kiel',        54.323, 10.123, 'DE-SH'],
    ['Mainz',       49.993,  8.247, 'DE-RP'],
    ['Saarbrücken', 49.240,  6.997, 'DE-SL'],
  ])('%s', (_name, lat, lng, expected) => {
    expect(region(lat, lng)).toBe(expected);
  });

  it('gibt Land und Region zurück', () => {
    expect(regionForPoint(48.137, 11.576)).toEqual({ country: 'DE', region: 'DE-BY' });
  });
});

describe('regionForPoint – Österreich', () => {
  it.each([
    ['Wien',       48.208, 16.373, 'AT-9'],
    ['Graz',       47.071, 15.439, 'AT-6'],
    ['Linz',       48.306, 14.286, 'AT-4'],
    ['Salzburg',   47.810, 13.055, 'AT-5'],
    ['Innsbruck',  47.269, 11.404, 'AT-7'],
    ['Klagenfurt', 46.624, 14.307, 'AT-2'],
    ['Bregenz',    47.503,  9.747, 'AT-8'],
    ['Eisenstadt', 47.846, 16.528, 'AT-1'],
    ['St. Pölten', 48.204, 15.626, 'AT-3'],
  ])('%s', (_name, lat, lng, expected) => {
    expect(region(lat, lng)).toBe(expected);
  });
});

describe('regionForPoint – Schweiz', () => {
  it.each([
    ['Zürich',     47.377,  8.541, 'CH-ZH'],
    ['Genf',       46.204,  6.143, 'CH-GE'],
    ['Basel',      47.560,  7.588, 'CH-BS'],
    ['Bern',       46.948,  7.447, 'CH-BE'],
    ['Lausanne',   46.520,  6.633, 'CH-VD'],
    ['Lugano',     46.004,  8.951, 'CH-TI'],
    ['Luzern',     47.050,  8.309, 'CH-LU'],
    ['St. Gallen', 47.424,  9.377, 'CH-SG'],
    ['Chur',       46.850,  9.532, 'CH-GR'],
    ['Zug',        47.166,  8.516, 'CH-ZG'],
  ])('%s', (_name, lat, lng, expected) => {
    expect(region(lat, lng)).toBe(expected);
  });
});

describe('regionForPoint – Grenzfälle', () => {
  // Natural Earth 1:10m runs the border about 1 km too far north in Konstanz:
  // the old town south of the Rhine counts as CH-TG. Accepted for a statistic.
  it('Konstanz (DE) gegenüber Kreuzlingen (CH)', () => {
    expect(region(47.672, 9.175)).toBe('DE-BW');
    expect(region(47.645, 9.178)).toBe('CH-TG');
  });

  it('Lindau (DE) neben Bregenz (AT)', () => {
    expect(region(47.546, 9.684)).toBe('DE-BY');
  });

  it('Freilassing (DE) neben Salzburg (AT)', () => {
    expect(region(47.840, 12.977)).toBe('DE-BY');
  });

  it('Weil am Rhein (DE) neben Basel (CH)', () => {
    expect(region(47.594, 7.621)).toBe('DE-BW');
  });

  it('Bremerhaven gehört zu Bremen, nicht Niedersachsen', () => {
    expect(region(53.540, 8.581)).toBe('DE-HB');
  });

  it('Küstenort knapp außerhalb der vereinfachten Linie zählt noch', () => {
    // Warnemünde beach.
    expect(region(54.180, 12.083)).toBe('DE-MV');
  });
});

describe('regionForPoint – außerhalb', () => {
  it.each([
    ['Paris',        48.857,   2.352],
    ['Prag',         50.075,  14.438],
    ['Mailand',      45.464,   9.190],
    ['Straßburg',    48.573,   7.752],
    ['Amsterdam',    52.370,   4.895],
    ['New York',     40.713, -74.006],
    ['Nordsee',      54.500,   7.000],
    ['Ostsee',       54.800,  13.000],
    ['Mittelmeer',   40.000,   5.000],
  ])('%s', (_name, lat, lng) => {
    expect(regionForPoint(lat, lng)).toBe('outside');
  });

  it('ungültige Koordinaten', () => {
    expect(regionForPoint(Number.NaN, 10)).toBe('outside');
    expect(regionForPoint(50, Number.POSITIVE_INFINITY)).toBe('outside');
  });
});

describe('Whitelist', () => {
  it('Grenzdaten decken genau die Whitelist ab', () => {
    const fromData = DACH_REGIONS.map(([code]) => code).sort();
    const fromList = [...HOME_REGIONS.DE, ...HOME_REGIONS.AT, ...HOME_REGIONS.CH].sort();
    expect(fromData).toEqual(fromList);
    expect(fromList).toHaveLength(51);
  });

  it('isValidHomeRegion prüft Land und Region gemeinsam', () => {
    expect(isValidHomeRegion('DE', 'DE-NW')).toBe(true);
    expect(isValidHomeRegion('AT', 'DE-NW')).toBe(false);
    expect(isValidHomeRegion('FR', 'FR-75')).toBe(false);
    expect(isValidHomeRegion('CH', null)).toBe(false);
  });
});
