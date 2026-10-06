import {
  boundingBox,
  withinRadius,
  formatDistanceKm,
  HOME_RADIUS_KM,
  radiusForZoom,
  radiusLabel,
  visibleRadiusKm,
  widerRadius,
} from './sparringSearch';
import { haversineKm } from './geoUtils';

const BREMEN = { lat: 53.08, lng: 8.80 };
const NOW    = new Date('2026-09-27T12:00:00Z');

function row(id: string, lat: number | null, lng: number | null, scheduledAt = '2026-09-28T18:00:00Z') {
  return { id, lat, lng, scheduled_at: scheduledAt };
}

// Point `km` north of the center (1 degree latitude ~ 111.2 km on the sphere).
function north(km: number) {
  return { lat: BREMEN.lat + km / 111.19, lng: BREMEN.lng };
}

describe('boundingBox', () => {
  it('contains every point of the search circle', () => {
    const box = boundingBox(BREMEN, 30);
    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      // Point just inside 30 km in direction `deg`.
      const lat = BREMEN.lat + (29.9 / 111.19) * Math.cos(rad);
      const lng = BREMEN.lng + (29.9 / (111.19 * Math.cos((BREMEN.lat * Math.PI) / 180))) * Math.sin(rad);
      expect(haversineKm(BREMEN.lat, BREMEN.lng, lat, lng)).toBeLessThanOrEqual(30);
      expect(lat).toBeGreaterThanOrEqual(box.minLat);
      expect(lat).toBeLessThanOrEqual(box.maxLat);
      expect(lng).toBeGreaterThanOrEqual(box.minLng);
      expect(lng).toBeLessThanOrEqual(box.maxLng);
    }
  });

  it('is wider in longitude than in latitude in the north', () => {
    const box = boundingBox(BREMEN, 30);
    expect(box.maxLng - box.minLng).toBeGreaterThan(box.maxLat - box.minLat);
  });
});

describe('withinRadius', () => {
  it('cuts exactly at the radius (box corners are outside the circle)', () => {
    const box = boundingBox(BREMEN, 30);
    const rows = [
      row('in', north(29.5).lat, BREMEN.lng),
      row('out', north(30.5).lat, BREMEN.lng),
      row('corner', box.maxLat - 0.001, box.maxLng - 0.001),
    ];
    expect(withinRadius(rows, BREMEN, 30, NOW).map((r) => r.id)).toEqual(['in']);
  });

  it('sorts nearest first across the whole set', () => {
    const rows = [
      row('far', north(20).lat, BREMEN.lng),
      row('near', north(2).lat, BREMEN.lng),
      row('mid', north(9).lat, BREMEN.lng),
    ];
    const hits = withinRadius(rows, BREMEN, HOME_RADIUS_KM, NOW);
    expect(hits.map((r) => r.id)).toEqual(['near', 'mid', 'far']);
    expect(hits[0].distance_km).toBeCloseTo(2, 1);
  });

  it('uses the start time on equal (displayed) distance', () => {
    const p = north(5);
    const rows = [
      row('later', p.lat, p.lng, '2026-09-30T18:00:00Z'),
      row('sooner', p.lat, p.lng, '2026-09-28T18:00:00Z'),
    ];
    expect(withinRadius(rows, BREMEN, 30, NOW).map((r) => r.id)).toEqual(['sooner', 'later']);
  });

  it('drops rows without coordinates instead of inventing a distance', () => {
    const rows = [row('nolat', null, 8.8), row('nolng', 53.08, null), row('ok', BREMEN.lat, BREMEN.lng)];
    expect(withinRadius(rows, BREMEN, 30, NOW).map((r) => r.id)).toEqual(['ok']);
  });

  it('drops sparrings that already started', () => {
    const rows = [
      row('past', BREMEN.lat, BREMEN.lng, '2026-09-27T11:59:00Z'),
      row('future', BREMEN.lat, BREMEN.lng, '2026-09-27T12:01:00Z'),
    ];
    expect(withinRadius(rows, BREMEN, 30, NOW).map((r) => r.id)).toEqual(['future']);
  });

  it('returns the same set for the home count and the unfiltered search', () => {
    const rows = [row('a', north(3).lat, BREMEN.lng), row('b', north(40).lat, BREMEN.lng), row('c', null, null)];
    const search = withinRadius(rows, BREMEN, HOME_RADIUS_KM, NOW);
    expect(search.length).toBe(1);
  });
});

describe('formatDistanceKm', () => {
  it('shows one decimal with a comma below 10 km', () => {
    expect(formatDistanceKm(4.24)).toBe('4,2 km');
    expect(formatDistanceKm(0.04)).toBe('0,0 km');
  });

  it('rounds to whole km from 10 km', () => {
    expect(formatDistanceKm(12.6)).toBe('13 km');
  });
});

describe('Überall (ohne Umkreis)', () => {
  it('schneidet nichts ab, sortiert aber weiter nach Entfernung', () => {
    const far  = row('far', 48.14, 11.58);       // München
    const near = row('near', north(5).lat, north(5).lng);
    const hits = withinRadius([far, near], BREMEN, null, NOW);
    expect(hits.map((h) => h.id)).toEqual(['near', 'far']);
    expect(hits[1].distance_km).toBeGreaterThan(500);
  });

  it('beschriftet den Umkreis', () => {
    expect(radiusLabel(30)).toBe('30 km');
    expect(radiusLabel(null)).toBe('Überall');
  });
});

describe('widerRadius', () => {
  it('geht Stufe für Stufe weiter und endet bei Überall', () => {
    expect(widerRadius(10)).toBe(30);
    expect(widerRadius(50)).toBe(100);
    expect(widerRadius(100)).toBeNull();
    expect(widerRadius(null)).toBeUndefined();
  });
});

describe('radiusForZoom', () => {
  it('bleibt bei leichtem Zoomen nach einer Suche', () => {
    expect(radiusForZoom(30, 36)).toBe(30);
    expect(radiusForZoom(30, 45)).toBe(30);
  });

  it('wächst beim Rauszoomen auf die passende Stufe', () => {
    expect(radiusForZoom(10, 25)).toBe(30);
    expect(radiusForZoom(30, 70)).toBe(100);
  });

  it('wird über der größten Stufe zu Überall', () => {
    expect(radiusForZoom(100, 400)).toBeNull();
    expect(radiusForZoom(30, 150)).toBeNull();
  });

  it('verkleinert beim Reinzoomen nie', () => {
    expect(radiusForZoom(100, 5)).toBe(100);
    expect(radiusForZoom(null, 5)).toBeNull();
  });
});

describe('visibleRadiusKm', () => {
  it('nimmt die halbe kürzere Seite', () => {
    // 1 degree latitude ~ 111 km high; at 53 degrees 2 degrees longitude ~ 134 km wide
    const km = visibleRadiusKm({ latitude: 53, latitudeDelta: 1, longitudeDelta: 2 });
    expect(km).toBeCloseTo(111.32 / 2, 0);
  });
});
