import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getDb, logIngest } from './db.mjs';

const DATA = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

function readJson(name) {
  const path = join(DATA, name);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function migrateFromJson() {
  const db = getDb();

  const eop = readJson('eop.json');
  if (eop?.length) {
    const ins = db.prepare(`
      INSERT OR REPLACE INTO eop_daily VALUES (
        @date,@mjd,@xArcsec,@yArcsec,@lodSec,@xMas,@yMas,@lodMs,
        @omegaPicoradS,@deltaOmegaPicoradS,@xRad,@yRad
      )`);
    const tx = db.transaction((rows) => rows.forEach((r) => ins.run({
      date: r.date, mjd: r.mjd, xArcsec: r.xArcsec, yArcsec: r.yArcsec,
      lodSec: r.lodSec, xMas: r.xMas, yMas: r.yMas, lodMs: r.lodMs,
      omegaPicoradS: r.omegaPicoradS, deltaOmegaPicoradS: r.deltaOmegaPicoradS,
      xRad: r.xRad, yRad: r.yRad,
    })));
    tx(eop);
    logIngest('eop', eop.length, 'from public/data/eop.json');
    console.log(`  eop: ${eop.length} rows`);
  }

  const quakes = readJson('earthquakes.json');
  if (quakes?.length) {
    const ins = db.prepare(`
      INSERT OR REPLACE INTO earthquakes VALUES (
        @id,@time,@date,@mag,@place,@lat,@lon,@depth,@url,@tsunami
      )`);
    const tx = db.transaction((rows) => rows.forEach((r) => ins.run({
      id: r.id, time: r.time, date: r.date, mag: r.mag, place: r.place,
      lat: r.lat, lon: r.lon, depth: r.depth, url: r.url, tsunami: r.tsunami ? 1 : 0,
    })));
    tx(quakes);
    logIngest('earthquakes', quakes.length, 'from JSON');
    console.log(`  earthquakes: ${quakes.length} rows`);
  }

  const eruptions = readJson('eruptions.json');
  if (eruptions?.length) {
    const ins = db.prepare(`
      INSERT OR REPLACE INTO eruptions VALUES (
        @id,@volcanoNumber,@name,@vei,@startDate,@endDate,@continuing,@lat,@lon
      )`);
    const tx = db.transaction((rows) => rows.forEach((r) => ins.run({
      id: r.id, volcanoNumber: r.volcanoNumber, name: r.name, vei: r.vei,
      startDate: r.startDate, endDate: r.endDate, continuing: r.continuing ? 1 : 0,
      lat: r.lat, lon: r.lon,
    })));
    tx(eruptions);
    logIngest('eruptions', eruptions.length, 'from JSON');
    console.log(`  eruptions: ${eruptions.length} rows`);
  }

  const volcanoes = readJson('volcanoes.json');
  if (volcanoes?.length) {
    const ins = db.prepare(`
      INSERT OR REPLACE INTO volcanoes VALUES (
        @volcanoNumber,@name,@country,@region,@lastEruptionYear,@lat,@lon,@elevation,@type
      )`);
    const tx = db.transaction((rows) => rows.forEach((r) => ins.run({
      volcanoNumber: r.volcanoNumber, name: r.name, country: r.country, region: r.region,
      lastEruptionYear: r.lastEruptionYear, lat: r.lat, lon: r.lon,
      elevation: r.elevation, type: r.type,
    })));
    tx(volcanoes);
    logIngest('volcanoes', volcanoes.length, 'from JSON');
    console.log(`  volcanoes: ${volcanoes.length} rows`);
  }

  const ephemeris = readJson('ephemeris.json');
  if (ephemeris?.byDate) {
    const ins = db.prepare(`
      INSERT OR REPLACE INTO ephemeris_daily VALUES (
        @date,
        @moon_x,@moon_y,@moon_z,@moon_dist_km,
        @sun_x,@sun_y,@sun_z,@sun_dist_km,
        @mercury_x,@mercury_y,@mercury_z,
        @venus_x,@venus_y,@venus_z,
        @mars_x,@mars_y,@mars_z,
        @jupiter_x,@jupiter_y,@jupiter_z,
        @saturn_x,@saturn_y,@saturn_z,
        @earth_helio_x,@earth_helio_y,@earth_helio_z,@earth_helio_dist_au,@earth_helio_dist_km,
        @phase_angle,@phase_name,@illumination,@moon_distance_km,@tidal_index,
        @syzygy,@is_perigee,@is_apogee,@alignments_json
      )`);
    const rows = Object.entries(ephemeris.byDate);
    const tx = db.transaction((entries) => {
      for (const [date, d] of entries) {
        const eh = d.earthHelio || {};
        const lunar = d.lunar || {};
        ins.run({
          date,
          moon_x: d.moon?.x, moon_y: d.moon?.y, moon_z: d.moon?.z, moon_dist_km: d.moon?.distKm,
          sun_x: d.sun?.x, sun_y: d.sun?.y, sun_z: d.sun?.z, sun_dist_km: d.sun?.distKm,
          mercury_x: d.mercury?.x, mercury_y: d.mercury?.y, mercury_z: d.mercury?.z,
          venus_x: d.venus?.x, venus_y: d.venus?.y, venus_z: d.venus?.z,
          mars_x: d.mars?.x, mars_y: d.mars?.y, mars_z: d.mars?.z,
          jupiter_x: d.jupiter?.x, jupiter_y: d.jupiter?.y, jupiter_z: d.jupiter?.z,
          saturn_x: d.saturn?.x, saturn_y: d.saturn?.y, saturn_z: d.saturn?.z,
          earth_helio_x: eh.x, earth_helio_y: eh.y, earth_helio_z: eh.z,
          earth_helio_dist_au: eh.distAu, earth_helio_dist_km: eh.distKm,
          phase_angle: lunar.phaseAngle, phase_name: lunar.phaseName,
          illumination: lunar.illumination, moon_distance_km: lunar.moonDistanceKm,
          tidal_index: lunar.tidalIndex, syzygy: lunar.syzygy,
          is_perigee: lunar.isPerigee ? 1 : 0, is_apogee: lunar.isApogee ? 1 : 0,
          alignments_json: JSON.stringify(d.alignments || []),
        });
      }
    });
    tx(rows);
    logIngest('ephemeris', rows.length, 'from public/data/ephemeris.json');
    console.log(`  ephemeris: ${rows.length} rows`);
  }
}