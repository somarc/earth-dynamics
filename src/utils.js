export const EARTH_RADIUS = 1;
export const POLE_EXAGGERATION = 8000;

export function latLonToVector3(lat, lon, radius = EARTH_RADIUS) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -radius * Math.sin(phi) * Math.cos(theta),
    y: radius * Math.cos(phi),
    z: radius * Math.sin(phi) * Math.sin(theta),
  };
}

export function poleOffsetToTilt(xRad, yRad, exaggeration = POLE_EXAGGERATION) {
  return {
    tiltX: yRad * exaggeration,
    tiltZ: xRad * exaggeration,
  };
}

export function dateToIndex(dateStr, records) {
  let lo = 0;
  let hi = records.length - 1;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (records[mid].date <= dateStr) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive date range [endDate - days, endDate] (no future events). */
export function isDateInPastWindow(date, endDate, days = 7) {
  if (!date || !endDate) return false;
  return date >= addDays(endDate, -days) && date <= endDate;
}

export function filterEventsToPastWeek(frame, endDate, days = 7) {
  const start = addDays(endDate, -days);
  const inRange = (d) => isDateInPastWindow(d, endDate, days);

  const eruptions = (frame.eruptions || []).filter((v) => {
    const vEnd = v.endDate || endDate;
    return v.startDate <= endDate && vEnd >= start;
  });

  return {
    ...frame,
    earthquakes: (frame.earthquakes || []).filter((q) => inRange(q.date)),
    eruptions,
    storms: (frame.storms || []).filter((s) => inRange(s.date)),
    spaceWeather: (frame.spaceWeather || []).filter((e) => inRange(e.date)),
  };
}

export function quakeTimeMs(q) {
  const t = Number(q.time);
  if (!Number.isFinite(t)) return 0;
  return t > 1e12 ? t : t * 1000;
}

export function eventsOnDate(dateStr, earthquakes, eruptions, windowDays = 3, pastOnly = false) {
  const target = new Date(dateStr + 'T12:00:00Z').getTime();
  const windowMs = windowDays * 86400000;

  const quakes = earthquakes.filter((q) => {
    if (pastOnly) {
      return isDateInPastWindow(q.date, dateStr, windowDays);
    }
    const t = quakeTimeMs(q);
    return Math.abs(t - target) <= windowMs;
  });
  const volcs = eruptions.filter((e) => {
    const start = new Date(e.startDate + 'T12:00:00Z').getTime();
    const end = e.endDate
      ? new Date(e.endDate + 'T12:00:00Z').getTime()
      : Date.now();
    if (pastOnly) {
      const windowStart = target - windowMs;
      return start <= target && end >= windowStart;
    }
    return target >= start && target <= end;
  });

  return { quakes, volcs };
}

export const QUAKE_MAG_FLOORS = [5, 6, 7, 8];

/** Global catalog ingests M≥5; UI floor filters display only. */
export function filterQuakesByMinMag(quakes, minMag = 5) {
  if (!quakes?.length) return [];
  const floor = Number(minMag) || 5;
  return quakes.filter((q) => (q.mag ?? 0) >= floor);
}

export function magToSize(mag) {
  return 0.008 + Math.max(0, mag - 4) * 0.006;
}

export function veiToSize(vei) {
  return 0.01 + (vei || 0) * 0.008;
}