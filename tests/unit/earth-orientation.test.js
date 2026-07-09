import { describe, expect, it } from 'vitest';
import {
  approxLonFromTimezone,
  localDayPhase,
  nearestCatalogDate,
  solarElevationCos,
  subsolarLatLon,
  surfaceYawToFaceLon,
  utcDateString,
  utcDayPhase,
  worldSunDirection,
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

describe('subsolar / live sun', () => {
  it('places subsolar lon near 0 at 12:00 UTC', () => {
    const { lon } = subsolarLatLon(new Date('2024-05-11T12:00:00Z'), {
      declinationDeg: 0,
    });
    expect(lon).toBeCloseTo(0, 5);
  });

  it('moves subsolar west through the afternoon UTC', () => {
    const noon = subsolarLatLon(new Date('2024-05-11T12:00:00Z'), {
      declinationDeg: 0,
    });
    const dusk = subsolarLatLon(new Date('2024-05-11T18:00:00Z'), {
      declinationDeg: 0,
    });
    expect(dusk.lon).toBeCloseTo(-90, 5);
    expect(dusk.lon).toBeLessThan(noon.lon);
  });

  it('gives day at local solar noon and night at local midnight for a lon', () => {
    // Lon -75: solar noon ≈ 17:00 UTC, midnight ≈ 05:00 UTC
    const noon = new Date('2024-01-15T17:00:00Z');
    const midnight = new Date('2024-01-16T05:00:00Z');
    const elevNoon = solarElevationCos(0, -75, noon, { declinationDeg: 0 });
    const elevMid = solarElevationCos(0, -75, midnight, { declinationDeg: 0 });
    expect(elevNoon).toBeGreaterThan(0.9);
    expect(elevMid).toBeLessThan(-0.9);
  });

  it('puts world sun toward +Z when that lon faces the camera at local noon', () => {
    const lon = -75;
    const yaw = surfaceYawToFaceLon(lon);
    const noon = new Date('2024-01-15T17:00:00Z');
    const w = worldSunDirection(noon, yaw, { declinationDeg: 0 });
    expect(w.z).toBeGreaterThan(0.95);
    expect(Math.abs(w.x)).toBeLessThan(0.1);
  });

  it('puts world sun near the limb at local sunset for faced lon', () => {
    const lon = -75;
    const yaw = surfaceYawToFaceLon(lon);
    // ~6h after noon → hour angle 90° → terminator through lon
    const sunset = new Date('2024-01-15T23:00:00Z');
    const w = worldSunDirection(sunset, yaw, { declinationDeg: 0 });
    // Sun mostly to the side, not behind camera or fully opposite
    expect(Math.abs(w.z)).toBeLessThan(0.35);
    expect(Math.abs(w.x)).toBeGreaterThan(0.9);
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
