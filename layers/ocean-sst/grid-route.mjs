import { fetchWithRetry } from '../../ingest/lib/fetch-with-retry.mjs';

const CACHE = new Map();
const CACHE_MS = 60 * 60 * 1000;

function tropicalCoords() {
  const lats = [-20, -10, 0, 10, 20];
  const lons = [];
  for (let lon = -165; lon <= 165; lon += 30) lons.push(lon);
  const points = [];
  for (const lat of lats) {
    for (const lon of lons) points.push({ lat, lon });
  }
  return points;
}

export async function fetchTropicalTempGrid(date) {
  const key = date.slice(0, 10);
  const hit = CACHE.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data;

  const coords = tropicalCoords();
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', coords.map((c) => c.lat).join(','));
  url.searchParams.set('longitude', coords.map((c) => c.lon).join(','));
  url.searchParams.set('start_date', key);
  url.searchParams.set('end_date', key);
  url.searchParams.set('daily', 'temperature_2m_mean');
  url.searchParams.set('timezone', 'UTC');

  const res = await fetchWithRetry(url.toString());
  const json = await res.json();
  const items = Array.isArray(json) ? json : [json];
  const points = items.map((item) => ({
    lat: item.latitude,
    lon: item.longitude,
    tempC: item.daily?.temperature_2m_mean?.[0] ?? null,
  }));

  const data = {
    date: key,
    points,
    source: 'open-meteo-era5',
    syncClass: 'nowcast',
    scaleClass: 'grid',
    epistemic: 'modeled',
    note: 'ERA5 2m mean · 30°×10° tropical band · on-demand per scrub date',
  };
  CACHE.set(key, { at: Date.now(), data });
  return data;
}