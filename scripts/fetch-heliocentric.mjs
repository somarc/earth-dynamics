#!/usr/bin/env node
/** Incremental fetch: adds earthHelio to existing ephemeris.json */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');
const AU_KM = 149597870.7;

const HORIZONS_MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

function parseHorizonsDate(raw) {
  const match = raw.match(/(\d{4})-(\w{3})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${HORIZONS_MONTHS[match[2]]}-${match[3]}`;
}

function parseHorizonsVectors(resultText) {
  const soe = resultText.indexOf('SOE');
  const eoe = resultText.indexOf('EOE');
  if (soe < 0 || eoe < 0) return [];
  const block = resultText.slice(soe + 3, eoe).trim();
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const records = [];
  for (let i = 0; i < lines.length; i += 3) {
    const date = parseHorizonsDate(lines[i]);
    const coords = lines[i + 1]?.split(/\s+/).filter(Boolean).map(Number);
    if (!date || !coords || coords.length < 3) continue;
    const [x, y, z] = coords;
    const distAu = Math.sqrt(x * x + y * y + z * z);
    records.push({ date, x, y, z, distAu, distKm: distAu * AU_KM });
  }
  return records;
}

async function main() {
  const ephemeris = JSON.parse(await readFile(join(DATA_DIR, 'ephemeris.json'), 'utf8'));
  const startDate = ephemeris.dates[0];
  const stopDate = ephemeris.dates.at(-1);

  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  url.searchParams.set('format', 'json');
  url.searchParams.set('COMMAND', "'399'");
  url.searchParams.set('MAKE_EPHEM', 'YES');
  url.searchParams.set('EPHEM_TYPE', 'VECTORS');
  url.searchParams.set('CENTER', '500@10');
  url.searchParams.set('START_TIME', startDate);
  url.searchParams.set('STOP_TIME', stopDate);
  url.searchParams.set('STEP_SIZE', '1d');
  url.searchParams.set('REF_PLANE', 'ECLIPTIC');
  url.searchParams.set('VEC_TABLE', '2');
  url.searchParams.set('OUT_UNITS', 'AU-D');
  url.searchParams.set('VEC_LABELS', 'NO');

  console.log(`Fetching heliocentric Earth ${startDate} → ${stopDate}…`);
  const res = await fetch(url);
  const data = await res.json();
  const records = parseHorizonsVectors(data.result);
  console.log(`  ${records.length} vectors`);

  for (const rec of records) {
    if (ephemeris.byDate[rec.date]) {
      ephemeris.byDate[rec.date].earthHelio = {
        x: rec.x,
        y: rec.y,
        z: rec.z,
        distAu: rec.distAu,
        distKm: rec.distKm,
      };
    }
  }

  await writeFile(join(DATA_DIR, 'ephemeris.json'), JSON.stringify(ephemeris));
  console.log('Updated ephemeris.json with earthHelio');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});