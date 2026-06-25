import { getDb, logIngest } from '../db.mjs';

const OMNI_BASE = 'https://spdf.gsfc.nasa.gov/pub/data/omni/low_res_omni';
const FILL = new Set([999, 9999, 99999, 999999, 9999999, 999999.99, 99999.99]);

function isFill(val) {
  if (val == null || Number.isNaN(val)) return true;
  return FILL.has(val) || FILL.has(Math.round(val));
}

function parseOmniLine(line) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 42) return null;

  const year = parseInt(parts[0], 10);
  const doy = parseInt(parts[1], 10);
  const hour = parseInt(parts[2], 10);
  if (!year || !doy || hour > 23) return null;

  const bz = parseFloat(parts[16]);
  const density = parseFloat(parts[23]);
  const speed = parseFloat(parts[24]);
  const dst = parseInt(parts[40], 10);

  return {
    year,
    doy,
    hour,
    bz: isFill(bz) ? null : bz,
    density: isFill(density) ? null : density,
    speed: isFill(speed) ? null : speed,
    dst: isFill(dst) ? null : dst,
  };
}

function doyToDate(year, doy) {
  const d = new Date(Date.UTC(year, 0, 1, 12));
  d.setUTCDate(doy);
  return d.toISOString().slice(0, 10);
}

async function fetchOmniYear(year) {
  const url = `${OMNI_BASE}/omni2_${year}.dat`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`OMNI ${year} ${res.status}`);
  return res.text();
}

function aggregateDaily(hourlyRows) {
  const byDate = new Map();

  for (const row of hourlyRows) {
    const date = doyToDate(row.year, row.doy);
    let agg = byDate.get(date);
    if (!agg) {
      agg = { dstVals: [], speeds: [], bzs: [], densities: [] };
      byDate.set(date, agg);
    }
    if (row.dst != null) agg.dstVals.push(row.dst);
    if (row.speed != null) agg.speeds.push(row.speed);
    if (row.bz != null) agg.bzs.push(row.bz);
    if (row.density != null) agg.densities.push(row.density);
  }

  const out = [];
  for (const [date, agg] of byDate) {
    out.push({
      date,
      dstMin: agg.dstVals.length ? Math.min(...agg.dstVals) : null,
      speed: agg.speeds.length
        ? agg.speeds.reduce((a, b) => a + b, 0) / agg.speeds.length
        : null,
      bzMin: agg.bzs.length ? Math.min(...agg.bzs) : null,
      density: agg.densities.length
        ? agg.densities.reduce((a, b) => a + b, 0) / agg.densities.length
        : null,
    });
  }
  return out;
}

function mergeGeomagnetic(db, { date, dstMin, speed, bzMin, density }) {
  const existing = db.prepare(
    'SELECT dst_min, sw_speed_kms, sw_bz_nt, sw_density FROM geomagnetic_daily WHERE date = ?'
  ).get(date);

  const mergedDst = existing?.dst_min != null && dstMin != null
    ? Math.min(existing.dst_min, dstMin)
    : (dstMin ?? existing?.dst_min ?? null);
  const mergedSpeed = speed ?? existing?.sw_speed_kms ?? null;
  const mergedBz = existing?.sw_bz_nt != null && bzMin != null
    ? Math.min(existing.sw_bz_nt, bzMin)
    : (bzMin ?? existing?.sw_bz_nt ?? null);
  const mergedDensity = density ?? existing?.sw_density ?? null;

  if (existing) {
    db.prepare(`
      UPDATE geomagnetic_daily SET
        dst_min = COALESCE(?, dst_min),
        sw_speed_kms = COALESCE(?, sw_speed_kms),
        sw_bz_nt = COALESCE(?, sw_bz_nt),
        sw_density = COALESCE(?, sw_density)
      WHERE date = ?
    `).run(mergedDst, mergedSpeed, mergedBz, mergedDensity, date);
  } else if (dstMin != null || speed != null || bzMin != null) {
    db.prepare(`
      INSERT INTO geomagnetic_daily (date, dst_min, sw_speed_kms, sw_bz_nt, sw_density, g_scale, aurora_level)
      VALUES (?, ?, ?, ?, ?, 0, 0)
    `).run(date, mergedDst, mergedSpeed, mergedBz, mergedDensity);
  }
}

async function ingestNoaaKyotoDst(db) {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/products/kyoto-dst.json');
    if (!res.ok) return 0;
    const rows = await res.json();
    const byDate = new Map();
    for (const r of rows) {
      const date = r.time_tag?.slice(0, 10);
      if (!date || r.dst == null) continue;
      const list = byDate.get(date) || [];
      list.push(r.dst);
      byDate.set(date, list);
    }
    const tx = db.transaction(() => {
      for (const [date, vals] of byDate) {
        mergeGeomagnetic(db, { date, dstMin: Math.min(...vals) });
      }
    });
    tx();
    return byDate.size;
  } catch (err) {
    console.log(`  omni: NOAA Kyoto Dst skipped (${err.message})`);
    return 0;
  }
}

