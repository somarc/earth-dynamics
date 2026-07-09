/**
 * Pure daily-row resolution helpers for the day-frame API.
 * Extracted for unit tests and to keep handlers.mjs as a thin composer.
 */

export function lagDays(fromDate, toDate) {
  if (!fromDate || !toDate || toDate <= fromDate) return 0;
  return Math.round(
    (Date.parse(`${toDate}T12:00:00Z`) - Date.parse(`${fromDate}T12:00:00Z`)) / 86_400_000,
  );
}

export function extensionMaxDate(db) {
  const { maxDate } = db.prepare(`
    SELECT MAX(d) AS maxDate FROM (
      SELECT MAX(date) AS d FROM earthquakes
      UNION ALL SELECT MAX(start_date) AS d FROM eruptions
      UNION ALL SELECT MAX(date) AS d FROM ephemeris_daily
    )
  `).get();
  return maxDate ?? null;
}

export function visibleTimelineEnd(db) {
  const lastEop = db.prepare('SELECT MAX(date) AS end FROM eop_daily').get()?.end ?? null;
  if (!lastEop) return null;
  const maxDate = extensionMaxDate(db);
  if (!maxDate || maxDate <= lastEop) return lastEop;
  return maxDate;
}

/**
 * Resolve a daily table row for `date`, falling back to the nearest prior row.
 * @returns {{ row: object|null, asOf: string|null, coverage: 'exact'|'fallback'|'missing' }}
 */
export function resolveDailyRow(db, table, date) {
  let row = db.prepare(`SELECT * FROM ${table} WHERE date = ?`).get(date);
  if (row) {
    return { row, asOf: row.date, coverage: 'exact' };
  }
  row = db.prepare(
    `SELECT * FROM ${table} WHERE date <= ? ORDER BY date DESC LIMIT 1`,
  ).get(date);
  if (row) {
    return { row, asOf: row.date, coverage: 'fallback' };
  }
  return { row: null, asOf: null, coverage: 'missing' };
}
