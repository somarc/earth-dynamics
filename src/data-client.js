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

function ephWindowToChart(ephWindow) {
  return {
    dates: ephWindow.map((e) => e.date),
    byDate: Object.fromEntries(ephWindow.map((e) => [e.date, e])),
  };
}

export async function loadFrame(catalog, date, currentIndex) {
  if (catalog.mode === 'api') {
    const [day, eopWindow, ephWindow, ephOrbit, geoWindow] = await Promise.all([
      api(`/api/day/${date}`),
      api(`/api/eop/window?end=${date}&days=400`),
      api(`/api/ephemeris/window?end=${date}&days=28`),
      api(`/api/ephemeris/window?end=${date}&days=365`),
      api(`/api/geomagnetic/window?end=${date}&days=28`).catch(() => []),
    ]);
    return {
      record: day.eop,
      eopWindow,
      ephemerisDay: day.ephemeris,
      ephemerisForChart: ephWindowToChart(ephWindow),
      ephemerisOrbit: ephOrbit,
      earthquakes: day.earthquakes,
      eruptions: day.eruptions,
      storms: day.storms || [],
      weather: day.weather || [],
      solar: day.solar,
      geomagnetic: day.geomagnetic,
      spaceWeather: day.spaceWeather || [],
      geomagneticWindow: geoWindow,
    };
  }

  const record = catalog.eop[currentIndex];
  const trailStart = Math.max(0, currentIndex - 400);
  const eopWindow = catalog.eop.slice(trailStart, currentIndex + 1);
  const ephemerisDay = catalog.ephemeris?.byDate?.[date] ?? null;

  const { eventsOnDate } = await import('./utils.js');
  const { quakes, volcs } = eventsOnDate(date, catalog.earthquakes, catalog.eruptions, 7);

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