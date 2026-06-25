import { getDb, logIngest } from '../db.mjs';
import { WEATHER_GRID } from '../constants.mjs';

const START = '1962-01-01';
const END = new Date().toISOString().slice(0, 10);
const CHUNK_YEARS = 3;
const CHUNK_PAUSE_MS = 8000;
const GRID_PAUSE_MS = 10000;
const MAX_RETRIES = 3;
const MAX_WAIT_MS = 60_000;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function* yearChunks(start, end, years = CHUNK_YEARS) {
  let cursor = start;
  while (cursor <= end) {
    const startYear = Number.parseInt(cursor.slice(0, 4), 10);
    const chunkEndYear = startYear + years - 1;
    let chunkEnd = `${chunkEndYear}-12-31`;
    if (chunkEnd > end) chunkEnd = end;
    yield { start: cursor, end: chunkEnd };
    const nextYear = chunkEndYear + 1;
    cursor = `${nextYear}-01-01`;
    if (cursor > end) break;
  }
}

function gridStatus(db, gridId) {
  return db.prepare(
    'SELECT COUNT(*) AS c, MIN(date) AS minDate, MAX(date) AS maxDate FROM weather_daily WHERE grid_id = ?'
  ).get(gridId);
}

function isGridComplete(db, gridId, end = END) {
  const { c, minDate, maxDate } = gridStatus(db, gridId);
  return c >= 1000 && minDate <= START && maxDate >= end;
}

function resumeStart(db, gridId) {
  const { maxDate } = gridStatus(db, gridId);
  return maxDate ? addDays(maxDate, 1) : START;
}

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

class RateLimitError extends Error {
  constructor(message) {
    super(message);
    this.name = 'RateLimitError';
  }
}

function rateLimitWaitMs(res, attempt) {
  const retryAfter = Number.parseInt(res.headers.get('retry-after') || '', 10);
  const backoff = 10_000 * (attempt + 1);
  const raw = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : backoff;
  return Math.min(raw, MAX_WAIT_MS);
}

async function fetchGridChunk(grid, start, end) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(grid.lat));
  url.searchParams.set('longitude', String(grid.lon));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max');
  url.searchParams.set('timezone', 'UTC');

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      if (attempt === MAX_RETRIES - 1) {
        throw new RateLimitError(`Open-Meteo rate limited for ${grid.id} (${start}→${end})`);
      }
      const wait = rateLimitWaitMs(res, attempt);
      console.log(`    rate limited (${start}→${end}), waiting ${Math.round(wait / 1000)}s (${attempt + 1}/${MAX_RETRIES})…`);
      await sleep(wait);
      continue;
    }
    throw new Error(`Open-Meteo ${res.status} for ${grid.id} (${start}→${end})`);
  }
  throw new RateLimitError(`Open-Meteo rate limited for ${grid.id} (${start}→${end})`);
}

function insertChunk(db, ins, grid, data) {
  const days = data.daily?.time || [];
  const tx = db.transaction(() => {
    for (let i = 0; i < days.length; i++) {
      ins.run({
        date: days[i],
        grid_id: grid.id,
        temp_max_c: data.daily.temperature_2m_max[i],
        temp_min_c: data.daily.temperature_2m_min[i],
        precip_mm: data.daily.precipitation_sum[i],
        wind_max_kmh: data.daily.windspeed_10m_max[i],
      });
    }
  });
  tx();
  return days.length;
}

export async function ingestWeather({ force = false, gridIds = null } = {}) {
  const db = getDb();

  const gridIns = db.prepare(
    'INSERT OR REPLACE INTO weather_grid VALUES (@grid_id, @label, @lat, @lon)'
  );
  for (const g of WEATHER_GRID) {
    gridIns.run({ grid_id: g.id, label: g.label, lat: g.lat, lon: g.lon });
  }

  if (force) db.prepare('DELETE FROM weather_daily').run();

  const idFilter = gridIds?.length ? new Set(gridIds) : null;
  const pending = WEATHER_GRID.filter((g) => {
    if (idFilter && !idFilter.has(g.id)) return false;
    if (force) return true;
    return !isGridComplete(db, g.id);
  });

  if (!pending.length) {
    console.log('  weather: all grid points ingested');
    return;
  }
  console.log(`  weather: ${pending.length} grid point(s) pending`);

  const ins = db.prepare(`
    INSERT OR REPLACE INTO weather_daily VALUES (
      @date, @grid_id, @temp_max_c, @temp_min_c, @precip_mm, @wind_max_kmh
    )`);

  let total = 0;
  let completed = 0;
  let failed = 0;
  let rateLimited = false;

  for (const grid of pending) {
    if (rateLimited) break;

    const resume = resumeStart(db, grid.id);
    const chunks = [...yearChunks(resume, END)];
    console.log(`  weather: ${grid.label} (${chunks.length} chunk(s) from ${resume})…`);

    let gridFailed = false;
    for (let i = 0; i < chunks.length; i++) {
      const { start, end } = chunks[i];
      try {
        const data = await fetchGridChunk(grid, start, end);
        const rows = insertChunk(db, ins, grid, data);
        total += rows;
        if (chunks.length > 1) {
          console.log(`    ${start}→${end}: ${rows} rows`);
        }
      } catch (err) {
        gridFailed = true;
        console.log(`    failed: ${err.message}`);
        if (err instanceof RateLimitError) rateLimited = true;
        break;
      }
      if (i < chunks.length - 1) await sleep(CHUNK_PAUSE_MS);
    }

    if (gridFailed) {
      failed++;
    } else if (isGridComplete(db, grid.id)) {
      completed++;
    } else {
      failed++;
      console.log(`    incomplete: max date ${gridStatus(db, grid.id).maxDate ?? 'none'}`);
    }

    if (!rateLimited) await sleep(GRID_PAUSE_MS);
  }

  const alreadyDone = WEATHER_GRID.filter((g) => isGridComplete(db, g.id)).length;
  const skipped = rateLimited ? pending.length - completed - failed : 0;
  const note = `${alreadyDone}/${WEATHER_GRID.length} grid points`;
  logIngest('weather', db.prepare('SELECT COUNT(*) AS c FROM weather_daily').get().c, note);
  if (rateLimited) {
    console.log(`  weather: rate limited — stopped early (${skipped} grid point(s) skipped, re-run later)`);
  }
  console.log(`  weather: ${total} new rows (${completed} completed, ${failed} failed, re-run to resume)`);
}