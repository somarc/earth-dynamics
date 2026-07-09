import { afterEach, describe, expect, it } from 'vitest';
import { incrementalWindow, addDays } from '../../ingest/lib/incremental-window.mjs';
import { createEmptyDb } from '../fixtures/create-fixture-db.mjs';

describe('incrementalWindow', () => {
  /** @type {import('better-sqlite3').Database | null} */
  let db = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('starts initial backfill when table is empty', () => {
    db = createEmptyDb();
    const w = incrementalWindow(db, {
      table: 'earthquakes',
      defaultStart: '1962-01-01',
    });
    expect(w.mode).toBe('initial');
    expect(w.startDate).toBe('1962-01-01');
    expect(w.maxDate).toBeNull();
  });

  it('computes overlap window from watermark', () => {
    db = createEmptyDb();
    db.prepare(`
      INSERT INTO earthquakes (id, time, date, mag, place, lat, lon, depth, url, tsunami)
      VALUES ('q', 0, '2024-05-11', 6, 'x', 0, 0, 0, '', 0)
    `).run();
    const w = incrementalWindow(db, {
      table: 'earthquakes',
      overlapDays: 3,
    });
    expect(w.mode).toBe('incremental');
    expect(w.maxDate).toBe('2024-05-11');
    expect(w.startDate).toBe(addDays('2024-05-11', -3));
  });

  it('can skip when ingest_log marks source fresh and overlap is 0', () => {
    db = createEmptyDb();
    db.prepare(`
      INSERT INTO ingest_log (source, completed_at, row_count, notes)
      VALUES ('earthquakes', '2024-05-12T00:00:00Z', 1, 'ok')
    `).run();
    const w = incrementalWindow(db, {
      table: 'earthquakes',
      ingestKey: 'earthquakes',
      overlapDays: 0,
    });
    expect(w.mode).toBe('skip-fresh');
  });
});
