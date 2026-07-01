/** Shared terrain mosaic helpers for cross-border LiDAR hillshade ingest. */

export const CA_WMS = 'https://datacube.services.geo.ca/ows/elevation';
export const PC_STAC = 'https://planetarycomputer.microsoft.com/api/stac/v1';
export const PC_SIGN = 'https://planetarycomputer.microsoft.com/api/sas/v1/sign';

export function metersPerDegree(lat) {
  const rad = (lat * Math.PI) / 180;
  return {
    lat: 111_320,
    lon: 111_320 * Math.cos(rad),
  };
}

export function gridSizeForBbox(bbox, targetWidth = 2048) {
  const midLat = (bbox.south + bbox.north) / 2;
  const m = metersPerDegree(midLat);
  const widthM = (bbox.east - bbox.west) * m.lon;
  const heightM = (bbox.north - bbox.south) * m.lat;
  const width = targetWidth;
  const height = Math.max(64, Math.round(width * (heightM / widthM)));
  return { width, height, widthM, heightM };
}

export function lonLatToPixel(lon, lat, bbox, width, height) {
  const x = ((lon - bbox.west) / (bbox.east - bbox.west)) * (width - 1);
  const y = ((bbox.north - lat) / (bbox.north - bbox.south)) * (height - 1);
  return { x, y };
}

export function pixelToLonLat(x, y, bbox, width, height) {
  const lon = bbox.west + (x / (width - 1)) * (bbox.east - bbox.west);
  const lat = bbox.north - (y / (height - 1)) * (bbox.north - bbox.south);
  return { lon, lat };
}

/** Canada west, US east — smooth blend across the international border. */
export function borderBlendWeight(lon, { borderLon = -75.35, featherDeg = 0.35 } = {}) {
  const t = (lon - (borderLon - featherDeg)) / (2 * featherDeg);
  return Math.max(0, Math.min(1, t));
}

export function computeHillshade(
  elev,
  width,
  height,
  cellSizeM,
  { azimuth = 315, altitude = 45, nodata = -9999 } = {},
) {
  const out = new Uint8Array(width * height);
  const zenith = ((90 - altitude) * Math.PI) / 180;
  const az = (azimuth * Math.PI) / 180;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const z = elev[idx];
      if (z <= nodata + 1 || Number.isNaN(z)) {
        out[idx] = 128;
        continue;
      }
      const xl = Math.max(0, x - 1);
      const xr = Math.min(width - 1, x + 1);
      const yu = Math.max(0, y - 1);
      const yd = Math.min(height - 1, y + 1);
      const z1 = elev[yu * width + xl];
      const z2 = elev[yu * width + x];
      const z3 = elev[yu * width + xr];
      const z4 = elev[y * width + xl];
      const z6 = elev[y * width + xr];
      const z7 = elev[yd * width + xl];
      const z8 = elev[yd * width + x];
      const z9 = elev[yd * width + xr];
      if ([z1, z2, z3, z4, z6, z7, z8, z9].some((v) => v <= nodata + 1 || Number.isNaN(v))) {
        out[idx] = 128;
        continue;
      }
      const dzdx = ((z3 + 2 * z6 + z9) - (z1 + 2 * z4 + z7)) / (8 * cellSizeM);
      const dzdy = ((z7 + 2 * z8 + z9) - (z1 + 2 * z2 + z3)) / (8 * cellSizeM);
      const slope = Math.atan(Math.hypot(dzdx, dzdy));
      let aspect = Math.atan2(dzdy, -dzdx);
      if (aspect < 0) aspect += 2 * Math.PI;
      const raw =
        255 *
        (Math.cos(zenith) * Math.cos(slope) +
          Math.sin(zenith) * Math.sin(slope) * Math.cos(az - aspect));
      out[idx] = Math.max(0, Math.min(255, Math.round(raw)));
    }
  }
  return out;
}

export async function signPcHref(href) {
  const res = await fetch(`${PC_SIGN}?href=${encodeURIComponent(href)}`);
  if (!res.ok) throw new Error(`PC sign failed: ${res.status}`);
  const data = await res.json();
  return data.href;
}

export async function fetchCaHillshade(bbox, { width, height }) {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.3.0',
    REQUEST: 'GetMap',
    BBOX: `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`,
    CRS: 'EPSG:4326',
    WIDTH: String(width),
    HEIGHT: String(height),
    LAYERS: 'dtm-hillshade',
    STYLES: '',
    FORMAT: 'image/png',
  });
  const res = await fetch(`${CA_WMS}?${params}`, { redirect: 'follow' });
  if (!res.ok) throw new Error(`CA WMS hillshade → ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}