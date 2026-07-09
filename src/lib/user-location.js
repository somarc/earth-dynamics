/**
 * Resolve a viewer location for default globe orientation.
 * GPS → last saved → timezone approximation.
 */

import {
  approxLonFromTimezone,
  formatLatLon,
} from './earth-orientation.js';

export const USER_LOCATION_KEY = 'wobblescope-user-location';

/**
 * @typedef {{ lat: number, lon: number, source: 'gps'|'saved'|'timezone'|'manual', label?: string, accuracyM?: number, at?: string }} UserLocation
 */

/** @returns {UserLocation | null} */
export function loadSavedUserLocation() {
  try {
    const raw = localStorage.getItem(USER_LOCATION_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!Number.isFinite(o?.lat) || !Number.isFinite(o?.lon)) return null;
    return {
      lat: clampLat(o.lat),
      lon: clampLon(o.lon),
      source: o.source || 'saved',
      label: o.label,
      accuracyM: o.accuracyM,
      at: o.at,
    };
  } catch {
    return null;
  }
}

/** @param {UserLocation} loc */
export function saveUserLocation(loc) {
  try {
    localStorage.setItem(
      USER_LOCATION_KEY,
      JSON.stringify({
        lat: loc.lat,
        lon: loc.lon,
        source: loc.source,
        label: loc.label,
        accuracyM: loc.accuracyM,
        at: loc.at || new Date().toISOString(),
      }),
    );
  } catch {
    /* ignore */
  }
}

function clampLat(lat) {
  return Math.max(-85, Math.min(85, lat));
}

function clampLon(lon) {
  let x = lon;
  while (x > 180) x -= 360;
  while (x < -180) x += 360;
  return x;
}

/** Timezone-only fallback (no network). */
export function timezoneFallbackLocation(date = new Date()) {
  return {
    lat: 35,
    lon: approxLonFromTimezone(date),
    source: 'timezone',
    label: 'Timezone estimate',
    at: date.toISOString(),
  };
}

/**
 * @param {{ timeoutMs?: number, enableHighAccuracy?: boolean }} [opts]
 * @returns {Promise<UserLocation>}
 */
export function resolveUserLocation(opts = {}) {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const saved = loadSavedUserLocation();

  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return Promise.resolve(saved || timezoneFallbackLocation());
  }

  return new Promise((resolve) => {
    let settled = false;
    const done = (loc) => {
      if (settled) return;
      settled = true;
      if (loc.source === 'gps' || loc.source === 'manual') saveUserLocation(loc);
      resolve(loc);
    };

    const timer = setTimeout(() => {
      done(saved || timezoneFallbackLocation());
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        done({
          lat: clampLat(pos.coords.latitude),
          lon: clampLon(pos.coords.longitude),
          source: 'gps',
          accuracyM: pos.coords.accuracy,
          label: 'GPS',
          at: new Date().toISOString(),
        });
      },
      () => {
        clearTimeout(timer);
        done(saved || timezoneFallbackLocation());
      },
      {
        enableHighAccuracy: opts.enableHighAccuracy ?? false,
        timeout: timeoutMs - 200,
        maximumAge: 3_600_000,
      },
    );
  });
}

export function locationStatusText(loc) {
  if (!loc) return 'Location unknown';
  const where = formatLatLon(loc.lat, loc.lon);
  if (loc.source === 'gps') {
    const acc = loc.accuracyM != null ? ` ±${Math.round(loc.accuracyM)}m` : '';
    return `GPS ${where}${acc}`;
  }
  if (loc.source === 'saved') return `Saved ${where}`;
  if (loc.source === 'manual') return `Manual ${where}`;
  return `Approx ${where} (timezone)`;
}
