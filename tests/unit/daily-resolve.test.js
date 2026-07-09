import { afterEach, describe, expect, it } from 'vitest';
import {
  lagDays,
  resolveDailyRow,
  visibleTimelineEnd,
} from '../../api/lib/daily-resolve.mjs';
import { createEmptyDb, createFixtureDb } from '../fixtures/create-fixture-db.mjs';

describe('lagDays', () => {
  it('counts whole days between ISO dates', () => {
    expect(lagDays('2024-05-01', '2024-05-11')).toBe(10);
    expect(lagDays('2024-05-11', '2024-05-11')).toBe(0);
    expect(lagDays(null, '2024-05-11')).toBe(0);
    expect(lagDays('2024-05-12', '2024-05-11')).toBe(0);
  });
});

describe('resolveDailyRow', () => {
  /** @type {import('better-sqlite3').Database | null} */
  let db = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('returns exact coverage when the date exists', () => {
    db = createFixtureDb();
    const r = resolveDailyRow(db, 'eop_daily', '2024-05-11');
    expect(r.coverage).toBe('exact');
    expect(r.asOf).toBe('2024-05-11');
    expect(r.row.date).toBe('2024-05-11');
  });

  it('falls back to nearest prior row', () => {
    db = createFixtureDb();
    const r = resolveDailyRow(db, 'eop_daily', '2024-05-15');
    expect(r.coverage).toBe('fallback');
    expect(r.asOf).toBe('2024-05-12');
  });

  it('reports missing when table has no prior data', () => {
    db = createEmptyDb();
    const r = resolveDailyRow(db, 'eop_daily', '2024-05-11');
    expect(r).toEqual({ row: null, asOf: null, coverage: 'missing' });
  });
});

describe('visibleTimelineEnd', () => {
  it('extends past EOP when quakes go further', () => {
    const db = createEmptyDb();
    db.prepare(`
      INSERT INTO eop_daily (
        date, mjd, x_arcsec, y_arcsec, lod_sec, x_mas, y_mas, lod_ms,
        omega_picorad_s, delta_omega_picorad_s, x_rad, y_rad
      ) VALUES ('2024-05-01', 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
    `).run();
    db.prepare(`
      INSERT INTO earthquakes (id, time, date, mag, place, lat, lon, depth, url, tsunami)
      VALUES ('q1', 0, '2024-05-20', 6, 'x', 0, 0, 0, '', 0)
    `).run();
    expect(visibleTimelineEnd(db)).toBe('2024-05-20');
    db.close();
  });
});
