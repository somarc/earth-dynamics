import { eventsOnDate } from './utils.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

async function api(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

async function loadFromJson() {
  const [manifest, eop, earthquakes, eruptions, ephemeris] = await Promise.all([
    fetch('/data/manifest.json').then((r) => r.json()),
    fetch('/data/eop.json').then((r) => r.json()),
    fetch('/data/earthquakes.json').then((r) => r.json()),
    fetch('/data/eruptions.json').then((r) => r.json()),
    fetch('/data/ephemeris.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
  ]);
  return {
    mode: 'json',
    manifest,
    dates: eop.map((r) => r.date),
    eop,
    earthquakes,
    eruptions,
    ephemeris,
  };
}

export async function loadCatalog() {
  try {
    const [meta, datesRes] = await Promise.all([
      api('/api/meta'),
      api('/api/dates'),
    ]);
    return {
      mode: 'api',
      manifest: meta,
      dates: datesRes.dates,
      eop: null,
      earthquakes: null,
      eruptions: null,
      ephemeris: null,
    };
  } catch {
    return loadFromJson();
  }
}

function ephWindowToChart(ephWindow, selectedDate, ephemerisDay) {
  const dates = ephWindow.map((e) => e.date);
  const byDate = Object.fromEntries(ephWindow.map((e) => [e.date, e]));

  // Timeline can extend past the last ingested ephemeris row; day.ephemeris still
  // resolves via API fallback — inject it so the ecliptic chart can render.
  if (selectedDate && ephemerisDay && !byDate[selectedDate]) {
    const lastInWindow = dates[dates.length - 1] ?? null;
    byDate[selectedDate] = {
      ...ephemerisDay,
      date: selectedDate,
      _ephemerisAsOf: lastInWindow,
    };
    dates.push(selectedDate);
  }

  return { dates, byDate };
}

export async function loadFrame(catalog, date, currentIndex, { recentOnly = false } = {}) {
  if (catalog.mode === 'api') {
    const dayPath = recentOnly ? `/api/day/${date}?past=7` : `/api/day/${date}`;
    const [day, eopWindow, ephWindow, ephOrbit, geoWindow, aamWindow] = await Promise.all([
      api(dayPath),
      api(`/api/eop/window?end=${date}&days=400`),
      api(`/api/ephemeris/window?end=${date}&days=28`),
      api(`/api/ephemeris/window?end=${date}&days=365`),
      api(`/api/geomagnetic/window?end=${date}&days=28`).catch(() => []),
      api(`/api/aam/window?end=${date}&days=400`).catch(() => []),
    ]);
    return {
      record: day.eop,
      eopWindow,
      ephemerisDay: day.ephemeris,
      ephemerisForChart: ephWindowToChart(ephWindow, date, day.ephemeris),
      ephemerisOrbit: ephWindowToChart(ephOrbit, date, day.ephemeris),
      aam: day.aam,
      aamWindow,
      earthquakes: day.earthquakes,
      eruptions: day.eruptions,
      cyclones: day.cyclones || [],
      storms: day.storms || [],
      weather: day.weather || [],
      solar: day.solar,
      geomagnetic: day.geomagnetic,
      spaceWeather: day.spaceWeather || [],
      geomagneticWindow: geoWindow,
      magnetometers: day.magnetometers || [],
      magneticPoles: day.magneticPoles || null,
      asOf: day.asOf || null,
      coverage: day.coverage || null,
      requestedDate: day.date || date,
    };
  }

  const record = catalog.eop[currentIndex];
  const trailStart = Math.max(0, currentIndex - 400);
  const eopWindow = catalog.eop.slice(trailStart, currentIndex + 1);
  const ephemerisDay = catalog.ephemeris?.byDate?.[date] ?? null;

  const { quakes, volcs } = eventsOnDate(
    date, catalog.earthquakes, catalog.eruptions, 7, recentOnly,
  );

  return {
    record,
    eopWindow,
    ephemerisDay,
    ephemerisForChart: catalog.ephemeris,
    earthquakes: quakes,
    eruptions: volcs,
    storms: [],
    weather: [],
    solar: null,
  };
}