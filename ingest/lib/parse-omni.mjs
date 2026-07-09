/**
 * Pure parsers for NASA OMNI2 low-res hourly solar wind / Dst files.
 */

const FILL = new Set([999, 9999, 99999, 999999, 9999999, 999999.99, 99999.99]);

/**
 * OMNI fill / missing value check.
 * @param {number | null | undefined} val
 * @returns {boolean}
 */
export function isFill(val) {
  if (val == null || Number.isNaN(val)) return true;
  return FILL.has(val) || FILL.has(Math.round(val));
}

/**
 * Parse one OMNI2 hourly whitespace-separated data line.
 * Expects ≥42 fields (year, doy, hour, … bz@16, density@23, speed@24, dst@40).
 * @param {string} line
 * @returns {{
 *   year: number,
 *   doy: number,
 *   hour: number,
 *   bz: number | null,
 *   density: number | null,
 *   speed: number | null,
 *   dst: number | null,
 * } | null}
 */
export function parseOmniLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 42) return null;

  const year = parseInt(parts[0], 10);
  const doy = parseInt(parts[1], 10);
  const hour = parseInt(parts[2], 10);
  if (!year || !doy || hour > 23) return null;

  const bz = parseFloat(parts[16]);
  const density = parseFloat(parts[23]);
  const speed = parseFloat(parts[24]);
  const dst = parseInt(parts[40], 10);

  return {
    year,
    doy,
    hour,
    bz: isFill(bz) ? null : bz,
    density: isFill(density) ? null : density,
    speed: isFill(speed) ? null : speed,
    dst: isFill(dst) ? null : dst,
  };
}

/**
 * Convert year + day-of-year to YYYY-MM-DD (UTC).
 * @param {number} year
 * @param {number} doy
 * @returns {string}
 */
export function doyToDate(year, doy) {
  const d = new Date(Date.UTC(year, 0, 1, 12));
  d.setUTCDate(doy);
  return d.toISOString().slice(0, 10);
}

/**
 * Aggregate hourly OMNI rows into daily min Dst / min Bz and mean speed / density.
 * @param {Array<{
 *   year: number,
 *   doy: number,
 *   dst: number | null,
 *   speed: number | null,
 *   bz: number | null,
 *   density: number | null,
 * }>} hourlyRows
 * @returns {Array<{
 *   date: string,
 *   dstMin: number | null,
 *   speed: number | null,
 *   bzMin: number | null,
 *   density: number | null,
 * }>}
 */
export function aggregateDaily(hourlyRows) {
  const byDate = new Map();

  for (const row of hourlyRows) {
    const date = doyToDate(row.year, row.doy);
    let agg = byDate.get(date);
    if (!agg) {
      agg = { dstVals: [], speeds: [], bzs: [], densities: [] };
      byDate.set(date, agg);
    }
    if (row.dst != null) agg.dstVals.push(row.dst);
    if (row.speed != null) agg.speeds.push(row.speed);
    if (row.bz != null) agg.bzs.push(row.bz);
    if (row.density != null) agg.densities.push(row.density);
  }

  const out = [];
  for (const [date, agg] of byDate) {
    out.push({
      date,
      dstMin: agg.dstVals.length ? Math.min(...agg.dstVals) : null,
      speed: agg.speeds.length
        ? agg.speeds.reduce((a, b) => a + b, 0) / agg.speeds.length
        : null,
      bzMin: agg.bzs.length ? Math.min(...agg.bzs) : null,
      density: agg.densities.length
        ? agg.densities.reduce((a, b) => a + b, 0) / agg.densities.length
        : null,
    });
  }
  return out;
}
