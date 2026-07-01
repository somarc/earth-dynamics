#!/usr/bin/env node
/**
 * Fetch high-resolution regional day/night imagery for the configured home bbox.
 * Output: public/textures/home/day.jpg, night.jpg, public/data/home-region.json
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_TEX = join(ROOT, 'public/textures/home');
const OUT_DATA = join(ROOT, 'public/data');
const USER_AGENT = 'Wobblescope/0.2 (earth-dynamics; home-imagery-fetch)';

const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';

/** Eastern Ontario — Ottawa, Kingston, Cornwall corridor. Edit and re-run to retarget. */
const HOME = {
  id: 'eastern-ontario',
  name: 'Eastern Ontario',
  label: 'Home',
  bbox: { west: -82.0, south: 43.5, east: -74.0, north: 47.5 },
  center: { lat: 45.4215, lon: -75.6972, name: 'Ottawa' },
  width: 8192,
};

function parseBboxArg() {
  const arg = process.argv.find((a) => a.startsWith('--bbox='));
  if (!arg) return null;
  const [west, south, east, north] = arg.slice(7).split(',').map(Number);
  if ([west, south, east, north].some((n) => Number.isNaN(n))) {
    throw new Error('--bbox expects west,south,east,north (degrees)');
  }
  return { west, south, east, north };
}

function parseCenterArg() {
  const arg = process.argv.find((a) => a.startsWith('--center='));
  if (!arg) return null;
  const [lat, lon] = arg.slice(9).split(',').map(Number);
  if ([lat, lon].some((n) => Number.isNaN(n))) {
    throw new Error('--center expects lat,lon (degrees)');
  }
  return { lat, lon };
}

async function fetchGibsRegion(layer, bbox, width, height) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layer,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    WIDTH: String(width),
    HEIGHT: String(height),
    FORMAT: 'image/jpeg',
  });
  const url = `${GIBS}?${params}`;
  console.log(`  GET ${layer} (${width}×${height})…`);
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) throw new Error(`${layer} → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function kmSpan(bbox) {
  const midLat = (bbox.south + bbox.north) / 2;
  const latKm = (bbox.north - bbox.south) * 111.32;
  const lonKm = (bbox.east - bbox.west) * 111.32 * Math.cos((midLat * Math.PI) / 180);
  return { latKm, lonKm, midLat };
}

async function main() {
  const bboxOverride = parseBboxArg();
  const centerOverride = parseCenterArg();
  const bbox = bboxOverride ?? HOME.bbox;
  const center = centerOverride ?? HOME.center;
  const lonSpan = bbox.east - bbox.west;
  const latSpan = bbox.north - bbox.south;
  const width = HOME.width;
  const height = Math.round(width * (latSpan / lonSpan));
  const { latKm, lonKm } = kmSpan(bbox);

  mkdirSync(OUT_TEX, { recursive: true });
  mkdirSync(OUT_DATA, { recursive: true });

  console.log(
    `Fetching home imagery: ${HOME.name} (${bbox.west}°W–${Math.abs(bbox.east)}°${bbox.east < 0 ? 'W' : 'E'}, ${bbox.south}°N–${bbox.north}°N)`,
  );
  console.log(`  Resolution ${width}×${height} (~${Math.round((lonKm * 1000) / width)} m/px E–W)`);

  const [dayBuf, nightBuf] = await Promise.all([
    fetchGibsRegion('BlueMarble_NextGeneration', bbox, width, height),
    fetchGibsRegion('VIIRS_Black_Marble', bbox, width, height),
  ]);

  const dayPath = join(OUT_TEX, 'day.jpg');
  const nightPath = join(OUT_TEX, 'night.jpg');
  const manifestPath = join(OUT_DATA, 'home-region.json');

  writeFileSync(dayPath, dayBuf);
  writeFileSync(nightPath, nightBuf);

  const manifest = {
    generatedAt: new Date().toISOString(),
    id: HOME.id,
    name: HOME.name,
    label: HOME.label,
    bbox,
    center,
    resolution: `${width}x${height}`,
    projection: 'EPSG:4326 geographic',
    extentKm: { width: Math.round(lonKm), height: Math.round(latKm) },
    metersPerPixel: {
      eastWest: Math.round((lonKm * 1000) / width),
      northSouth: Math.round((latKm * 1000) / height),
    },
    about:
      'High-resolution regional day/night surface patch draped on the globe. Global 8k texture stays as coarse context; this bbox is the detail layer where you live.',
    assets: {
      day: '/textures/home/day.jpg',
      night: '/textures/home/night.jpg',
    },
    sources: [
      {
        id: 'gibs-blue-marble-ng-regional',
        role: 'day',
        name: 'Blue Marble Next Generation (regional)',
        org: 'NASA GIBS',
        layer: 'BlueMarble_NextGeneration',
        link: 'https://gibs.earthdata.nasa.gov/',
        epistemic: 'derived',
      },
      {
        id: 'gibs-viirs-black-marble-regional',
        role: 'night',
        name: 'VIIRS Black Marble (regional)',
        org: 'NASA GIBS / NOAA VIIRS',
        layer: 'VIIRS_Black_Marble',
        link: 'https://gibs.earthdata.nasa.gov/',
        epistemic: 'measured',
      },
    ],
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Wrote ${dayPath}\n     ${nightPath}\n     ${manifestPath}`);
  console.log(`  ~${manifest.metersPerPixel.eastWest} m/px — zoom in over ${center.name ?? 'home center'}`);

  const { importHomeFromDisk } = await import('../ingest/home-store.mjs');
  const stored = importHomeFromDisk();
  console.log(`  → SQLite (${stored.assets} assets, ${(stored.bytes / 1_048_576).toFixed(1)} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});