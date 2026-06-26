import { Geopack } from 'geopack-ts/core';

const EARTH_RADIUS_M = 6_371_200;
const modelCache = new Map();
const dipPoleCache = new Map();

function dayOfYear(date) {
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - start) / 86_400_000);
}

function getModel(dateStr) {
  if (!modelCache.has(dateStr)) {
    const d = new Date(`${dateStr}T12:00:00Z`);
    const gp = new Geopack();
    gp.recalc(d.getUTCFullYear(), dayOfYear(d), 12, 0, 0, -400, 0, 0);
    modelCache.set(dateStr, gp);
    if (modelCache.size > 32) {
      const oldest = modelCache.keys().next().value;
      modelCache.delete(oldest);
    }
  }
  return modelCache.get(dateStr);
}

/**
 * IGRF-14 main field at geodetic lat/lon for a calendar date (UTC noon).
 * Returns north/east/down components in nT plus derived scalars.
 */
export function igrfFieldAt(lat, lon, dateStr, elevationM = 0) {
  const gp = getModel(dateStr);
  const r = 1 + (elevationM || 0) / EARTH_RADIUS_M;
  const colat = ((90 - lat) * Math.PI) / 180;
  const phi = (lon * Math.PI) / 180;
  const [br, btheta, bphi] = gp.igrfGeo(r, colat, phi);

  const northNt = -btheta;
  const eastNt = bphi;
  const downNt = -br;
  const horizontalNt = Math.hypot(northNt, eastNt);
  const totalNt = Math.hypot(horizontalNt, downNt);

  return {
    northNt,
    eastNt,
    downNt,
    horizontalNt,
    totalNt,
    declDeg: (Math.atan2(eastNt, northNt) * 180) / Math.PI,
    inclDeg: (Math.atan2(downNt, horizontalNt) * 180) / Math.PI,
    model: 'IGRF-14',
  };
}

function searchDipPole(dateStr, north) {
  const targetIncl = north ? 90 : -90;
  let best = { lat: north ? 80 : -80, lon: 0, err: Infinity };

  const latStart = north ? 55 : -90;
  const latEnd = north ? 90 : -55;
  for (let lat = latStart; lat <= latEnd; lat += 1) {
    for (let lon = -180; lon < 180; lon += 3) {
      const incl = igrfFieldAt(lat, lon, dateStr).inclDeg;
      const err = Math.abs(incl - targetIncl);
      if (err < best.err) best = { lat, lon, err };
    }
  }

  for (let lat = best.lat - 2; lat <= best.lat + 2; lat += 0.08) {
    for (let lon = best.lon - 6; lon <= best.lon + 6; lon += 0.25) {
      const incl = igrfFieldAt(lat, lon, dateStr).inclDeg;
      const err = Math.abs(incl - targetIncl);
      if (err < best.err) best = { lat, lon, err };
    }
  }

  return {
    lat: best.lat,
    lon: best.lon,
    hemisphere: north ? 'north' : 'south',
    inclinationDeg: igrfFieldAt(best.lat, best.lon, dateStr).inclDeg,
  };
}

/**
 * IGRF-14 geomagnetic dip poles (|inclination| ≈ 90°) for the scrub date.
 */
export function igrfDipPoles(dateStr) {
  if (dipPoleCache.has(dateStr)) return dipPoleCache.get(dateStr);

  const payload = {
    model: 'IGRF-14',
    date: dateStr,
    epistemic: 'modeled',
    north: searchDipPole(dateStr, true),
    south: searchDipPole(dateStr, false),
  };
  dipPoleCache.set(dateStr, payload);
  if (dipPoleCache.size > 64) {
    dipPoleCache.delete(dipPoleCache.keys().next().value);
  }
  return payload;
}



