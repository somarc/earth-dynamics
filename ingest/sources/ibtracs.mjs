import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, logIngest, wasIngested } from '../db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '..', 'data');
const CACHE_FILE = join(CACHE_DIR, 'ibtracs-since1980.csv');

const IBTRACS_URL =
  'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv';

function parseNum(val) {
  if (val == null || val === '' || val === ' ') return null;
  const n = parseFloat(val);
  return Number.isFinite(n) ? n : null;
}

function parseRow(line, cols) {
  const parts = line.split(',');
  if (parts.length < 15) return null;

  const trackType = parts[cols.TRACK_TYPE]?.trim();
  if (trackType && trackType !== 'main') return null;

  const iso = parts[cols.ISO_TIME]?.trim();
  const lat = parseNum(parts[cols.LAT]);
  const lon = parseNum(parts[cols.LON]);
  if (!iso || lat == null || lon == null) return null;

  const wind =
    parseNum(parts[cols.USA_WIND]) ??
    parseNum(parts[cols.WMO_WIND]) ??
    parseNum(parts[cols.TOKYO_WIND]);
  const sshs = parseNum(parts[cols.USA_SSHS]);

  return {
    sid: parts[cols.SID]?.trim(),
    season: parseInt(parts[cols.SEASON], 10) || null,
    name: (parts[cols.NAME]?.trim() || 'UNNAMED').replace(/^UNNAMED$/i, 'Unnamed'),
    basin: parts[cols.BASIN]?.trim() || '',
    isoTime: iso,
    date: iso.slice(0, 10),
    lat,
    lon,
    windKts: wind,
    sshs: sshs != null ? Math.round(sshs) : null,
  };
}

function finalizeStorm(sid, points) {
  if (!points.length) return null;
  points.sort((a, b) => a.date.localeCompare(b.date) || a.isoTime.localeCompare(b.isoTime));

  let maxWind = null;
  let maxSshs = null;
  for (const p of points) {
    if (p.windKts != null) maxWind = maxWind == null ? p.windKts : Math.max(maxWind, p.windKts);
    if (p.sshs != null) maxSshs = maxSshs == null ? p.sshs : Math.max(maxSshs, p.sshs);
  }

  const head = points[0];
  return {
    sid,
    name: head.name,
    basin: head.basin,
    season: head.season,
    start_date: points[0].date,
    end_date: points.at(-1).date,
    max_wind_kts: maxWind,
    max_sshs: maxSshs,
    track_json: JSON.stringify(
      points.map(({ date, lat, lon, windKts, sshs }) => ({
        date,
        lat,
        lon,
        windKts,
        sshs,
      })),
    ),
  };
}

async function ensureCache({ force = false } = {}) {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!force && existsSync(CACHE_FILE)) return CACHE_FILE;

  console.log('  ibtracs: downloading since1980 CSV (~140 MB)…');
  const res = await fetch(IBTRACS_URL);
  if (!res.ok) throw new Error(`IBTrACS download ${res.status}`);

  const out = createWriteStream(CACHE_FILE);
  await pipeline(res.body, out);
  console.log(`  ibtracs: cached → ${CACHE_FILE}`);
  return CACHE_FILE;
}

async function parseCsvFile(path) {
  const rl = createInterface({ input: createReadStream(path), crlfDelay: true });
  let cols = null;
  const storms = new Map();
  let currentSid = null;
  let currentPoints = [];

  const flush = () => {
    if (!currentSid) return;
    const storm = finalizeStorm(currentSid, currentPoints);
    if (storm) storms.set(currentSid, storm);
    currentSid = null;
    currentPoints = [];
  };

  for await (const line of rl) {
    if (!cols) {
      if (line.startsWith('SID,')) {
        cols = Object.fromEntries(line.split(',').map((h, i) => [h.trim(), i]));
      }
      continue;
    }
    if (!line.trim() || line.startsWith(' ,')) continue;

    const row = parseRow(line, cols);
    if (!row?.sid) continue;

    if (row.sid !== currentSid) {
      flush();
      currentSid = row.sid;
    }
    currentPoints.push(row);
  }
  flush();

  return storms;
}

export async function ingestIbtracs({ force = false } = {}) {
  if (!force && wasIngested('ibtracs')) {
    const count = getDb().prepare('SELECT COUNT(*) AS n FROM cyclone_storms').get().n;
    console.log(`  ibtracs: skipped (${count} storms, use --force to refresh)`);
    return count;
  }

  const cachePath = await ensureCache({ force });
  console.log('  ibtracs: parsing tracks…');
  const storms = await parseCsvFile(cachePath);

  const db = getDb();
  if (force) db.prepare('DELETE FROM cyclone_storms').run();

  const ins = db.prepare(`
    INSERT OR REPLACE INTO cyclone_storms (
      sid, name, basin, season, start_date, end_date, max_wind_kts, max_sshs, track_json
    ) VALUES (
      @sid, @name, @basin, @season, @start_date, @end_date, @max_wind_kts, @max_sshs, @track_json
    )
  `);

  const rows = [...storms.values()];
  const tx = db.transaction(() => rows.forEach((r) => ins.run(r)));
  tx();

  logIngest('ibtracs', rows.length, 'IBTrACS v04 since1980, main tracks only');
  console.log(`  ibtracs: ${rows.length} storms ingested`);
  return rows.length;
}