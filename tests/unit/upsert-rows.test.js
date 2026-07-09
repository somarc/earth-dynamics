import { afterEach, describe, expect, it } from 'vitest';
import { upsertRows } from '../../ingest/lib/upsert-rows.mjs';
import { createEmptyDb } from '../fixtures/create-fixture-db.mjs';

describe('upsertRows', () => {
  /** @type {import('better-sqlite3').Database | null} */
  let db = null;
  afterEach(() => {
    db?.close();
    db = null;
  });

  it('returns 0 for empty input', () => {
    db = createEmptyDb();
    const n = upsertRows(
      db,
      'INSERT OR REPLACE INTO weather_grid (grid_id, label, lat, lon) VALUES (@grid_id, @label, @lat, @lon)',
      [],
    );
    expect(n).toBe(0);
  });

  it('writes rows transactionally and replaces on conflict', () => {
    db = createEmptyDb();
    const sql =
      'INSERT OR REPLACE INTO weather_grid (grid_id, label, lat, lon) VALUES (@grid_id, @label, @lat, @lon)';
    const n1 = upsertRows(db, sql, [
      { grid_id: 'a', label: 'A', lat: 1, lon: 2 },
      { grid_id: 'b', label: 'B', lat: 3, lon: 4 },
    ]);
    expect(n1).toBe(2);
    expect(db.prepare('SELECT COUNT(*) AS c FROM weather_grid').get().c).toBe(2);

    const n2 = upsertRows(db, sql, [
      { grid_id: 'a', label: 'A2', lat: 9, lon: 9 },
    ]);
    expect(n2).toBe(1);
    const row = db.prepare('SELECT label, lat FROM weather_grid WHERE grid_id = ?').get('a');
    expect(row.label).toBe('A2');
    expect(row.lat).toBe(9);
  });

  it('respects batchSize without dropping rows', () => {
    db = createEmptyDb();
    const sql =
      'INSERT OR REPLACE INTO weather_grid (grid_id, label, lat, lon) VALUES (@grid_id, @label, @lat, @lon)';
    const rows = Array.from({ length: 5 }, (_, i) => ({
      grid_id: `g${i}`,
      label: `G${i}`,
      lat: i,
      lon: -i,
    }));
    const n = upsertRows(db, sql, rows, { batchSize: 2 });
    expect(n).toBe(5);
    expect(db.prepare('SELECT COUNT(*) AS c FROM weather_grid').get().c).toBe(5);
  });
});
