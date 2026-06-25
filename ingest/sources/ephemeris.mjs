import { getDb, logIngest } from '../db.mjs';
import { fetchEphemerisForDates } from '../lib/horizons-ephemeris.mjs';

function insertEphemerisRows(db, byDate) {
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
    )
  `);

  const tx = db.transaction((entries) => {
    for (const [date, d] of entries) {
      const eh = d.earthHelio || {};
      const lunar = d.lunar || {};
      ins.run({
        date,
        moon_x: d.moon?.x,
        moon_y: d.moon?.y,
        moon_z: d.moon?.z,
        moon_dist_km: d.moon?.distKm,
        sun_x: d.sun?.x,
        sun_y: d.sun?.y,
        sun_z: d.sun?.z,
        sun_dist_km: d.sun?.distKm,
        mercury_x: d.mercury?.x,
        mercury_y: d.mercury?.y,
        mercury_z: d.mercury?.z,
        venus_x: d.venus?.x,
        venus_y: d.venus?.y,
        venus_z: d.venus?.z,
        mars_x: d.mars?.x,
        mars_y: d.mars?.y,
        mars_z: d.mars?.z,
        jupiter_x: d.jupiter?.x,
        jupiter_y: d.jupiter?.y,
        jupiter_z: d.jupiter?.z,
        saturn_x: d.saturn?.x,
        saturn_y: d.saturn?.y,
        saturn_z: d.saturn?.z,
        earth_helio_x: eh.x,
        earth_helio_y: eh.y,
        earth_helio_z: eh.z,
        earth_helio_dist_au: eh.distAu,
        earth_helio_dist_km: eh.distKm,
        phase_angle: lunar.phaseAngle,
        phase_name: lunar.phaseName,
        illumination: lunar.illumination,
        moon_distance_km: lunar.moonDistanceKm,
        tidal_index: lunar.tidalIndex,
        syzygy: lunar.syzygy,
        is_perigee: lunar.isPerigee ? 1 : 0,
        is_apogee: lunar.isApogee ? 1 : 0,
        alignments_json: JSON.stringify(d.alignments || []),
      });
    }
  });

  tx(Object.entries(byDate));
}

export async function ingestEphemeris({ force = false } = {}) {
  const db = getDb();
  const { eopEnd } = db.prepare('SELECT MAX(date) AS eopEnd FROM eop_daily').get();
  const { ephEnd } = db.prepare('SELECT MAX(date) AS ephEnd FROM ephemeris_daily').get();

  if (!eopEnd) {
    console.log('  ephemeris: no EOP rows — run ingest --only=json first');
    return 0;
  }

  let pendingDates;
  if (force) {
    pendingDates = db.prepare('SELECT date FROM eop_daily ORDER BY date').all().map((r) => r.date);
    console.log(`  ephemeris: force refresh ${pendingDates.length} dates`);
  } else if (!ephEnd) {
    console.log('  ephemeris: no rows yet — run ingest --only=json or npm run fetch-data');
    return 0;
  } else if (ephEnd >= eopEnd) {
    console.log(`  ephemeris: up to date (${ephEnd})`);
    return 0;
  } else {
    pendingDates = db
      .prepare('SELECT date FROM eop_daily WHERE date > ? ORDER BY date')
      .all(ephEnd)
      .map((r) => r.date);
    console.log(`  ephemeris: extending ${ephEnd} → ${eopEnd} (${pendingDates.length} days)`);
  }

  if (!pendingDates.length) return 0;

  const ephemeris = await fetchEphemerisForDates(pendingDates);
  insertEphemerisRows(db, ephemeris.byDate);

  const count = db.prepare('SELECT COUNT(*) AS n FROM ephemeris_daily').get().n;
  logIngest('ephemeris', count, `JPL Horizons incremental; +${ephemeris.dates.length} this run`);
  console.log(`  ephemeris: ${count} rows total (+${ephemeris.dates.length})`);
  return ephemeris.dates.length;
}