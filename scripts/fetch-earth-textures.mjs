#!/usr/bin/env node
/**
 * Fetch 8k global Earth day/night textures from NASA GIBS and build a land mask.
 * Output: public/textures/earth-day.jpg, earth-night.jpg, earth-mask.png, earth-manifest.json
 */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'public/textures');
const USER_AGENT = 'Wobblescope/0.2 (earth-dynamics; texture-fetch)';

const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
const RES_PRESETS = {
  '8k': { width: 8192, height: 4096 },
  '4k': { width: 4096, height: 2048 },
};

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function landMaskByte(r, g, b) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const lum = 0.299 * rn + 0.587 * gn + 0.114 * bn;
  const iceMask = smoothstep(0.52, 0.8, lum) * (bn < rn + 0.06 ? 1 : 0);
  const oceanScore = bn * 1.18 - rn * 0.58 - gn * 0.52;
  const oceanMask = smoothstep(0.02, 0.24, oceanScore) * (1 - iceMask * 0.92);
  return Math.round((1 - oceanMask) * 255);
}

async function fetchGibsLayer(layer, { width, height }) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: layer,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: '-180,-90,180,90',
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

async function buildLandMask(dayJpeg, width, height) {
  const { data, info } = await sharp(dayJpeg).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const mask = Buffer.alloc(info.width * info.height);
  for (let i = 0, p = 0; i < data.length; i += info.channels, p++) {
    mask[p] = landMaskByte(data[i], data[i + 1], data[i + 2]);
  }
  return sharp(mask, { raw: { width: info.width, height: info.height, channels: 1 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

async function main() {
  const resArg = process.argv.find((a) => a.startsWith('--res='))?.split('=')[1] || '8k';
  const size = RES_PRESETS[resArg] ?? RES_PRESETS['8k'];
  mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Fetching NASA GIBS Earth textures (${size.width}×${size.height})…`);
  const [dayBuf, nightBuf] = await Promise.all([
    fetchGibsLayer('BlueMarble_NextGeneration', size),
    fetchGibsLayer('VIIRS_Black_Marble', size),
  ]);

  console.log('  Building land/ocean mask from day texture…');
  const maskBuf = await buildLandMask(dayBuf, size.width, size.height);

  const dayPath = join(OUT_DIR, 'earth-day.jpg');
  const nightPath = join(OUT_DIR, 'earth-night.jpg');
  const maskPath = join(OUT_DIR, 'earth-mask.png');
  const manifestPath = join(OUT_DIR, 'earth-manifest.json');

  writeFileSync(dayPath, dayBuf);
  writeFileSync(nightPath, nightBuf);
  writeFileSync(maskPath, maskBuf);

  const manifest = {
    generatedAt: new Date().toISOString(),
    resolution: `${size.width}x${size.height}`,
    projection: 'EPSG:4326 equirectangular',
    about:
      'Global cloud-free Blue Marble day surface and VIIRS Black Marble night lights from NASA GIBS, plus a derived land mask for hybrid ocean transparency.',
    assets: {
      day: 'earth-day.jpg',
      night: 'earth-night.jpg',
      mask: 'earth-mask.png',
    },
    sources: [
      {
        id: 'gibs-blue-marble-ng',
        role: 'day',
        name: 'Blue Marble Next Generation',
        org: 'NASA GIBS / NASA Earth Observatory',
        layer: 'BlueMarble_NextGeneration',
        link: 'https://gibs.earthdata.nasa.gov/',
        epistemic: 'derived',
        citation:
          'NASA Global Imagery Browse Services (GIBS), BlueMarble_NextGeneration composite',
      },
      {
        id: 'gibs-viirs-black-marble',
        role: 'night',
        name: 'VIIRS Black Marble',
        org: 'NASA GIBS / NOAA VIIRS Day/Night Band',
        layer: 'VIIRS_Black_Marble',
        link: 'https://earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs',
        epistemic: 'measured',
        citation: 'NASA GIBS VIIRS_Black_Marble night lights composite',
      },
      {
        id: 'wobblescope-land-mask',
        role: 'mask',
        name: 'Derived land/ocean mask',
        org: 'Wobblescope',
        epistemic: 'derived',
        citation:
          'Land mask derived from day texture chroma (land=opaque, ocean=translucent in hybrid globe mode)',
      },
    ],
    kmPerPixelEquator: Math.round(40_075 / size.width),
  };

  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(
    `Wrote ${dayPath}\n     ${nightPath}\n     ${maskPath}\n     ${manifestPath}`,
  );
  console.log(`  ~${manifest.kmPerPixelEquator} km/px at equator`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});