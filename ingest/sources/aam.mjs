import { getDb, logIngest } from '../db.mjs';

const GFZ_AAM_BASE =
  'https://rz-vm480.gfz.de/files/ESMGFZ/EAM/operational_AAM';
const FIRST_AAM_YEAR = 1976;

const DATA_LINE =
  /^(\d{4})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)/;

function parseAamText(text) {
  const hourly = [];
  for (const line of text.split('\n')) {
    const m = line.match(DATA_LINE);
    if (!m) continue;
    const [, y, mo, d, , mjd, mx, my, mz, ox, oy, oz] = m;
    hourly.push({
      date: `${y}-${mo}-${d}`,
      mjd: parseFloat(mjd),
      x: parseFloat(mx) + parseFloat(ox),
      y: parseFloat(my) + parseFloat(oy),
      z: parseFloat(mz) + parseFloat(oz),
    });
  }
  return hourly;
}

function aggregateDaily(hourly) {
  const byDate = new Map();
  for (const row of hourly) {
    let agg = byDate.get(row.date);
    if (!agg) {
      agg = { mjd: row.mjd, sx: 0, sy: 0, sz: 0, n: 0 };
      byDate.set(row.date, agg);
    }
    agg.sx += row.x;
    agg.sy += row.y;
    agg.sz += row.z;
    agg.n += 1;
    agg.mjd = row.mjd;
  }
  return [...byDate.entries()].map(([date, agg]) => ({
    date,
    mjd: agg.mjd,
    aam_x: agg.sx / agg.n,
    aam_y: agg.sy / agg.n,
    aam_z: agg.sz / agg.n,
  }));
}

async function fetchAamYear(year) {
  const url = `${GFZ_AAM_BASE}/ESMGFZ_AAM_v1.0_03h_${year}.asc`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GFZ AAM ${year}: HTTP ${res.status}`);
  return res.text();
}

export async function ingestAam({ force = false, startYear = FIRST_AAM_YEAR } = {}) {
  const db = getDb();
  const ins = db.prepare(`
    INSERT OR REPLACE INTO aam_daily (date, mjd, aam_x, aam_y, aam_z)
    VALUES (@date, @mjd, @aam_x, @aam_y, @aam_z)
  `);

  const lastRow = db.prepare('SELECT MAX(date) AS lastDate FROM aam_daily').get();
  const currentYear = new Date().getUTCFullYear();

  let fromYear = startYear;
  if (!force && lastRow?.lastDate) {
    fromYear = parseInt(lastRow.lastDate.slice(0, 4), 10);
  }

  let total = 0;
  for (let year = fromYear; year <= currentYear; year++) {
    try {
      console.log(`  AAM ${year}…`);
      const text = await fetchAamYear(year);
      const daily = aggregateDaily(parseAamText(text));
      const tx = db.transaction((rows) => {
        for (const row of rows) ins.run(row);
      });
      tx(daily);
      total += daily.length;
      console.log(`    ${daily.length} daily rows`);
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.warn(`    skip ${year}: ${err.message}`);
    }
  }

  const count = db.prepare('SELECT COUNT(*) AS n FROM aam_daily').get().n;
  logIngest('aam', count, `GFZ ESMGFZ operational AAM; +${total} this run`);
  console.log(`  aam: ${count} daily rows total`);
  return count;
}