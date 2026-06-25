#!/usr/bin/env node
/**
 * Fetches DONKI data to public/data/ for offline ingest.
 * DEMO_KEY: ~30 req/hr — runs slowly. Set NASA_API_KEY for faster backfill.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const NASA_KEY = process.env.NASA_API_KEY || 'DEMO_KEY';
const PAUSE = process.env.NASA_API_KEY ? 1500 : 125000;
const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const startYear = parseInt(process.env.DONKI_START_YEAR || '2022', 10);
const yearEnd = new Date().getUTCFullYear();

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchDonki(endpoint, startDate, endDate) {
  const url = new URL(`https://api.nasa.gov/DONKI/${endpoint}`);
  url.searchParams.set('startDate', startDate);
  url.searchParams.set('endDate', endDate);
  url.searchParams.set('api_key', NASA_KEY);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${endpoint} ${res.status}`);
  return res.json();
}

mkdirSync(OUT, { recursive: true });
const all = { cme: [], flr: [], gst: [], fetchedAt: new Date().toISOString() };

for (let year = startYear; year <= yearEnd; year++) {
  const start = `${year}-01-01`;
  const end = year === yearEnd ? new Date().toISOString().slice(0, 10) : `${year}-12-31`;
  console.log(`${year}…`);
  for (const [key, ep] of [['cme', 'CME'], ['flr', 'FLR'], ['gst', 'GST']]) {
    try {
      const rows = await fetchDonki(ep, start, end);
      all[key].push(...rows);
      console.log(`  ${ep}: ${rows.length}`);
    } catch (err) {
      console.log(`  ${ep}: ${err.message}`);
    }
    await sleep(PAUSE);
  }
}

writeFileSync(join(OUT, 'space-weather-donki.json'), JSON.stringify(all, null, 2));
console.log(`Wrote ${all.cme.length} CME, ${all.flr.length} FLR, ${all.gst.length} GST`);