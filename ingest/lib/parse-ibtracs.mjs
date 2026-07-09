/**
 * Pure parsers for NOAA IBTrACS v04 CSV cyclone tracks.
 */

/**
 * Parse a numeric CSV cell; blank / space-only → null.
 * @param {string | null | undefined} val
 * @returns {number | null}
 */
export function parseNum(val) {
  if (val == null || val === '' || val === ' ') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

/**
 * Map IBTrACS header line to column-name → index.
 * @param {string} headerLine
 * @returns {Record<string, number> | null}
 */
export function parseHeaderCols(headerLine) {
  if (!headerLine?.startsWith('SID,')) return null;
  return Object.fromEntries(headerLine.split(',').map((h, i) => [h.trim(), i]));
}

/**
 * Parse one IBTrACS data line using header column indices.
 * Skips non-main track types and rows missing iso/lat/lon.
 * @param {string} line
 * @param {Record<string, number>} cols
 * @returns {{
 *   sid: string,
 *   season: number | null,
 *   name: string,
 *   basin: string,
 *   isoTime: string,
 *   date: string,
 *   lat: number,
 *   lon: number,
 *   windKts: number | null,
 *   sshs: number | null,
 * } | null}
 */
export function parseRow(line, cols) {
  const parts = line.split(',');
  if (parts.length < 15) return null;

  const trackType = parts[cols.TRACK_TYPE]?.trim();
  if (trackType && trackType !== 'main') return null;

  const iso = parts[cols.ISO_TIME]?.trim();
  const lat = parseNum(parts[cols.LAT]);
  const lon = parseNum(parts[cols.LON]);
  if (!iso || lat == null || lon == null) return null;

  const wind =
    parseNum(parts[cols.USA_WIND]) ??
    parseNum(parts[cols.WMO_WIND]) ??
    parseNum(parts[cols.TOKYO_WIND]);
  const sshs = parseNum(parts[cols.USA_SSHS]);

  return {
    sid: parts[cols.SID]?.trim(),
    season: parseInt(parts[cols.SEASON], 10) || null,
    name: (parts[cols.NAME]?.trim() || 'UNNAMED').replace(/^UNNAMED$/i, 'Unnamed'),
    basin: parts[cols.BASIN]?.trim() || '',
    isoTime: iso,
    date: iso.slice(0, 10),
    lat,
    lon,
    windKts: wind,
    sshs: sshs != null ? Math.round(sshs) : null,
  };
}

/**
 * Collapse ordered track points into one cyclone_storms row shape.
 * @param {string} sid
 * @param {Array<{
 *   date: string,
 *   isoTime: string,
 *   name: string,
 *   basin: string,
 *   season: number | null,
 *   lat: number,
 *   lon: number,
 *   windKts: number | null,
 *   sshs: number | null,
 * }>} points
 * @returns {{
 *   sid: string,
 *   name: string,
 *   basin: string,
 *   season: number | null,
 *   start_date: string,
 *   end_date: string,
 *   max_wind_kts: number | null,
 *   max_sshs: number | null,
 *   track_json: string,
 * } | null}
 */
export function finalizeStorm(sid, points) {
  if (!points.length) return null;
  points.sort((a, b) => a.date.localeCompare(b.date) || a.isoTime.localeCompare(b.isoTime));

  let maxWind = null;
  let maxSshs = null;
  for (const p of points) {
    if (p.windKts != null) maxWind = maxWind == null ? p.windKts : Math.max(maxWind, p.windKts);
    if (p.sshs != null) maxSshs = maxSshs == null ? p.sshs : Math.max(maxSshs, p.sshs);
  }

  const head = points[0];
  return {
    sid,
    name: head.name,
    basin: head.basin,
    season: head.season,
    start_date: points[0].date,
    end_date: points.at(-1).date,
    max_wind_kts: maxWind,
    max_sshs: maxSshs,
    track_json: JSON.stringify(
      points.map(({ date, lat, lon, windKts, sshs }) => ({
        date,
        lat,
        lon,
        windKts,
        sshs,
      })),
    ),
  };
}
