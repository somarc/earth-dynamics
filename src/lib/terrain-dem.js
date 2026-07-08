/**
 * Real-world elevation loader for Wobblescope terrain layer.
 *
 * Adapted from monolith-terrain (https://github.com/kaolti/monolith-terrain)
 * Uses the same public AWS Open Data Terrain Tiles (Terrarium encoding).
 *
 * Encoding: meters = (R*256 + G + B/256) - 32768
 * Tiles: https://registry.opendata.aws/terrain-tiles/
 *
 * Attribution must be shown to users:
 *   "Terrain tiles by Mapzen / Tilezen, from the AWS Open Data Terrain Tiles dataset.
 *    Underlying data: SRTM (NASA), USGS 3DEP/NED, ETOPO1 (NOAA) and others."
 *
 * No API key required. Tiles are 256x256 PNG.
 */

const TILE_URL = (z, x, y) =>
  `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`;

const TILE_PX = 256;

/**
 * Load a square DEM patch centered on (lat, lon) at the given zoom level.
 * tilesAcross: odd number, e.g. 3 → 3x3 tiles (768px), 5 → 5x5 (1280px).
 *
 * Returns:
 * {
 *   data: Float32Array (height in meters),
 *   size: px,
 *   metersPerPixel,
 *   extentMeters,
 *   minM, maxM, meanM,
 *   lat, lon, zoom,
 *   about: attribution string
 * }
 */
export async function loadDem({ lat, lon, zoom, tilesAcross = 3 } = {}) {
  if (typeof lat !== 'number' || typeof lon !== 'number') {
    throw new Error('loadDem requires numeric lat/lon');
  }
  const n = 2 ** zoom;
  const latRad = (lat * Math.PI) / 180;

  // Web mercator tile coords (standard XYZ scheme)
  const cx = Math.floor(((lon + 180) / 360) * n);
  const cy = Math.floor(
    ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  );

  const half = Math.floor(tilesAcross / 2);
  const sizePx = tilesAcross * TILE_PX;

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = sizePx;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const jobs = [];
  for (let dy = -half; dy <= half; dy++) {
    for (let dx = -half; dx <= half; dx++) {
      const tx = (cx + dx + n) % n;
      const ty = cy + dy;
      if (ty < 0 || ty >= n) continue;

      jobs.push(
        fetch(TILE_URL(zoom, tx, ty))
          .then((r) => {
            if (!r.ok) {
              throw new Error(`elevation tile ${zoom}/${tx}/${ty} → HTTP ${r.status}`);
            }
            return r.blob();
          })
          .then((blob) => createImageBitmap(blob))
          .then((img) => {
            ctx.drawImage(img, (dx + half) * TILE_PX, (dy + half) * TILE_PX);
          })
      );
    }
  }

  await Promise.all(jobs);

  const rgba = ctx.getImageData(0, 0, sizePx, sizePx).data;
  const data = new Float32Array(sizePx * sizePx);
  let minM = Infinity;
  let maxM = -Infinity;
  let sum = 0;

  for (let i = 0; i < data.length; i++) {
    const m = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
    data[i] = m;
    if (m < minM) minM = m;
    if (m > maxM) maxM = m;
    sum += m;
  }

  const metersPerPixel = (156543.03392 * Math.cos(latRad)) / 2 ** zoom;
  const extentMeters = metersPerPixel * sizePx;
  const meanM = sum / data.length;

  return {
    data,
    size: sizePx,
    metersPerPixel,
    extentMeters,
    minM,
    maxM,
    meanM,
    lat,
    lon,
    zoom,
    about:
      'Terrain tiles by Mapzen/Tilezen from AWS Open Data Terrain Tiles (SRTM, USGS 3DEP, ETOPO1, …).',
  };
}

/** Bilinear sample of the height grid at fractional pixel coords (0..size). */
export function sampleDem(dem, px, py) {
  const { data, size } = dem;
  const x = Math.min(Math.max(px, 0), size - 1.001);
  const y = Math.min(Math.max(py, 0), size - 1.001);
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;

  const i = y0 * size + x0;
  const a = data[i];
  const b = data[i + 1];
  const c = data[i + size];
  const d = data[i + size + 1];

  return a + (b - a) * fx + (c - a) * fy + (a - b - c + d) * fx * fy;
}

/**
 * Convenience: load DEM for a named preset or custom coords.
 * Presets match popular monolith-terrain examples for easy testing.
 */
export const DEM_PRESETS = {
  'Monument Valley': { lat: 36.998, lon: -110.0984, zoom: 12 },
  'Grand Canyon': { lat: 36.0997, lon: -112.1124, zoom: 12 },
  'Mount Fuji': { lat: 35.3606, lon: 138.7274, zoom: 12 },
  'Everest Massif': { lat: 27.9881, lon: 86.925, zoom: 12 },
  'Home (Eastern Ontario)': { lat: 45.4215, lon: -75.6972, zoom: 11 },
};

export async function loadDemForPreset(name = 'Home (Eastern Ontario)', overrides = {}) {
  const base = DEM_PRESETS[name] || DEM_PRESETS['Home (Eastern Ontario)'];
  return loadDem({ ...base, ...overrides });
}
