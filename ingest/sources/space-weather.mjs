import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, logIngest } from '../db.mjs';

const DATA_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'public', 'data');

const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const HAS_PRIVATE_KEY = !!process.env.NASA_API_KEY;
const PAUSE_MS = HAS_PRIVATE_KEY ? 1200 : 125000;
const RETRY_PAUSE_MS = HAS_PRIVATE_KEY ? 60000 : 180000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function toDate(iso) {
  return iso?.slice(0, 10) ?? null;
}

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function gScaleFromKp(kp) {
  if (kp == null || kp < 5) return 0;
  if (kp < 6) return 1;
  if (kp < 7) return 2;
  if (kp < 8) return 3;
  if (kp < 9) return 4;
  return 5;
}

function auroraLevelFromKp(kp) {
  if (kp == null || kp < 3) return 0;
  if (kp < 5) return 1;
  if (kp < 6) return 2;
  if (kp < 7) return 3;
  return 4;
}

async function fetchDonki(endpoint, startDate, endDate, attempt = 0) {
  const url = new URL(`https://api.nasa.gov/DONKI/${endpoint}`);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('api_key', NASA_KEY);
  const res = await fetch(url);
  if (res.status === 429 && attempt < 3) {
    console.log(`    retry ${endpoint} ${startDate} in ${RETRY_PAUSE_MS / 1000}s…`);
    await sleep(RETRY_PAUSE_MS);
    return fetchDonki(endpoint, startDate, endDate, attempt + 1);
  }
  if (!res.ok) throw new Error(`DONKI ${endpoint} ${res.status}`);
  return res.json();
}

function upsertGeomagnetic(db, date, kpMax, kpAvg, dstMin = null) {
  const existing = db.prepare('SELECT kp_max, kp_avg, dst_min FROM geomagnetic_daily WHERE date = ?').get(date);
  const mergedMax = existing?.kp_max != null && kpMax != null
    ? Math.max(existing.kp_max, kpMax)
    : (kpMax ?? existing?.kp_max ?? null);
  const mergedAvg = existing?.kp_avg != null && kpAvg != null
    ? Math.max(existing.kp_avg, kpAvg)
    : (kpAvg ?? existing?.kp_avg ?? null);
  const mergedDst = existing?.dst_min != null && dstMin != null
    ? Math.min(existing.dst_min, dstMin)
    : (dstMin ?? existing?.dst_min ?? null);

  db.prepare(`
    INSERT INTO geomagnetic_daily (date, kp_max, kp_avg, dst_min, g_scale, aurora_level)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      kp_max = excluded.kp_max,
      kp_avg = excluded.kp_avg,
      dst_min = COALESCE(excluded.dst_min, geomagnetic_daily.dst_min),
      g_scale = excluded.g_scale,
      aurora_level = excluded.aurora_level
  `).run(
    date,
    mergedMax,
    mergedAvg,
    mergedDst,
    gScaleFromKp(mergedMax),
    auroraLevelFromKp(mergedMax),
  );
}

function ingestCme(db, item, insEvent) {
  const analyze = item.cmeAnalyzes?.[0];
  const speed = analyze?.speed ?? null;
  const halfAngle = analyze?.halfAngle ?? null;
  const type = analyze?.type ?? '';
  const note = analyze?.note ?? '';
  const date = toDate(item.startTime);
  if (!date) return;

  insEvent.run(
    item.activityID,
    'CME',
    item.startTime,
    date,
    null,
    speed,
    type || null,
    null,
    halfAngle,
    null,
    note.slice(0, 500) || null,
    item.link ?? null,
    JSON.stringify(item.linkedEvents ?? []),
  );
}

function ingestFlare(db, item, insEvent) {
  const date = toDate(item.beginTime || item.peakTime);
  if (!date) return;

  insEvent.run(
    item.flrID || item.activityID,
    'FLR',
    item.beginTime || item.peakTime,
    date,
    item.endTime ?? null,
    null,
    item.classType ?? null,
    null,
    null,
    item.sourceLocation ?? null,
    null,
    item.link ?? null,
    JSON.stringify(item.linkedEvents ?? []),
  );
}

function ingestGst(db, item, insEvent) {
  const date = toDate(item.startTime);
  if (!date) return;

  const kpVals = (item.allKpIndex || [])
    .map((k) => k.kpIndex)
    .filter((v) => Number.isFinite(v));
  const kpPeak = kpVals.length ? Math.max(...kpVals) : null;
  const kpAvg = kpVals.length
    ? kpVals.reduce((a, b) => a + b, 0) / kpVals.length
    : null;

  insEvent.run(
    item.gstID || item.activityID,
    'GST',
    item.startTime,
    date,
    null,
    null,
    kpPeak != null ? `Kp ${kpPeak.toFixed(1)}` : null,
    kpPeak,
    null,
    null,
    null,
    item.link ?? null,
    JSON.stringify(item.linkedEvents ?? []),
  );

  for (const k of item.allKpIndex || []) {
    const kDate = toDate(k.observedTime);
    if (kDate && k.kpIndex != null) {
      upsertGeomagnetic(db, kDate, k.kpIndex, k.kpIndex);
    }
  }
  if (kpPeak != null) upsertGeomagnetic(db, date, kpPeak, kpAvg);
}