function parseNoaaWindRows(rows, colMap) {
  if (!rows?.length || rows.length < 2) return [];
  const header = rows[0];
  const out = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const tag = row[0]?.replace(' ', 'T');
    const date = tag?.slice(0, 10);
    if (!date) continue;
    const vals = {};
    for (const [key, idx] of Object.entries(colMap)) {
      const v = parseFloat(row[idx]);
      vals[key] = Number.isFinite(v) ? v : null;
    }
    out.push({ date, ...vals });
  }
  return out;
}

async function ingestNoaaSolarWind(db) {
  try {
    const [magRes, plasmaRes] = await Promise.all([
      fetch('https://services.swpc.noaa.gov/products/solar-wind/mag-1-day.json'),
      fetch('https://services.swpc.noaa.gov/products/solar-wind/plasma-1-day.json'),
    ]);
    if (!magRes.ok || !plasmaRes.ok) return 0;

    const magRows = await magRes.json();
    const plasmaRows = await plasmaRes.json();
    const mag = parseNoaaWindRows(magRows, { bz: 3, bt: 6 });
    const plasma = parseNoaaWindRows(plasmaRows, { density: 1, speed: 2 });

    const byDate = new Map();
    for (const r of mag) {
      const agg = byDate.get(r.date) || { bzs: [], speeds: [], densities: [] };
      if (r.bz != null) agg.bzs.push(r.bz);
      byDate.set(r.date, agg);
    }
    for (const r of plasma) {
      const agg = byDate.get(r.date) || { bzs: [], speeds: [], densities: [] };
      if (r.speed != null) agg.speeds.push(r.speed);
      if (r.density != null) agg.densities.push(r.density);
      byDate.set(r.date, agg);
    }

    const tx = db.transaction(() => {
      for (const [date, agg] of byDate) {
        mergeGeomagnetic(db, {
          date,
          bzMin: agg.bzs.length ? Math.min(...agg.bzs) : null,
          speed: agg.speeds.length
            ? agg.speeds.reduce((a, b) => a + b, 0) / agg.speeds.length
            : null,
          density: agg.densities.length
            ? agg.densities.reduce((a, b) => a + b, 0) / agg.densities.length
            : null,
        });
      }
    });
    tx();
    return byDate.size;
  } catch (err) {
    console.log(`  omni: NOAA solar wind skipped (${err.message})`);
    return 0;
  }
}

function ensureGeomagneticColumns(db) {
  for (const col of ['sw_speed_kms', 'sw_bz_nt', 'sw_density']) {
    try {
      db.exec(`ALTER TABLE geomagnetic_daily ADD COLUMN ${col} REAL`);
    } catch {
      /* column exists */
    }
  }
}

export async function ingestOmni({ startYear = 2010 } = {}) {
  const db = getDb();
  ensureGeomagneticColumns(db);

  const today = new Date();
  const endYear = today.getUTCFullYear();
  const years = [];
  for (let y = startYear; y <= endYear; y++) years.push(y);

  let dayCount = 0;
  for (const year of years) {
    process.stdout.write(`  omni: ${year}… `);
    try {
      const text = await fetchOmniYear(year);
      const hourly = [];
      for (const line of text.split('\n')) {
        if (!/^\d{4}\s/.test(line)) continue;
        const row = parseOmniLine(line);
        if (row) hourly.push(row);
      }
      const daily = aggregateDaily(hourly);
      const tx = db.transaction(() => {
        for (const d of daily) {
          mergeGeomagnetic(db, {
            date: d.date,
            dstMin: d.dstMin,
            speed: d.speed,
            bzMin: d.bzMin,
            density: d.density,
          });
        }
      });
      tx();
      dayCount += daily.length;
      console.log(`${daily.length} days`);
    } catch (err) {
      console.log(`error (${err.message})`);
    }
  }

  const dstDays = await ingestNoaaKyotoDst(db);
  const swDays = await ingestNoaaSolarWind(db);
  const withDst = db.prepare('SELECT COUNT(*) AS c FROM geomagnetic_daily WHERE dst_min IS NOT NULL').get().c;
  logIngest('omni', withDst, `OMNI ${startYear}–${endYear}, NOAA Dst ${dstDays}d, wind ${swDays}d`);
  console.log(`  omni: ${dayCount} OMNI days, ${withDst} with Dst, NOAA refresh Dst ${dstDays}d / wind ${swDays}d`);
  return dayCount;
}