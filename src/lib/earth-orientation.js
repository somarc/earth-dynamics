/**
 * Pure helpers: face a lon toward the camera, local solar phase, etc.
 * Coordinate system matches utils.latLonToVector3.
 */

/**
 * SurfaceGroup yaw (rad) so that `lon` sits on the +Z meridian (camera default).
 * @param {number} lon degrees −180..180
 */
export function surfaceYawToFaceLon(lon) {
  const theta = ((lon + 180) * Math.PI) / 180;
  // Unrotated equatorial point direction in XZ (matches latLonToVector3)
  const x = -Math.cos(theta);
  const z = Math.sin(theta);
  // Azimuth of that point from +Z; rotate world so it faces +Z
  return -Math.atan2(x, z);
}

/**
 * Fractional day 0–1 from a Date (UTC). Used to lerp ephemeris sun between day and next.
 */
export function utcDayPhase(date = new Date()) {
  const ms =
    date.getUTCHours() * 3600_000
    + date.getUTCMinutes() * 60_000
    + date.getUTCSeconds() * 1000
    + date.getUTCMilliseconds();
  return ms / 86_400_000;
}

/** Local civil day phase 0–1 (browser timezone). */
export function localDayPhase(date = new Date()) {
  const ms =
    date.getHours() * 3600_000
    + date.getMinutes() * 60_000
    + date.getSeconds() * 1000
    + date.getMilliseconds();
  return ms / 86_400_000;
}

/** YYYY-MM-DD in UTC. */
export function utcDateString(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** YYYY-MM-DD in local timezone. */
export function localDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Rough lon from timezone offset when GPS is unavailable.
 * 1° ≈ 4 minutes of solar time.
 */
export function approxLonFromTimezone(date = new Date()) {
  // getTimezoneOffset: minutes *behind* UTC (e.g. EST = 300)
  const eastMinutes = -date.getTimezoneOffset();
  const lon = eastMinutes / 4;
  return Math.max(-180, Math.min(180, lon));
}

/**
 * Pick nearest catalog date ≤ preferred (or first if all future).
 * @param {string[]} dates sorted ascending YYYY-MM-DD
 * @param {string} preferred
 */
export function nearestCatalogDate(dates, preferred) {
  if (!dates?.length) return null;
  if (dates.includes(preferred)) return preferred;
  let best = dates[0];
  for (const d of dates) {
    if (d <= preferred) best = d;
    else break;
  }
  // If preferred is before catalog start, use first; if after end, last
  if (preferred < dates[0]) return dates[0];
  if (preferred > dates[dates.length - 1]) return dates[dates.length - 1];
  return best;
}

export function formatLatLon(lat, lon, digits = 1) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lon >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(digits)}°${ns}, ${Math.abs(lon).toFixed(digits)}°${ew}`;
}
