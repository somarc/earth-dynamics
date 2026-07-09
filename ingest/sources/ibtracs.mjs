import { createWriteStream, existsSync, mkdirSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, logIngest, wasIngested } from '../db.mjs';
import { finalizeStorm, parseHeaderCols, parseRow } from '../lib/parse-ibtracs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '..', 'data');
const CACHE_FILE = join(CACHE_DIR, 'ibtracs-since1980.csv');

const IBTRACS_URL =
  'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv';

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
      cols = parseHeaderCols(line);
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
