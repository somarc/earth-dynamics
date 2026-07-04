/** Build connector metadata for /api/meta from SOURCES + ingest_log + table watermarks. */

const CONNECTOR_DEFAULTS = {
  usgsEarthquakes: { syncClass: 'incremental', scaleClass: 'point', cadence: 'daily', maxStaleDays: 2 },
  noaaOceanSst: { syncClass: 'snapshot', scaleClass: 'index', cadence: 'monthly', maxStaleDays: 45 },
  openMeteo: { syncClass: 'incremental', scaleClass: 'point', cadence: 'daily', maxStaleDays: 14 },
  openMeteoGrid: { syncClass: 'nowcast', scaleClass: 'grid', cadence: 'on-demand', maxStaleDays: 7 },
  noaaStorms: { syncClass: 'incremental', scaleClass: 'point', cadence: 'weekly', maxStaleDays: 30 },
  nasaDonki: { syncClass: 'incremental', scaleClass: 'track', cadence: 'daily', maxStaleDays: 14 },
  noaaSwpc: { syncClass: 'incremental', scaleClass: 'index', cadence: 'daily', maxStaleDays: 7 },
  omni: { syncClass: 'incremental', scaleClass: 'index', cadence: 'daily', maxStaleDays: 14 },
  ibtracs: { syncClass: 'incremental', scaleClass: 'track', cadence: 'monthly', maxStaleDays: 60 },
  jplHorizons: { syncClass: 'incremental', scaleClass: 'point', cadence: 'weekly', maxStaleDays: 14 },
  gfzAam: { syncClass: 'snapshot', scaleClass: 'index', cadence: 'daily', maxStaleDays: 14 },
  iersEop: { syncClass: 'snapshot', scaleClass: 'index', cadence: 'daily', maxStaleDays: 7 },
  intermagnet: { syncClass: 'snapshot', scaleClass: 'point', cadence: 'static', maxStaleDays: 365 },
  plateBoundaries: { syncClass: 'computed', scaleClass: 'static', cadence: 'static', maxStaleDays: null },
  igrf14: { syncClass: 'computed', scaleClass: 'static', cadence: 'static', maxStaleDays: null },
};

const UPSTREAM_SQL = {
  noaaOceanSst: 'SELECT MAX(ym) AS t FROM ocean_sst_monthly',
  usgsEarthquakes: 'SELECT MAX(date) AS t FROM earthquakes',
  openMeteo: 'SELECT MAX(date) AS t FROM weather_daily',
  jplHorizons: 'SELECT MAX(date) AS t FROM ephemeris_daily',
  gfzAam: 'SELECT MAX(date) AS t FROM aam_daily',
  iersEop: 'SELECT MAX(date) AS t FROM eop_daily',
  omni: 'SELECT MAX(date) AS t FROM geomagnetic_daily',
  ibtracs: 'SELECT MAX(end_date) AS t FROM cyclone_storms',
};

function latestIngest(ingested, keys = []) {
  for (const key of keys) {
    const row = ingested.get(key);
    if (row) return row;
  }
  return null;
}

export function buildConnectors(db, sources) {
  const ingestedRows = db.prepare(
    'SELECT source, completed_at, row_count, notes FROM ingest_log ORDER BY completed_at DESC',
  ).all();
  const ingested = new Map(ingestedRows.map((r) => [r.source, r]));

  return Object.entries(sources)
    .filter(([, s]) => s?.name)
    .map(([id, source]) => {
      const defaults = CONNECTOR_DEFAULTS[id] ?? {
        syncClass: 'manual',
        scaleClass: 'point',
        cadence: 'on-demand',
        maxStaleDays: 30,
      };
      const log = latestIngest(ingested, source.ingestKeys ?? []);
      const sql = UPSTREAM_SQL[id];
      let upstreamThrough = null;
      if (sql) {
        try {
          upstreamThrough = db.prepare(sql).get()?.t ?? null;
        } catch {
          upstreamThrough = null;
        }
      }
      return {
        id,
        name: source.name,
        org: source.org,
        link: source.link,
        epistemic: source.epistemic ?? 'measured',
        ingestKeys: source.ingestKeys ?? [],
        ...defaults,
        ingestedAt: log?.completed_at ?? null,
        rowCount: log?.row_count ?? null,
        notes: log?.notes ?? null,
        upstreamThrough,
        refreshCommand: (source.ingestKeys?.[0])
          ? `npm run ingest -- --only=${source.ingestKeys[0]}`
          : null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}