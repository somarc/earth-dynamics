import { SOURCES } from '../ingest/constants.mjs';

function rowToEop(r) {
  if (!r) return null;
  return {
    date: r.date,
    mjd: r.mjd,
    xArcsec: r.x_arcsec,
    yArcsec: r.y_arcsec,
    lodSec: r.lod_sec,
    xMas: r.x_mas,
    yMas: r.y_mas,
    lodMs: r.lod_ms,
    omegaPicoradS: r.omega_picorad_s,
    deltaOmegaPicoradS: r.delta_omega_picorad_s,
    xRad: r.x_rad,
    yRad: r.y_rad,
  };
}

function rowToEphemeris(r) {
  if (!r) return null;
  const body = (key) => {
    const x = r[`${key}_x`];
    if (x == null) return null;
    return {
      x, y: r[`${key}_y`], z: r[`${key}_z`],
      distKm: r[`${key}_dist_km`],
      distAu: r[`${key}_dist_km`] ? r[`${key}_dist_km`] / 149597870.7 : undefined,
    };
  };
  return {
    moon: body('moon'),
    sun: body('sun'),
    mercury: body('mercury'),
    venus: body('venus'),
    mars: body('mars'),
    jupiter: body('jupiter'),
    saturn: body('saturn'),
    earthHelio: r.earth_helio_x != null ? {
      x: r.earth_helio_x, y: r.earth_helio_y, z: r.earth_helio_z,
      distAu: r.earth_helio_dist_au, distKm: r.earth_helio_dist_km,
    } : null,
    lunar: {
      phaseAngle: r.phase_angle,
      phaseName: r.phase_name,
      illumination: r.illumination,
      moonDistanceKm: r.moon_distance_km,
      tidalIndex: r.tidal_index,
      sunElongation: r.phase_angle,
      syzygy: r.syzygy,
      isPerigee: !!r.is_perigee,
      isApogee: !!r.is_apogee,
    },
    alignments: JSON.parse(r.alignments_json || '[]'),
  };
}

