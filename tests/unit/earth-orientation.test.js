import { describe, expect, it } from 'vitest';
import {
  approxLonFromTimezone,
  localDayPhase,
  nearestCatalogDate,
  surfaceYawToFaceLon,
  utcDateString,
  utcDayPhase,
} from '../../src/lib/earth-orientation.js';

describe('surfaceYawToFaceLon', () => {
  it('returns a finite yaw for common longitudes', () => {
    for (const lon of [0, -74, 139, 180, -180]) {
      const y = surfaceYawToFaceLon(lon);
      expect(Number.isFinite(y)).toBe(true);
      expect(Math.abs(y)).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });

  it('differs for opposite hemispheres', () => {
    const a = surfaceYawToFaceLon(-74);
    const b = surfaceYawToFaceLon(106);
    expect(Math.abs(a - b)).toBeGreaterThan(0.5);
  });
});

describe('day phase', () => {
  it('utcDayPhase is in [0,1)', () => {
    const p = utcDayPhase(new Date('2024-05-11T12:00:00Z'));
    expect(p).toBeCloseTo(0.5, 2);
  });

  it('localDayPhase is in [0,1)', () => {
    const p = localDayPhase(new Date());
    expect(p).toBeGreaterThanOrEqual(0);
    expect(p).toBeLessThan(1);
  });
});

describe('nearestCatalogDate', () => {
  const dates = ['2024-01-01', '2024-05-11', '2024-12-31'];

  it('returns exact match', () => {
    expect(nearestCatalogDate(dates, '2024-05-11')).toBe('2024-05-11');
  });

  it('clamps to range', () => {
    expect(nearestCatalogDate(dates, '2020-01-01')).toBe('2024-01-01');
    expect(nearestCatalogDate(dates, '2030-01-01')).toBe('2024-12-31');
  });

  it('picks last date ≤ preferred', () => {
    expect(nearestCatalogDate(dates, '2024-06-01')).toBe('2024-05-11');
  });
});

describe('approxLonFromTimezone', () => {
  it('returns lon in [-180,180]', () => {
    const lon = approxLonFromTimezone(new Date());
    expect(lon).toBeGreaterThanOrEqual(-180);
    expect(lon).toBeLessThanOrEqual(180);
  });
});

describe('utcDateString', () => {
  it('formats ISO date', () => {
    expect(utcDateString(new Date('2024-05-11T23:00:00Z'))).toBe('2024-05-11');
  });
});
