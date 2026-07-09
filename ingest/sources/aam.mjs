import { getDb, logIngest } from '../db.mjs';
import { aggregateDaily, parseAamText } from '../lib/parse-aam.mjs';

const GFZ_AAM_BASE =
  'https://rz-vm480.gfz.de/files/ESMGFZ/EAM/operational_AAM';
const FIRST_AAM_YEAR = 1976;

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
