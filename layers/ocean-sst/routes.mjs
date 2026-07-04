/** CPC season label year + approximate center month for chronological sort. */
const SEASON_CENTER_MONTH = {
  DJF: 1, JFM: 2, FMA: 3, MAM: 4, AMJ: 5, MJJ: 6, JJA: 7,
  JAS: 8, ASO: 9, SON: 10, OND: 11, NDJ: 12,
};

function rowToMonthly(r) {
  if (!r) return null;
  return {
    ym: r.ym,
    nino12AnomC: r.nino12_anom_c,
    nino3AnomC: r.nino3_anom_c,
    nino34AnomC: r.nino34_anom_c,
    nino4AnomC: r.nino4_anom_c,
    globalTropicsAnomC: r.global_tropics_anom_c,
    northAtlanticAnomC: r.north_atlantic_anom_c,
    southAtlanticAnomC: r.south_atlantic_anom_c,
  };
}

function rowToOni(r) {
  if (!r) return null;
  return {
    season: r.season,
    year: r.year,
    sstTotalC: r.sst_total_c,
    anomalyC: r.anomaly_c,
  };
}

function oniSortKey(row) {
  return row.year * 12 + (SEASON_CENTER_MONTH[row.season] ?? 0);
}

export function getOceanWindow(db, endYm, months = 180) {
  const monthly = db.prepare(`
    SELECT * FROM ocean_sst_monthly
    WHERE ym <= ?
    ORDER BY ym DESC
    LIMIT ?
  `).all(endYm, months).reverse().map(rowToMonthly);

  const oniRows = db.prepare('SELECT * FROM ocean_enso_oni ORDER BY year, season').all();
  const oniSeries = oniRows
    .map(rowToOni)
    .sort((a, b) => oniSortKey(a) - oniSortKey(b));

  return { monthly, oni: oniSeries };
}

export function getOceanSnapshot(db, date) {
  const ym = date.slice(0, 7);
  const monthly = rowToMonthly(
    db.prepare('SELECT * FROM ocean_sst_monthly WHERE ym <= ? ORDER BY ym DESC LIMIT 1').get(ym),
  );

  const oniRows = db.prepare('SELECT * FROM ocean_enso_oni').all().map(rowToOni);
  const oni = oniRows.length
    ? oniRows.sort((a, b) => oniSortKey(b) - oniSortKey(a))[0]
    : null;

  return {
    asOfYm: monthly?.ym ?? null,
    monthly,
    oni,
    source: {
      nino: 'https://www.cpc.ncep.noaa.gov/data/indices/ersst5.nino.mth.91-20.ascii',
      tropics: 'https://www.cpc.ncep.noaa.gov/data/indices/sstoi.atl.indices',
      oni: 'https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt',
    },
  };
}

export function oceanRoutes() {
  return [
    {
      path: '/api/ocean/window',
      handler(db, url) {
        const params = new URL(url, 'http://local').searchParams;
        const end = params.get('end')?.slice(0, 7) ?? new Date().toISOString().slice(0, 7);
        const months = Math.min(600, Math.max(12, parseInt(params.get('months') || '180', 10)));
        return { status: 200, body: getOceanWindow(db, end, months) };
      },
    },
    {
      path: '/api/ocean/snapshot',
      match(url) {
        const path = new URL(url, 'http://local').pathname;
        const m = path.match(/^\/api\/ocean\/snapshot\/(\d{4}-\d{2}-\d{2})$/);
        return m ? { date: m[1] } : null;
      },
      handler(db, _url, params) {
        return { status: 200, body: getOceanSnapshot(db, params.date) };
      },
    },
  ];
}