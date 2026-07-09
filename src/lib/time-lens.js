/**
 * Time lens: how far back from anchor date T event layers should look.
 * Product default = trailing "week" so the globe shows "what's happened lately".
 */

export const TIME_LENSES = Object.freeze([
  { id: 'day', label: 'Day', short: '1d', pastDays: 1 },
  { id: 'week', label: 'Week', short: '7d', pastDays: 7 },
  { id: 'month', label: 'Month', short: '30d', pastDays: 30 },
  { id: 'season', label: 'Season', short: '90d', pastDays: 90 },
  { id: 'year', label: 'Year', short: '1y', pastDays: 365 },
  { id: 'decade', label: 'Decade', short: '10y', pastDays: 3650 },
]);

export const DEFAULT_TIME_LENS = 'week';

const BY_ID = Object.fromEntries(TIME_LENSES.map((l) => [l.id, l]));

/** @param {string} id */
export function getTimeLens(id) {
  return BY_ID[id] ?? BY_ID[DEFAULT_TIME_LENS];
}

/** @param {string} id */
export function lensToPastDays(id) {
  return getTimeLens(id).pastDays;
}

/**
 * Normalize API pastDays: always a positive trailing window (default week).
 * Caps at decade-scale so a bad query cannot scan unbounded history.
 */
export function normalizePastDays(pastDays, { fallback = 7, max = 3650 } = {}) {
  if (pastDays == null || pastDays === '') return fallback;
  const n = typeof pastDays === 'string' ? parseInt(pastDays, 10) : Number(pastDays);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(max, Math.floor(n));
}

/** Human range label for events panel. */
export function formatLensRange(anchorDate, lensId, { addDaysFn } = {}) {
  const lens = getTimeLens(lensId);
  if (!anchorDate || typeof addDaysFn !== 'function') {
    return `past ${lens.label.toLowerCase()}`;
  }
  const start = addDaysFn(anchorDate, -lens.pastDays);
  return `${start} → ${anchorDate}`;
}

export function eventsTitleForLens(lensId) {
  const lens = getTimeLens(lensId);
  return `Events (past ${lens.label.toLowerCase()})`;
}

export function emptyEventsMessage(lensId, { quakeMinMag = 5 } = {}) {
  const lens = getTimeLens(lensId);
  const magNote = quakeMinMag > 5 ? ` at M≥${quakeMinMag}` : '';
  return `No events in the past ${lens.label.toLowerCase()}${magNote}`;
}
