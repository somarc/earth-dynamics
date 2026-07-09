/**
 * In-memory SQLite fixture for API / day-frame contract tests.
 * Tiny, deterministic, no network.
 */
import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const SCHEMA = readFileSync(join(ROOT, 'db/schema.sql'), 'utf8');

/** @param {import('better-sqlite3').Database} db */
function seed(db) {
  // Spine: EOP + ephemeris + AAM for a short window around two demo moments.
  const eop = db.prepare(`
    INSERT INTO eop_daily (
      date, mjd, x_arcsec, y_arcsec, lod_sec, x_mas, y_mas, lod_ms,
      omega_picorad_s, delta_omega_picorad_s, x_rad, y_rad
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const eph = db.prepare(`
    INSERT INTO ephemeris_daily (
      date, moon_x, moon_y, moon_z, moon_dist_km,
      sun_x, sun_y, sun_z, sun_dist_km,
      phase_angle, phase_name, illumination, moon_distance_km,
      tidal_index, syzygy, is_perigee, is_apogee, alignments_json
    ) VALUES (?, 0.1, 0.2, 0.3, 384400, 1, 0, 0, 149597870.7,
      90, 'First Quarter', 0.5, 384400, 1.0, NULL, 0, 0, '[]')
  `);
  const aam = db.prepare(`
    INSERT INTO aam_daily (date, mjd, aam_x, aam_y, aam_z) VALUES (?, ?, 0.1, 0.2, 1.5)
  `);

  const dates = [
    '2005-08-28', '2005-08-29', '2005-08-30',
    '2024-05-09', '2024-05-10', '2024-05-11', '2024-05-12',
  ];
  for (const date of dates) {
    const mjd = 50000 + dates.indexOf(date);
    eop.run(date, mjd, 0.01, -0.02, 0.001, 10, -20, 1, 72921151, 0.1, 4.8e-8, -9.7e-8);
    eph.run(date);
    aam.run(date, mjd);
  }

  // Quakes: one on G5 day, one outside ±7d of G5 for past-window checks
  const quake = db.prepare(`
    INSERT INTO earthquakes (id, time, date, mag, place, lat, lon, depth, url, tsunami)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  quake.run(
    'us-fixture-g5',
    Date.parse('2024-05-11T12:00:00Z'),
    '2024-05-11',
    6.2,
    'Fixture quake near G5',
    35.0,
    140.0,
    40,
    'https://example.test/quake',
    0,
  );
  quake.run(
    'us-fixture-old',
    Date.parse('2024-04-01T12:00:00Z'),
    '2024-04-01',
    7.1,
    'Outside May window',
    -20.0,
    180.0,
    10,
    'https://example.test/old',
    0,
  );
  quake.run(
    'us-fixture-katrina',
    Date.parse('2005-08-29T12:00:00Z'),
    '2005-08-29',
    5.4,
    'Fixture near Katrina date',
    29.0,
    -90.0,
    12,
    'https://example.test/k',
    0,
  );

  db.prepare(`
    INSERT INTO eruptions (
      id, volcano_number, name, vei, start_date, end_date, continuing, lat, lon
    ) VALUES (1, 999001, 'Fixture Volcano', 3, '2024-05-01', '2024-05-20', 0, 19.4, -155.3)
  `).run();

  db.prepare(`
    INSERT INTO weather_grid (grid_id, label, lat, lon) VALUES ('tokyo', 'Tokyo', 35.68, 139.69)
  `).run();
  db.prepare(`
    INSERT INTO weather_daily (date, grid_id, temp_max_c, temp_min_c, precip_mm, wind_max_kmh)
    VALUES ('2024-05-11', 'tokyo', 22.5, 14.0, 0.2, 18.0)
  `).run();

  db.prepare(`
    INSERT INTO geomagnetic_daily (
      date, kp_max, kp_avg, dst_min, g_scale, aurora_level, sw_speed_kms, sw_bz_nt, sw_density
    ) VALUES ('2024-05-11', 9.0, 7.5, -412, 5, 5, 750, -40, 20)
  `).run();

  db.prepare(`
    INSERT INTO space_weather_events (
      id, event_type, start_time, date, end_time, speed, magnitude, kp_peak,
      half_angle, source_location, description, source_url
    ) VALUES
    ('cme-fixture', 'CME', '2024-05-08T00:00:00Z', '2024-05-08', NULL, 1900, NULL, NULL, 45, NULL, 'Fixture CME', NULL),
    ('gst-fixture', 'GST', '2024-05-11T00:00:00Z', '2024-05-11', NULL, NULL, 'G5', 9.0, NULL, NULL, 'Fixture GST', NULL),
    ('flr-fixture', 'FLR', '2024-05-10T00:00:00Z', '2024-05-10', NULL, NULL, 'X5.0', NULL, NULL, 'S20W10', 'Fixture flare', NULL)
  `).run();

  db.prepare(`
    INSERT INTO solar_daily (date, sunspot_number, kp_max, kp_avg)
    VALUES ('2024-05-11', 180, 9, 7.5)
  `).run();

  db.prepare(`
    INSERT INTO storm_events (
      id, date, event_type, state, country, lat, lon, magnitude, deaths, injuries, narrative
    ) VALUES (
      'storm-katrina', '2005-08-29', 'Hurricane', 'LA', 'US', 29.95, -90.07, 'Cat 3', 0, 0, 'Fixture'
    )
  `).run();

  db.prepare(`
    INSERT INTO cyclone_storms (
      sid, name, basin, season, start_date, end_date, max_wind_kts, max_sshs, track_json
    ) VALUES (
      '2005236N23285', 'KATRINA', 'NA', 2005, '2005-08-23', '2005-08-31', 150, 5,
      '[{"date":"2005-08-28","lat":28.0,"lon":-88.0,"wind":100},{"date":"2005-08-29","lat":29.5,"lon":-89.6,"wind":110}]'
    )
  `).run();

  db.prepare(`
    INSERT INTO ocean_sst_monthly (
      ym, nino12_anom_c, nino3_anom_c, nino34_anom_c, nino4_anom_c,
      global_tropics_anom_c, north_atlantic_anom_c, south_atlantic_anom_c
    ) VALUES ('2024-05', 0.5, 0.4, 0.3, 0.2, 0.1, 0.0, -0.1)
  `).run();

  db.prepare(`
    INSERT INTO ocean_enso_oni (season, year, sst_total_c, anomaly_c)
    VALUES ('MAM', 2024, 27.5, 0.4)
  `).run();

  db.prepare(`
    INSERT INTO ingest_log (source, completed_at, row_count, notes)
    VALUES
      ('earthquakes', '2024-05-12T00:00:00Z', 3, 'fixture'),
      ('ephemeris', '2024-05-12T00:00:00Z', 7, 'fixture'),
      ('json-eop', '2024-05-12T00:00:00Z', 7, 'fixture')
  `).run();
}

/** Create a seeded in-memory Wobblescope DB. */
export function createFixtureDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

/** Empty schema-only DB (bootstrap / missing coverage tests). */
export function createEmptyDb() {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  return db;
}
