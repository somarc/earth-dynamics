#!/usr/bin/env node
/**
 * Build NA radar site registry (US NOAA + Canada MSC) for Wobblescope coverage map.
 * Output: public/data/radar-sites.json
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/data/radar-sites.json');

const NOAA_URL = 'https://api.weather.gov/radar/stations';
const MSC_IMPACT_URL =
  'https://dd.weather.gc.ca/today/radar/visibility/20250113_MSC_Radar-ImpactZones.json';
const USER_AGENT = 'Wobblescope/0.2 (earth-dynamics; radar-site-registry)';

/** Nominal low-level reflectivity reach — pedagogical circles, not beam-height truth. */
const NOMINAL_RANGE_KM = {
  'WSR-88D': 230,
  TDWR: 90,
  'MSC-S-BAND': 300,
};

function polygonCentroid(coords) {
  const ring = coords[0];
  let lat = 0;
  let lon = 0;
  for (const [x, y] of ring) {
    lon += x;
    lat += y;
  }
  return { lat: lat / ring.length, lon: lon / ring.length };
}

function inNaBbox(lon, lat) {
  return lat >= 15 && lat <= 72 && lon >= -180 && lon <= -50;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

function mapNoaaSite(feature) {
  const [lon, lat] = feature.geometry.coordinates;
  const p = feature.properties;
  const stationType = p.stationType || 'WSR-88D';
  const lastSweep = p.latency?.levelTwoLastReceivedTime ?? p.rda?.timestamp ?? null;
  const status = p.rda?.properties?.operabilityStatus ?? p.rda?.properties?.status ?? null;
  return {
    siteId: p.id,
    name: p.name,
    network: 'NOAA',
    country: 'US',
    lat,
    lon,
    elevM: p.elevation?.value ?? null,
    stationType,
    rangeKmNominal: NOMINAL_RANGE_KM[stationType] ?? 230,
    status,
    lastSweep,
    sourceUrl: p['@id'] || `https://api.weather.gov/radar/stations/${p.id}`,
    sourceCitation: 'NOAA NWS Radar Stations API',
  };
}

function mapMscSite(feature) {
  const { site_id: siteId, site_name: name } = feature.properties;
  const { lat, lon } = polygonCentroid(feature.geometry.coordinates);
  return {
    siteId,
    name: name?.trim() || siteId,
    network: 'MSC',
    country: 'CA',
    lat,
    lon,
    elevM: null,
    stationType: 'MSC-S-BAND',
    rangeKmNominal: NOMINAL_RANGE_KM['MSC-S-BAND'],
    status: 'operational',
    lastSweep: null,
    sourceUrl: 'https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_en/',
    sourceCitation: 'Environment and Climate Change Canada — radar impact zones (site centroid)',
  };
}

async function main() {
  console.log('Fetching NOAA radar stations…');
  const noaa = await fetchJson(NOAA_URL);

  console.log('Fetching MSC Canada radar impact zones…');
  let msc;
  try {
    msc = await fetchJson(MSC_IMPACT_URL);
  } catch (err) {
    console.warn(`MSC fetch failed (${err.message}) — US-only registry`);
    msc = { features: [] };
  }

  const usSites = (noaa.features || [])
    .filter((f) => inNaBbox(...f.geometry.coordinates))
    .map(mapNoaaSite)
    .sort((a, b) => a.siteId.localeCompare(b.siteId));

  const caSeen = new Set();
  const caSites = [];
  for (const f of msc.features || []) {
    const id = f.properties?.site_id;
    if (!id || caSeen.has(id)) continue;
    if (!f.properties?.impact_zone?.startsWith('Definite')) continue;
    caSeen.add(id);
    caSites.push(mapMscSite(f));
  }
  caSites.sort((a, b) => a.siteId.localeCompare(b.siteId));

  const sites = [...usSites, ...caSites];
  const byNetwork = sites.reduce((acc, s) => {
    acc[s.network] = (acc[s.network] || 0) + 1;
    return acc;
  }, {});

  const payload = {
    generatedAt: new Date().toISOString(),
    about:
      'North American weather radar site registry. Dashed rings show nominal low-level reflectivity reach per agency documentation — an aggregation of overlapping circles, not seamless coverage. Terrain, beam height, and outages create gaps.',
    coverageNote:
      'No objective 100% precipitation truth. US composites (e.g. MRMS) merge NEXRAD/TDWR sweeps; Canada uses MSC S-band products. Areas outside all rings are uncovered by this network.',
    sources: [
      {
        id: 'noaa-nws-radar',
        name: 'NOAA NWS Radar Stations',
        org: 'NOAA National Weather Service',
        link: 'https://api.weather.gov/radar/stations',
        epistemic: 'measured',
      },
      {
        id: 'msc-radar',
        name: 'MSC Canadian Weather Radar Network',
        org: 'Environment and Climate Change Canada',
        link: 'https://eccc-msc.github.io/open-data/msc-data/obs_radar/readme_radar_en/',
        epistemic: 'measured',
      },
    ],
    nominalRangesKm: NOMINAL_RANGE_KM,
    counts: {
      total: sites.length,
      us: usSites.length,
      ca: caSites.length,
      wsr88d: usSites.filter((s) => s.stationType === 'WSR-88D').length,
      tdwr: usSites.filter((s) => s.stationType === 'TDWR').length,
      byNetwork,
    },
    sites,
  };

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(
    `Wrote ${sites.length} sites (${usSites.length} US, ${caSites.length} CA) → public/data/radar-sites.json`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});