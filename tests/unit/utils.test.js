import { describe, expect, it } from 'vitest';
import {
  addDays,
  eclipticToGeographicDirection,
  eventsOnDate,
  filterQuakesByMinMag,
  isDateInPastWindow,
  iersPoleGlobePosition,
  latLonToVector3,
  moonBodyRadiusScene,
  moonOrbitRadiusScene,
  MOON_MEAN_DIST_KM,
  quakeMarkerRadius,
  quakeHypocenterRadius,
} from '../../src/utils.js';

describe('addDays / past window', () => {
  it('adds calendar days in UTC', () => {
    expect(addDays('2024-05-11', -7)).toBe('2024-05-04');
    expect(addDays('2024-05-11', 1)).toBe('2024-05-12');
  });

  it('isDateInPastWindow is inclusive on both ends', () => {
    expect(isDateInPastWindow('2024-05-04', '2024-05-11', 7)).toBe(true);
    expect(isDateInPastWindow('2024-05-11', '2024-05-11', 7)).toBe(true);
    expect(isDateInPastWindow('2024-05-03', '2024-05-11', 7)).toBe(false);
    expect(isDateInPastWindow('2024-05-12', '2024-05-11', 7)).toBe(false);
  });
});

describe('filterQuakesByMinMag', () => {
  const quakes = [
    { id: 'a', mag: 4.9 },
    { id: 'b', mag: 5.0 },
    { id: 'c', mag: 6.2 },
    { id: 'd', mag: null },
  ];

  it('keeps M≥5 by default (catalog floor)', () => {
    expect(filterQuakesByMinMag(quakes).map((q) => q.id)).toEqual(['b', 'c']);
  });

  it('raises floor when UI asks for stronger events', () => {
    expect(filterQuakesByMinMag(quakes, 6).map((q) => q.id)).toEqual(['c']);
  });

  it('returns empty for missing list', () => {
    expect(filterQuakesByMinMag(null)).toEqual([]);
    expect(filterQuakesByMinMag([])).toEqual([]);
  });
});

describe('eventsOnDate', () => {
  const quakes = [
    { id: 'in', date: '2024-05-10', time: Date.parse('2024-05-10T12:00:00Z') / 1000 },
    { id: 'out', date: '2024-04-01', time: Date.parse('2024-04-01T12:00:00Z') / 1000 },
  ];
  const eruptions = [
    { id: 1, startDate: '2024-05-01', endDate: '2024-05-20' },
    { id: 2, startDate: '2023-01-01', endDate: '2023-02-01' },
  ];

  it('pastOnly keeps quakes in trailing window', () => {
    const { quakes: q, volcs } = eventsOnDate('2024-05-11', quakes, eruptions, 7, true);
    expect(q.map((x) => x.id)).toEqual(['in']);
    expect(volcs.map((x) => x.id)).toEqual([1]);
  });
});

describe('globe math', () => {
  it('latLonToVector3 places north pole on +Y', () => {
    const p = latLonToVector3(90, 0, 1);
    expect(p.y).toBeCloseTo(1, 5);
    expect(p.x).toBeCloseTo(0, 5);
    expect(p.z).toBeCloseTo(0, 5);
  });

  it('deeper quakes sit closer to center than surface events', () => {
    const shallow = quakeMarkerRadius(0);
    const deep = quakeMarkerRadius(400);
    expect(deep).toBeLessThan(shallow);
    expect(quakeHypocenterRadius(0)).toBeCloseTo(1, 5);
  });

  it('iersPoleGlobePosition exaggerates tiny arcseconds into visible lat offset', () => {
    const p = iersPoleGlobePosition(0.1, 0);
    expect(p.lat).toBeLessThan(90);
    expect(Number.isFinite(p.lon)).toBe(true);
  });

  it('eclipticToGeographicDirection rotates obliquity without NaN', () => {
    const g = eclipticToGeographicDirection(1, 0, 0);
    expect(Number.isFinite(g.x + g.y + g.z)).toBe(true);
  });

  it('moon orbit is ~60 Earth radii at mean distance', () => {
    const r = moonOrbitRadiusScene(MOON_MEAN_DIST_KM);
    expect(r).toBeGreaterThan(55);
    expect(r).toBeLessThan(65);
  });

  it('moon body radius is ~0.27 Earth radii', () => {
    const r = moonBodyRadiusScene(1);
    expect(r).toBeGreaterThan(0.25);
    expect(r).toBeLessThan(0.29);
  });

  it('uses ephemeris perigee/apogee km for orbit radius', () => {
    const perigee = moonOrbitRadiusScene(363_300);
    const apogee = moonOrbitRadiusScene(405_500);
    expect(apogee).toBeGreaterThan(perigee);
    expect(perigee).toBeGreaterThan(50);
  });
});
