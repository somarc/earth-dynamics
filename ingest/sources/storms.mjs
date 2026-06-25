import { gunzipSync } from 'node:zlib';
import { getDb, logIngest } from '../db.mjs';
import { STORM_EVENT_TYPES } from '../constants.mjs';

const BASE = 'https://www.ncei.noaa.gov/pub/data/swdi/stormevents/csvfiles';
const START_YEAR = 1990;

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inQ = !inQ;
    else if (c === ',' && !inQ) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}

async function downloadAndParse(year) {
  const listing = await fetch(`${BASE}/`);
  const html = await listing.text();
  const match = html.match(
    new RegExp(`StormEvents_details-ftp_v1\\.0_d${year}_c\\d+\\.csv\\.gz`)
  );
  if (!match) {
    console.log(`  storms: no file for ${year}`);
    return 0;
  }

  const res = await fetch(`${BASE}/${match[0]}`);
  if (!res.ok) return 0;
  const csv = gunzipSync(Buffer.from(await res.arrayBuffer())).toString('utf8');
  const lines = csv.split('\n');
  const headers = parseCsvLine(lines[0]);

  const db = getDb();
  const ins = db.prepare(`
    INSERT OR IGNORE INTO storm_events VALUES (
      @id,@date,@event_type,@state,@country,@lat,@lon,@magnitude,
      @deaths,@injuries,@damage_property,@narrative
    )`);

  let count = 0;
  const batch = [];
  const flush = db.transaction((rows) => { for (const r of rows) ins.run(r); });

  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (!line.trim()) continue;
    const cols = parseCsvLine(line);
    const row = Object.fromEntries(headers.map((h, i) => [h, cols[i] || '']));
    if (!STORM_EVENT_TYPES.has(row.EVENT_TYPE)) continue;

    const lat = parseFloat(row.BEGIN_LAT);
    const lon = parseFloat(row.BEGIN_LON);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const ym = row.BEGIN_YEARMONTH || '';
    const day = row.BEGIN_DAY || '1';
    const date = ym.length >= 6
      ? `${ym.slice(0, 4)}-${ym.slice(4, 6)}-${String(day).padStart(2, '0')}`
      : `${row.YEAR}-01-01`;

    batch.push({
      id: row.EVENT_ID || `${year}-${li}`,
      date,
      event_type: row.EVENT_TYPE,
      state: row.STATE,
      country: 'US',
      lat, lon,
      magnitude: row.MAGNITUDE || row.TOR_F_SCALE || row.CATEGORY || null,
      deaths: parseInt(row.DEATHS_DIRECT || '0', 10) || 0,
      injuries: parseInt(row.INJURIES_DIRECT || '0', 10) || 0,
      damage_property: row.DAMAGE_PROPERTY || null,
      narrative: (row.EVENT_NARRATIVE || '').slice(0, 500),
    });
    count++;
    if (batch.length >= 1000) { flush(batch.splice(0)); }
  }
  if (batch.length) flush(batch);
  return count;
}

export async function ingestStorms({ force = false } = {}) {
  const db = getDb();
  if (!force && db.prepare('SELECT COUNT(*) AS c FROM storm_events').get().c > 0) {
    console.log('  storms: skipped (already ingested, use --force)');
    return;
  }
  if (force) db.prepare('DELETE FROM storm_events').run();

  const endYear = new Date().getFullYear();
  let total = 0;
  for (let year = START_YEAR; year <= endYear; year++) {
    console.log(`  storms: ${year}…`);
    total += await downloadAndParse(year);
  }

  logIngest('storms', total, `US significant events ${START_YEAR}+`);
  console.log(`  storms: ${total} rows`);
}