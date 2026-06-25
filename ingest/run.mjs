#!/usr/bin/env node
import { migrateFromJson } from './migrate-json.mjs';
import { ingestWeather } from './sources/weather.mjs';
import { ingestStorms } from './sources/storms.mjs';
import { ingestSolar } from './sources/solar.mjs';
import { ingestSpaceWeather } from './sources/space-weather.mjs';
import { ingestOmni } from './sources/omni.mjs';
import { ingestEarthquakes } from './sources/earthquakes.mjs';
import { ingestAam } from './sources/aam.mjs';
import { ingestEphemeris } from './sources/ephemeris.mjs';
import { ingestIbtracs } from './sources/ibtracs.mjs';
import { dbPath } from './db.mjs';

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const only = [...args].find((a) => a.startsWith('--only='))?.split('=')[1];

async function main() {
  console.log(`Wobblescope ingest → ${dbPath()}\n`);

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

  if (!only || only === 'space-weather') {
    console.log('5. Space weather (DONKI + Kp)…');
    await ingestSpaceWeather({ force });
    console.log('5b. OMNI Dst + solar wind…');
    await ingestOmni({ startYear: force ? 2010 : 2022 });
  }

  if (only === 'omni') {
    console.log('OMNI Dst + solar wind…');
    await ingestOmni({ startYear: force ? 2010 : 2022 });
  }

  if (!only || only === 'earthquakes') {
    console.log('6. USGS earthquakes (incremental)…');
    await ingestEarthquakes({ force });
  }

  if (!only || only === 'aam') {
    console.log('7. GFZ atmospheric angular momentum…');
    await ingestAam({ force });
  }

  if (only === 'ephemeris') {
    console.log('JPL Horizons ephemeris (incremental)…');
    await ingestEphemeris({ force });
  }

  if (only === 'ibtracs') {
    console.log('NOAA IBTrACS tropical cyclones…');
    await ingestIbtracs({ force });
  }

  console.log('\nDone.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});