export function createHandlers(db) {
  const getMeta = () => {
    const eop = db.prepare('SELECT MIN(date) AS start, MAX(date) AS end, COUNT(*) AS count FROM eop_daily').get();
    const ingested = db.prepare('SELECT source, completed_at, row_count FROM ingest_log').all();
    return {
      sources: SOURCES,
      eop: eop,
      ingested,
      generated: new Date().toISOString(),
    };
  };

  const getEopWindow = (endDate, days = 400) => {
    return db.prepare(`
      SELECT * FROM eop_daily
      WHERE date <= ?
      ORDER BY date DESC
      LIMIT ?
    `).all(endDate, days).reverse().map(rowToEop);
  };

  const getEopForDate = (date) => {
    let row = db.prepare('SELECT * FROM eop_daily WHERE date = ?').get(date);
    if (!row) {
      row = db.prepare(
        'SELECT * FROM eop_daily WHERE date <= ? ORDER BY date DESC LIMIT 1'
      ).get(date);
    }
    return rowToEop(row);
  };

  const getDay = (date, { pastDays = null } = {}) => {
    const past = Number.isFinite(pastDays) && pastDays > 0
      ? Math.min(30, Math.floor(pastDays))
      : null;

    const eop = getEopForDate(date);
    let ephRow = db.prepare('SELECT * FROM ephemeris_daily WHERE date = ?').get(date);
    if (!ephRow) {
      ephRow = db.prepare(
        'SELECT * FROM ephemeris_daily WHERE date <= ? ORDER BY date DESC LIMIT 1'
      ).get(date);
    }
    const eph = rowToEphemeris(ephRow);

    const quakes = past
      ? db.prepare(`
          SELECT id, time, date, mag, place, lat, lon, depth, url, tsunami
          FROM earthquakes
          WHERE date BETWEEN date(?, ?) AND date(?)
          ORDER BY mag DESC LIMIT 50
        `).all(date, `-${past} days`, date)
      : db.prepare(`
          SELECT id, time, date, mag, place, lat, lon, depth, url, tsunami
          FROM earthquakes
          WHERE date BETWEEN date(?, '-7 days') AND date(?, '+7 days')
          ORDER BY mag DESC LIMIT 50
        `).all(date, date);
    const quakeRows = quakes.map((q) => ({ ...q, tsunami: !!q.tsunami }));

    const volcs = past
      ? db.prepare(`
          SELECT id, volcano_number AS volcanoNumber, name, vei, start_date AS startDate,
                 end_date AS endDate, continuing, lat, lon
          FROM eruptions
          WHERE start_date <= date(?)
            AND (end_date IS NULL OR end_date >= date(?, ?))
          LIMIT 20
        `).all(date, date, `-${past} days`)
      : db.prepare(`
          SELECT id, volcano_number AS volcanoNumber, name, vei, start_date AS startDate,
                 end_date AS endDate, continuing, lat, lon
          FROM eruptions
          WHERE start_date <= date(?, '+7 days')
            AND (end_date IS NULL OR end_date >= date(?, '-7 days'))
          LIMIT 20
        `).all(date, date);
    const volcRows = volcs.map((v) => ({ ...v, continuing: !!v.continuing }));

    const storms = past
      ? db.prepare(`
          SELECT id, date, event_type AS eventType, state, lat, lon, magnitude, deaths, narrative
          FROM storm_events
          WHERE date BETWEEN date(?, ?) AND date(?)
          ORDER BY deaths DESC, event_type LIMIT 30
        `).all(date, `-${past} days`, date)
      : db.prepare(`
          SELECT id, date, event_type AS eventType, state, lat, lon, magnitude, deaths, narrative
          FROM storm_events
          WHERE date BETWEEN date(?, '-3 days') AND date(?, '+3 days')
          ORDER BY deaths DESC, event_type LIMIT 30
        `).all(date, date);

    const weather = db.prepare(`
      SELECT w.grid_id AS gridId, g.label, g.lat, g.lon,
             w.temp_max_c AS tempMaxC, w.temp_min_c AS tempMinC,
             w.precip_mm AS precipMm, w.wind_max_kmh AS windMaxKmh
      FROM weather_daily w
      JOIN weather_grid g ON g.grid_id = w.grid_id
      WHERE w.date = ?
    `).all(date);

    const solar = db.prepare('SELECT * FROM solar_daily WHERE date = ?').get(date);

    const geomagnetic = db.prepare(`
      SELECT date, kp_max AS kpMax, kp_avg AS kpAvg, dst_min AS dstMin,
             g_scale AS gScale, aurora_level AS auroraLevel,
             sw_speed_kms AS swSpeedKms, sw_bz_nt AS swBzNt, sw_density AS swDensity
      FROM geomagnetic_daily WHERE date = ?
    `).get(date);

    const spaceEvents = past
      ? db.prepare(`
          SELECT id, event_type AS eventType, start_time AS startTime, date,
                 end_time AS endTime, speed, magnitude, kp_peak AS kpPeak,
                 half_angle AS halfAngle, source_location AS sourceLocation,
                 description, source_url AS sourceUrl
          FROM space_weather_events
          WHERE date BETWEEN date(?, ?) AND date(?)
          ORDER BY
            CASE event_type WHEN 'GST' THEN 0 WHEN 'CME' THEN 1 WHEN 'FLR' THEN 2 ELSE 3 END,
            kp_peak DESC, speed DESC
          LIMIT 40
        `).all(date, `-${past} days`, date)
      : db.prepare(`
          SELECT id, event_type AS eventType, start_time AS startTime, date,
                 end_time AS endTime, speed, magnitude, kp_peak AS kpPeak,
                 half_angle AS halfAngle, source_location AS sourceLocation,
                 description, source_url AS sourceUrl
          FROM space_weather_events
          WHERE date BETWEEN date(?, '-5 days') AND date(?, '+5 days')
          ORDER BY
            CASE event_type WHEN 'GST' THEN 0 WHEN 'CME' THEN 1 WHEN 'FLR' THEN 2 ELSE 3 END,
            kp_peak DESC, speed DESC
          LIMIT 40
        `).all(date, date);

    return {
      date, eop, ephemeris: eph, earthquakes: quakeRows, eruptions: volcRows,
      storms, weather, solar, geomagnetic: geomagnetic || null, spaceWeather: spaceEvents,
    };
  };

  const getGeomagneticWindow = (endDate, days = 28) =>
    db.prepare(`
      SELECT date, kp_max AS kpMax, kp_avg AS kpAvg, dst_min AS dstMin,
             g_scale AS gScale, aurora_level AS auroraLevel,
             sw_speed_kms AS swSpeedKms, sw_bz_nt AS swBzNt, sw_density AS swDensity
      FROM geomagnetic_daily
      WHERE date <= ?
      ORDER BY date DESC
      LIMIT ?
    `).all(endDate, days).reverse();

  const getDates = () => {
    const dates = db.prepare('SELECT date FROM eop_daily ORDER BY date').all().map((r) => r.date);
    if (!dates.length) return dates;

    const lastEop = dates[dates.length - 1];
    const { maxDate } = db.prepare(`
      SELECT MAX(d) AS maxDate FROM (
        SELECT MAX(date) AS d FROM earthquakes
        UNION ALL SELECT MAX(start_date) AS d FROM eruptions
        UNION ALL SELECT MAX(date) AS d FROM ephemeris_daily
      )
    `).get();
    if (!maxDate || maxDate <= lastEop) return dates;

    const extended = [...dates];
    const cursor = new Date(`${lastEop}T12:00:00Z`);
    const end = new Date(`${maxDate}T12:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    while (cursor <= end) {
      extended.push(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return extended;
  };

  const getEphemerisWindow = (endDate, days = 28) =>
    db.prepare(`
      SELECT * FROM ephemeris_daily WHERE date <= ?
      ORDER BY date DESC LIMIT ?
    `).all(endDate, days).reverse().map((r) => ({
      date: r.date,
      ...rowToEphemeris(r),
    }));

  return { getMeta, getEopWindow, getDay, getDates, getEphemerisWindow, getGeomagneticWindow };
}

export function routeRequest(db, url) {
  const handlers = createHandlers(db);
  const path = new URL(url, 'http://local').pathname;

  if (path === '/api/meta') {
    return { status: 200, body: handlers.getMeta() };
  }
  if (path === '/api/dates') {
    return { status: 200, body: { dates: handlers.getDates() } };
  }
  const dayMatch = path.match(/^\/api\/day\/(\d{4}-\d{2}-\d{2})$/);
  if (dayMatch) {
    const params = new URL(url, 'http://local').searchParams;
    const past = params.get('past');
    const pastDays = past != null ? parseInt(past, 10) : null;
    return { status: 200, body: handlers.getDay(dayMatch[1], { pastDays }) };
  }
  if (path === '/api/eop/window') {
    const params = new URL(url, 'http://local').searchParams;
    const end = params.get('end');
    const days = parseInt(params.get('days') || '400', 10);
    return { status: 200, body: handlers.getEopWindow(end, days) };
  }
  if (path === '/api/ephemeris/window') {
    const params = new URL(url, 'http://local').searchParams;
    const end = params.get('end');
    const days = parseInt(params.get('days') || '28', 10);
    return { status: 200, body: handlers.getEphemerisWindow(end, days) };
  }
  if (path === '/api/geomagnetic/window') {
    const params = new URL(url, 'http://local').searchParams;
    const end = params.get('end');
    const days = parseInt(params.get('days') || '28', 10);
    return { status: 200, body: handlers.getGeomagneticWindow(end, days) };
  }

  return { status: 404, body: { error: 'Not found' } };
}