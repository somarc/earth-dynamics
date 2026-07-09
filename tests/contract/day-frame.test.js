/**
 * Day-frame contract: /api/day/:date shape from a fixture DB.
 * Locks the instrument spine so layer migrations cannot silently drop keys.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { createHandlers, routeRequest } from '../../api/handlers.mjs';
import { createEmptyDb, createFixtureDb } from '../fixtures/create-fixture-db.mjs';

/** Keys every client frame path depends on. */
const DAY_FRAME_KEYS = [
  'date',
  'eop',
  'ephemeris',
  'aam',
  'earthquakes',
  'eruptions',
  'storms',
  'weather',
  'solar',
  'geomagnetic',
  'spaceWeather',
  'magnetometers',
  'magneticPoles',
  'asOf',
  'coverage',
];

describe('DayFrame contract (fixture DB)', () => {
  /** @type {import('better-sqlite3').Database | null} */
  let db = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('returns full key set for 2024-05-11 (G5 demo day)', () => {
    db = createFixtureDb();
    const day = createHandlers(db).getDay('2024-05-11');
    for (const key of DAY_FRAME_KEYS) {
      expect(day, `missing key ${key}`).toHaveProperty(key);
    }
    expect(day.date).toBe('2024-05-11');
    expect(day.eop?.date).toBe('2024-05-11');
    expect(day.coverage.eop).toBe('exact');
    expect(day.asOf.eop).toBe('2024-05-11');
    expect(day.geomagnetic?.kpMax).toBe(9);
    expect(day.geomagnetic?.dstMin).toBe(-412);
    expect(day.earthquakes.some((q) => q.id === 'us-fixture-g5')).toBe(true);
    expect(day.weather).toHaveLength(1);
    expect(day.weather[0].gridId).toBe('tokyo');
    expect(day.spaceWeather.map((e) => e.eventType).sort()).toEqual(
      expect.arrayContaining(['CME', 'FLR', 'GST']),
    );
  });

  it('trailing week excludes quakes older than the lens (default product window)', () => {
    db = createFixtureDb();
    const day = createHandlers(db).getDay('2024-05-11', { pastDays: 7 });
    const ids = day.earthquakes.map((q) => q.id);
    expect(ids).toContain('us-fixture-g5');
    expect(ids).not.toContain('us-fixture-old');
    expect(day.timeWindow?.mode).toBe('trailing');
    expect(day.timeWindow?.pastDays).toBe(7);
  });

  it('default getDay uses trailing week when past omitted', () => {
    db = createFixtureDb();
    const day = createHandlers(db).getDay('2024-05-11');
    expect(day.timeWindow?.pastDays).toBe(7);
    expect(day.earthquakes.map((q) => q.id)).not.toContain('us-fixture-old');
  });

  it('includes cyclones on Katrina date via layer snapshot compose', () => {
    db = createFixtureDb();
    const day = createHandlers(db).getDay('2005-08-29');
    expect(day.cyclones?.length).toBeGreaterThanOrEqual(1);
    expect(day.cyclones[0].name).toMatch(/KATRINA/i);
    expect(day.storms.some((s) => s.eventType === 'Hurricane')).toBe(true);
  });

  it('falls back eop coverage when scrubbing past last exact row', () => {
    db = createFixtureDb();
    const day = createHandlers(db).getDay('2024-05-20');
    expect(day.eop).not.toBeNull();
    expect(day.coverage.eop).toBe('fallback');
    expect(day.asOf.eop).toBe('2024-05-12');
  });

  it('routeRequest serves meta, dates, and day', async () => {
    db = createFixtureDb();
    const meta = await routeRequest(db, 'http://local/api/meta');
    expect(meta.status).toBe(200);
    expect(meta.body.eop.count).toBe(7);
    expect(Array.isArray(meta.body.connectors)).toBe(true);
    expect(meta.body.freshness.timelineEnd).toBeTruthy();

    const dates = await routeRequest(db, 'http://local/api/dates');
    expect(dates.body.dates).toContain('2024-05-11');

    const day = await routeRequest(db, 'http://local/api/day/2024-05-11?past=7');
    expect(day.status).toBe(200);
    expect(day.body.date).toBe('2024-05-11');
  });

  it('empty DB yields missing spine rows without throwing', () => {
    db = createEmptyDb();
    const day = createHandlers(db).getDay('2024-05-11');
    expect(day.eop).toBeNull();
    expect(day.coverage.eop).toBe('missing');
    expect(day.earthquakes).toEqual([]);
  });
});
