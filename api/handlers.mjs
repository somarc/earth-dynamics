import { SOURCES } from '../ingest/constants.mjs';
import { getHomeAsset, getHomeRegionConfig, listHomeAssetKeys } from '../ingest/home-store.mjs';
import { igrfDipPoles, igrfFieldAt } from './igrf.mjs';

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

function lagDays(fromDate, toDate) {
  if (!fromDate || !toDate || toDate <= fromDate) return 0;
  return Math.round(
    (Date.parse(`${toDate}T12:00:00Z`) - Date.parse(`${fromDate}T12:00:00Z`)) / 86_400_000,
  );
}

function extensionMaxDate(db) {
  const { maxDate } = db.prepare(`
    SELECT MAX(d) AS maxDate FROM (
      SELECT MAX(date) AS d FROM earthquakes
      UNION ALL SELECT MAX(start_date) AS d FROM eruptions
      UNION ALL SELECT MAX(date) AS d FROM ephemeris_daily
    )
  `).get();
  return maxDate ?? null;
}

function visibleTimelineEnd(db) {
  const lastEop = db.prepare('SELECT MAX(date) AS end FROM eop_daily').get()?.end ?? null;
  if (!lastEop) return null;
  const maxDate = extensionMaxDate(db);
  if (!maxDate || maxDate <= lastEop) return lastEop;
  return maxDate;
}

function resolveDailyRow(db, table, date) {
  let row = db.prepare(`SELECT * FROM ${table} WHERE date = ?`).get(date);
  if (row) {
    return { row, asOf: row.date, coverage: 'exact' };
  }
  row = db.prepare(
    `SELECT * FROM ${table} WHERE date <= ? ORDER BY date DESC LIMIT 1`,
  ).get(date);
  if (row) {
    return { row, asOf: row.date, coverage: 'fallback' };
  }
  return { row: null, asOf: null, coverage: 'missing' };
}

