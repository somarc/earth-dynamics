import { getDb, logIngest } from '../db.mjs';

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

  const monthly = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('YEAR') || line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const ssn = parseFloat(parts[2]);
    if (year >= 1962 && Number.isFinite(ssn)) monthly.push({ year, month, ssn });
  }

  let count = 0;
  const tx = db.transaction(() => {
    for (const { year, month, ssn } of monthly) {
      const daysInMonth = new Date(year, month, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (date > new Date().toISOString().slice(0, 10)) continue;
        ins.run(date, ssn);
        count++;
      }
    }
  });
  tx();

  try {
    const kpRes = await fetch('https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json');
    const kpData = await kpRes.json();
    const kpByDate = new Map();
    for (let i = 1; i < kpData.length; i++) {
      const [time, kp] = kpData[i];
      const date = time.slice(0, 10);
      const val = parseFloat(kp);
      if (!kpByDate.has(date)) kpByDate.set(date, []);
      kpByDate.get(date).push(val);
    }
    const upd = db.prepare(
      'UPDATE solar_daily SET kp_max = ?, kp_avg = ? WHERE date = ?'
    );
    for (const [date, vals] of kpByDate) {
      upd.run(Math.max(...vals), vals.reduce((a, b) => a + b, 0) / vals.length, date);
    }
  } catch {
    console.log('  solar: Kp overlay skipped (recent NOAA only)');
  }

  logIngest('solar', count, 'NASA MSFC monthly → daily');
  console.log(`  solar: ${count} rows`);
}