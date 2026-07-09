import { getDb, logIngest } from '../db.mjs';
import {
  expandMonthlyToDaily,
  parseKpJson,
  parseSpotNum,
} from '../lib/parse-solar.mjs';

export async function ingestSolar({ force = false } = {}) {
  const db = getDb();
  if (!force && db.prepare('SELECT COUNT(*) AS c FROM solar_daily').get().c > 0) {
    console.log('  solar: skipped (already ingested, use --force)');
    return;
  }
  if (force) db.prepare('DELETE FROM solar_daily').run();

  const res = await fetch('https://solarscience.msfc.nasa.gov/greenwch/spot_num.txt');
  const text = await res.text();
  const ins = db.prepare(
    'INSERT OR REPLACE INTO solar_daily (date, sunspot_number) VALUES (?, ?)'
  );

  const monthly = parseSpotNum(text);
  const daily = expandMonthlyToDaily(monthly);

  let count = 0;
  const tx = db.transaction(() => {
    for (const { date, sunspot_number } of daily) {
      ins.run(date, sunspot_number);
      count++;
    }
  });
  tx();

  try {
    const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const kpData = await kpRes.json();
    const kpByDate = parseKpJson(kpData);
    const upd = db.prepare(
      'UPDATE solar_daily SET kp_max = ?, kp_avg = ? WHERE date = ?'
    );
    for (const [date, { kp_max, kp_avg }] of kpByDate) {
      upd.run(kp_max, kp_avg, date);
    }
  } catch {
    console.log('  solar: Kp overlay skipped (recent NOAA only)');
  }

  logIngest('solar', count, 'NASA MSFC monthly → daily');
  console.log(`  solar: ${count} rows`);
}
