import { createWriteStream, existsSync, mkdirSync, createReadStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createInterface } from 'node:readline';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchWithRetry, upsertRows } from '../../ingest/lib/index.mjs';
import { finalizeStorm, parseHeaderCols, parseRow } from '../../ingest/lib/parse-ibtracs.mjs';
import { getDb, wasIngested } from '../../ingest/db.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CACHE_DIR = join(__dirname, '..', '..', 'data');
const CACHE_FILE = join(CACHE_DIR, 'ibtracs-since1980.csv');

const IBTRACS_URL =
  'https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.since1980.list.v04r01.csv';

async function ensureCache({ force = false } = {}) {
  mkdirSync(CACHE_DIR, { recursive: true });
  if (!force && existsSync(CACHE_FILE)) return CACHE_FILE;

  console.log('  ibtracs: downloading since1980 CSV (~140 MB)…');
  const res = await fetchWithRetry(IBTRACS_URL, {}, { label: 'ibtracs CSV', maxAttempts: 3 });
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

const UPSERT_SQL = `
  INSERT OR REPLACE INTO cyclone_storms (
    sid, name, basin, season, start_date, end_date, max_wind_kts, max_sshs, track_json
  ) VALUES (
    @sid, @name, @basin, @season, @start_date, @end_date, @max_wind_kts, @max_sshs, @track_json
  )
`;

export async function ingest({ force = false } = {}) {
  if (!force && wasIngested('ibtracs')) {
    const count = getDb().prepare('SELECT COUNT(*) AS n FROM cyclone_storms').get().n;
    console.log(`  ibtracs: skipped (${count} storms, use --force to refresh)`);
    return { rowCount: count, logged: false, notes: 'skipped (fresh)' };
  }

  const cachePath = await ensureCache({ force });
  console.log('  ibtracs: parsing tracks…');
  const storms = await parseCsvFile(cachePath);

  const db = getDb();
  if (force) db.prepare('DELETE FROM cyclone_storms').run();

  const rows = [...storms.values()];
  const written = upsertRows(db, UPSERT_SQL, rows);

  return {
    rowCount: written,
    notes: 'IBTrACS v04 since1980, main tracks only',
    logKey: 'ibtracs',
  };
}