async function ingestNoaaDailyKp(db) {
  try {
    const res = await fetch('https://services.swpc.noaa.gov/text/daily-geomagnetic-indices.txt');
    const text = await res.text();
    let count = 0;
    for (const line of text.split('\n')) {
      const m = line.match(
        /^(\d{4})\s+(\d{2})\s+(\d{2})\s+.+?\s+\d+\s+((?:\d+\.\d+\s+){7}\d+\.\d+)\s*$/
      );
      if (!m) continue;
      const date = `${m[1]}-${m[2]}-${m[3]}`;
      const kpVals = m[4].trim().split(/\s+/).map(parseFloat).filter(Number.isFinite);
      if (!kpVals.length) continue;
      upsertGeomagnetic(
        db,
        date,
        Math.max(...kpVals),
        kpVals.reduce((a, b) => a + b, 0) / kpVals.length,
      );
      count++;
    }
    return count;
  } catch (err) {
    console.log(`  space-weather: NOAA daily Kp skipped (${err.message})`);
    return 0;
  }
}

function mergeSolarDailyKp(db) {
  const rows = db.prepare(`
    SELECT date, kp_max, kp_avg FROM solar_daily
    WHERE kp_max IS NOT NULL
  `).all();
  for (const r of rows) upsertGeomagnetic(db, r.date, r.kp_max, r.kp_avg);
  return rows.length;
}

function* quarterRanges(startDate, endDate) {
  let cursor = startDate;
  while (cursor <= endDate) {
    const end = addDays(cursor, 89);
    yield { start: cursor, end: end > endDate ? endDate : end };
    cursor = addDays(end, 1);
  }
}

async function ingestDonkiRange(db, insEvent, startDate, endDate) {
  let eventCount = 0;
  for (const { start, end } of quarterRanges(startDate, endDate)) {
    process.stdout.write(`    ${start} → ${end} `);
    try {
      const cmes = await fetchDonki('CME', start, end);
      await sleep(PAUSE_MS);
      const flares = await fetchDonki('FLR', start, end);
      await sleep(PAUSE_MS);
      const storms = await fetchDonki('GST', start, end);

      const tx = db.transaction(() => {
        for (const item of cmes) ingestCme(db, item, insEvent);
        for (const item of flares) ingestFlare(db, item, insEvent);
        for (const item of storms) ingestGst(db, item, insEvent);
      });
      tx();
      eventCount += cmes.length + flares.length + storms.length;
      console.log(`${cmes.length}/${flares.length}/${storms.length}`);
    } catch (err) {
      console.log(`error (${err.message})`);
    }
    await sleep(PAUSE_MS);
  }
  return eventCount;
}

function ingestFromJsonCache(db, insEvent) {
  const path = join(DATA_DIR, 'space-weather-donki.json');
  if (!existsSync(path)) return 0;
  const cache = JSON.parse(readFileSync(path, 'utf8'));
  let n = 0;
  const tx = db.transaction(() => {
    for (const item of cache.cme || []) { ingestCme(db, item, insEvent); n++; }
    for (const item of cache.flr || []) { ingestFlare(db, item, insEvent); n++; }
    for (const item of cache.gst || []) { ingestGst(db, item, insEvent); n++; }
  });
  tx();
  console.log(`  space-weather: loaded cache (${cache.cme?.length || 0} CME, ${cache.flr?.length || 0} FLR, ${cache.gst?.length || 0} GST)`);
  return n;
}

export async function ingestSpaceWeather({ force = false } = {}) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const eventCountExisting = db.prepare('SELECT COUNT(*) AS c FROM space_weather_events').get().c;

  const insEvent = db.prepare(`
    INSERT OR REPLACE INTO space_weather_events (
      id, event_type, start_time, date, end_time, speed, magnitude, kp_peak,
      half_angle, source_location, description, source_url, linked_events
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let startDate;
  if (force) {
    db.prepare('DELETE FROM space_weather_events').run();
    db.prepare('DELETE FROM geomagnetic_daily').run();
    const backfillYears = HAS_PRIVATE_KEY
      ? parseInt(process.env.DONKI_START_YEAR || '2010', 10)
      : 2;
    startDate = `${new Date().getUTCFullYear() - backfillYears}-01-01`;
    console.log(`  space-weather: full fetch from ${startDate} (key: ${HAS_PRIVATE_KEY ? 'private' : 'DEMO'})`);
  } else if (eventCountExisting > 0) {
    const last = db.prepare('SELECT MAX(date) AS d FROM space_weather_events').get().d;
    startDate = addDays(last, -7);
    console.log(`  space-weather: incremental from ${startDate}`);
  } else {
    startDate = addDays(today, -730);
    console.log(`  space-weather: initial 2-year fetch from ${startDate}`);
  }

  let eventCount = ingestFromJsonCache(db, insEvent);
  const liveDonki = HAS_PRIVATE_KEY || process.env.DONKI_LIVE === '1';
  if (!liveDonki && eventCount === 0) {
    console.log('  space-weather: skipping live DONKI (set NASA_API_KEY or DONKI_LIVE=1)');
  } else if (!liveDonki && eventCount > 0) {
    console.log('  space-weather: using JSON cache only (DEMO_KEY limits)');
  } else {
    eventCount += await ingestDonkiRange(db, insEvent, startDate, today);
  }
  const noaaDays = await ingestNoaaDailyKp(db);
  const solarKp = mergeSolarDailyKp(db);
  const geoCount = db.prepare('SELECT COUNT(*) AS c FROM geomagnetic_daily').get().c;
  const totalEvents = db.prepare('SELECT COUNT(*) AS c FROM space_weather_events').get().c;

  logIngest(
    'space-weather',
    totalEvents,
    `DONKI ${startDate}–${today} (+${eventCount}), ${geoCount} geo days, NOAA ${noaaDays}, solar ${solarKp}`,
  );
  console.log(`  space-weather: ${totalEvents} events, ${geoCount} geomagnetic days`);
  if (!HAS_PRIVATE_KEY) {
    console.log('  tip: set NASA_API_KEY for deeper DONKI backfill (DONKI_START_YEAR=2010)');
  }
}