import { getDb, logIngest } from '../db.mjs';
import { WEATHER_GRID } from '../constants.mjs';

const START = '1962-01-01';
const END = new Date().toISOString().slice(0, 10);

async function fetchGridPoint(grid, start, end, retries = 5) {
  const url = new URL('https://archive-api.open-meteo.com/v1/archive');
  url.searchParams.set('latitude', String(grid.lat));
  url.searchParams.set('longitude', String(grid.lon));
  url.searchParams.set('start_date', start);
  url.searchParams.set('end_date', end);
  url.searchParams.set('daily', 'temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max');
  url.searchParams.set('timezone', 'UTC');

  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await fetch(url);
    if (res.ok) return res.json();
    if (res.status === 429) {
      const wait = 10000 * (attempt + 1);
      console.log(`    rate limited, waiting ${wait / 1000}s…`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`Open-Meteo ${res.status} for ${grid.id}`);
  }
  throw new Error(`Open-Meteo rate limit exceeded for ${grid.id}`);
}

export async function ingestWeather({ force = false } = {}) {
  const db = getDb();

  const gridIns = db.prepare(
    'INSERT OR REPLACE INTO weather_grid VALUES (@grid_id, @label, @lat, @lon)'
  );
  for (const g of WEATHER_GRID) {
    gridIns.run({ grid_id: g.id, label: g.label, lat: g.lat, lon: g.lon });
  }

  if (force) db.prepare('DELETE FROM weather_daily').run();

  const pending = WEATHER_GRID.filter((g) => {
    if (force) return true;
    const count = db.prepare(
      'SELECT COUNT(*) AS c FROM weather_daily WHERE grid_id = ?'
    ).get(g.id).c;
    return count < 1000;
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
  let failed = 0;
  for (const grid of pending) {
    console.log(`  weather: ${grid.label}…`);
    try {
      const data = await fetchGridPoint(grid, START, END);
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
          total++;
        }
      });
      tx();
    } catch (err) {
      failed++;
      console.log(`    failed: ${err.message}`);
    }
    await new Promise((r) => setTimeout(r, 3000));
  }

  const note = `${WEATHER_GRID.length - pending.length + (pending.length - failed)}/${WEATHER_GRID.length} grid points`;
  logIngest('weather', db.prepare('SELECT COUNT(*) AS c FROM weather_daily').get().c, note);
  console.log(`  weather: ${total} new rows (${failed} failed, re-run to resume)`);
}