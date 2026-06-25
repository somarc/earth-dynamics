#!/usr/bin/env node
import { migrateFromJson } from './migrate-json.mjs';
import { ingestWeather } from './sources/weather.mjs';
import { ingestStorms } from './sources/storms.mjs';
import { ingestSolar } from './sources/solar.mjs';
import { dbPath } from './db.mjs';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1];

async function main() {
  console.log(`Earth Dynamics ingest → ${dbPath()}\n`);

  if (!only || only === 'json') {
    console.log('1. Migrate existing JSON…');
    migrateFromJson();
  }

  if (!only || only === 'weather') {
    console.log('2. Open-Meteo weather grid…');
    await ingestWeather({ force });
  }

  if (!only || only === 'storms') {
    console.log('3. NOAA storm events…');
    await ingestStorms({ force });
  }

  if (!only || only === 'solar') {
    console.log('4. Solar / sunspot…');
    await ingestSolar({ force });
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});