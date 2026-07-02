/**
 * Incremental ingest window from table watermark or ingest_log.
 */

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function incrementalWindow(db, {
  table,
  dateColumn = 'date',
  overlapDays = 0,
  ingestKey = null,
  defaultStart = null,
} = {}) {
  if (ingestKey) {
    const logged = db.prepare('SELECT completed_at FROM ingest_log WHERE source = ?').get(ingestKey);
    if (logged?.completed_at && overlapDays === 0) {
      return { mode: 'skip-fresh', ingestKey };
    }
  }

  const row = db.prepare(`SELECT MAX(${dateColumn}) AS maxDate FROM ${table}`).get();
  const maxDate = row?.maxDate ?? null;

  if (!maxDate) {
    return {
      mode: 'initial',
      startDate: defaultStart,
      endDate: null,
      maxDate: null,
    };
  }

  return {
    mode: 'incremental',
    startDate: addDays(maxDate, -overlapDays),
    endDate: null,
    maxDate,
  };
}

export { addDays };