export function createHandlers(db) {
  const getMeta = () => {
    const eop = db.prepare('SELECT MIN(date) AS start, MAX(date) AS end, COUNT(*) AS count FROM eop_daily').get();
    const ingested = db.prepare(
      'SELECT source, completed_at, row_count, notes FROM ingest_log ORDER BY completed_at DESC'
    ).all();
    const ephEnd = db.prepare('SELECT MAX(date) AS end FROM ephemeris_daily').get()?.end ?? null;
    const quakeEnd = db.prepare('SELECT MAX(date) AS end FROM earthquakes').get()?.end ?? null;
    const eopEnd = eop?.end ?? null;
    const timelineEnd = visibleTimelineEnd(db);

    const homeAssets = listHomeAssetKeys();
    const homeUpdated = db.prepare('SELECT updated_at FROM home_regions WHERE id = ?').get('eastern-ontario');

    return {
      sources: SOURCES,
      eop,
      ingested,
      freshness: {
        timelineEnd,
        eopEnd,
        ephemerisEnd: ephEnd,
        eopLagDays: lagDays(eopEnd, timelineEnd),
        ephemerisLagDays: lagDays(ephEnd, timelineEnd),
        earthquakesThrough: quakeEnd,
        homeRegionUpdated: homeUpdated?.updated_at ?? null,
        homeAssetCount: homeAssets.length,
      },
      generated: new Date().toISOString(),
    };
  };

  const getHome = (regionId = 'eastern-ontario') => {
    const config = getHomeRegionConfig(regionId);
    if (!config) return null;
    const assets = listHomeAssetKeys(regionId).map((a) => ({
      key: a.asset_key,
      bytes: a.byte_length,
      mime: a.mime_type,
      fetchedAt: a.fetched_at,
    }));
    return { ...config, assetInventory: assets };
  };

  const getHomeAssetBinary = (assetKey, regionId = 'eastern-ontario') => {
    const row = getHomeAsset(regionId, assetKey);
    if (!row) return null;
    return {
      mime: row.mime_type,
      data: row.data,
      sha256: row.sha256,
      byteLength: row.byte_length,
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

  const getDay = (date, { pastDays = null } = {}) => {
    const past = Number.isFinite(pastDays) && pastDays > 0
      ? Math.min(30, Math.floor(pastDays))
      : null;

    const eopResolved = resolveDailyRow(db, 'eop_daily', date);
    const ephResolved = resolveDailyRow(db, 'ephemeris_daily', date);
    const aamResolved = resolveDailyRow(db, 'aam_daily', date);

    const eop = rowToEop(eopResolved.row);
    const eph = rowToEphemeris(ephResolved.row);

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

    const aam = aamResolved.row
      ? {
          date: aamResolved.row.date,
          mjd: aamResolved.row.mjd,
          aamX: aamResolved.row.aam_x,
          aamY: aamResolved.row.aam_y,
          aamZ: aamResolved.row.aam_z,
        }
      : null;

    const cycloneRows = past
      ? db.prepare(`
          SELECT sid, name, basin, season, start_date AS startDate, end_date AS endDate,
                 max_wind_kts AS maxWindKts, max_sshs AS maxSshs, track_json AS trackJson
          FROM cyclone_storms
          WHERE start_date <= date(?) AND end_date >= date(?, ?)
          ORDER BY max_wind_kts DESC
          LIMIT 20
        `).all(date, date, `-${past} days`)
      : db.prepare(`
          SELECT sid, name, basin, season, start_date AS startDate, end_date AS endDate,
                 max_wind_kts AS maxWindKts, max_sshs AS maxSshs, track_json AS trackJson
          FROM cyclone_storms
          WHERE start_date <= date(?, '+7 days') AND end_date >= date(?, '-7 days')
          ORDER BY max_wind_kts DESC
          LIMIT 20
        `).all(date, date);

    const cyclones = cycloneRows.map((row) => {
      const track = JSON.parse(row.trackJson || '[]').filter((p) => p.date <= date);
      return {
        sid: row.sid,
        name: row.name,
        basin: row.basin,
        season: row.season,
        startDate: row.startDate,
        endDate: row.endDate,
        maxWindKts: row.maxWindKts,
        maxSshs: row.maxSshs,
        track,
      };
    }).filter((c) => c.track.length >= 2);

    const magnetometers = getMagnetometers(date);
    const magneticPoles = igrfDipPoles(date);

    return {
      date,
      eop,
      ephemeris: eph,
      aam,
      earthquakes: quakeRows,
      eruptions: volcRows,
      cyclones,
      storms,
      weather,
      solar,
      geomagnetic: geomagnetic || null,
      spaceWeather: spaceEvents,
      magnetometers,
      magneticPoles,
      asOf: {
        eop: eopResolved.asOf,
        ephemeris: ephResolved.asOf,
        aam: aamResolved.asOf,
      },
      coverage: {
        eop: eopResolved.coverage,
        ephemeris: ephResolved.coverage,
        aam: aamResolved.coverage,
      },
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

  const getMagnetometers = (date) => {
    const rows = db.prepare(`
      SELECT iaga_code AS iagaCode, name, lat, lon, elevation_m AS elevationM,
             institute, url, opened, closed
      FROM mag_observatories
      WHERE closed IS NULL
      ORDER BY iaga_code
    `).all();

    return rows.map((obs) => ({
      ...obs,
      field: igrfFieldAt(obs.lat, obs.lon, date, obs.elevationM ?? 0),
      fieldEpistemic: 'modeled',
      siteEpistemic: 'measured',
    }));
  };

  const getAamWindow = (endDate, days = 400) =>
    db.prepare(`
      SELECT date, mjd, aam_x AS aamX, aam_y AS aamY, aam_z AS aamZ
      FROM aam_daily
      WHERE date <= ?
      ORDER BY date DESC
      LIMIT ?
    `).all(endDate, days).reverse();

  const getDates = () => {
    const dates = db.prepare('SELECT date FROM eop_daily ORDER BY date').all().map((r) => r.date);
    if (!dates.length) return dates;

    const lastEop = dates[dates.length - 1];
    const maxDate = extensionMaxDate(db);
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

  return {
    getMeta, getEopWindow, getDay, getDates, getEphemerisWindow, getGeomagneticWindow,
    getAamWindow, getHome, getHomeAssetBinary,
  };
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
  if (path === '/api/aam/window') {
    const params = new URL(url, 'http://local').searchParams;
    const end = params.get('end');
    const days = parseInt(params.get('days') || '400', 10);
    return { status: 200, body: handlers.getAamWindow(end, days) };
  }

  if (path === '/api/home') {
    const config = handlers.getHome();
    if (!config) return { status: 404, body: { error: 'Home region not ingested — run npm run sync-home' } };
    return { status: 200, body: config };
  }

  const homeAssetMatch = path.match(/^\/api\/home\/assets\/([a-z0-9-]+)$/);
  if (homeAssetMatch) {
    const asset = handlers.getHomeAssetBinary(homeAssetMatch[1]);
    if (!asset) return { status: 404, body: { error: 'Home asset not found' } };
    return {
      status: 200,
      binary: true,
      mime: asset.mime,
      body: asset.data,
      headers: {
        'Cache-Control': 'public, max-age=31536000, immutable',
        ETag: `"${asset.sha256}"`,
        'Content-Length': String(asset.byteLength),
      },
    };
  }

  return { status: 404, body: { error: 'Not found' } };
}