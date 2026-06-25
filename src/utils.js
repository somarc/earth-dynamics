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

export function eventsOnDate(dateStr, earthquakes, eruptions, windowDays = 3, pastOnly = false) {
  const target = new Date(dateStr + 'T12:00:00Z').getTime();
  const windowMs = windowDays * 86400000;

  const quakes = earthquakes.filter((q) => {
    const t = q.time * 1000;
    if (pastOnly) {
      return t >= target - windowMs && t <= target;
    }
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

export function magToSize(mag) {
  return 0.008 + Math.max(0, mag - 4) * 0.006;
}

export function veiToSize(vei) {
  return 0.01 + (vei || 0) * 0.008;
}