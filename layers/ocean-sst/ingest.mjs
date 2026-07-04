import { fetchWithRetry, upsertRows } from '../../ingest/lib/index.mjs';
import { getDb } from '../../ingest/db.mjs';

const CPC = 'https://www.cpc.ncep.noaa.gov/data/indices';
const ERSST_NINO_URL = `${CPC}/ersst5.nino.mth.91-20.ascii`;
const ATL_TROPICS_URL = `${CPC}/sstoi.atl.indices`;
const ONI_URL = `${CPC}/oni.ascii.txt`;

function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function parseErsstNino(text) {
  const rows = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d{4})\s+(\d{1,2})\s+\S+\s+(-?\S+)\s+\S+\s+(-?\S+)\s+\S+\s+(-?\S+)\s+\S+\s+(-?\S+)/);
    if (!m) continue;
    const [, year, month, n12, n3, n4, n34] = m;
    rows.set(ymKey(Number(year), Number(month)), {
      ym: ymKey(Number(year), Number(month)),
      nino12_anom_c: parseFloat(n12),
      nino3_anom_c: parseFloat(n3),
      nino34_anom_c: parseFloat(n34),
      nino4_anom_c: parseFloat(n4),
    });
  }
  return rows;
}

function parseAtlTropics(text) {
  const rows = new Map();
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*(\d{4})\s+(\d{1,2})\s+\S+\s+(-?\S+)\s+\S+\s+(-?\S+)\s+\S+\s+(-?\S+)/);
    if (!m) continue;
    const [, year, month, natl, satl, trop] = m;
    rows.set(ymKey(Number(year), Number(month)), {
      global_tropics_anom_c: parseFloat(trop),
      north_atlantic_anom_c: parseFloat(natl),
      south_atlantic_anom_c: parseFloat(satl),
    });
  }
  return rows;
}

function parseOni(text) {
  const rows = [];
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z]{3})\s+(\d{4})\s+(-?\S+)\s+(-?\S+)/);
    if (!m) continue;
    const [, season, year, total, anom] = m;
    rows.push({
      season,
      year: Number(year),
      sst_total_c: parseFloat(total),
      anomaly_c: parseFloat(anom),
    });
  }
  return rows;
}

function mergeMonthly(ersst, atl) {
  const keys = new Set([...ersst.keys(), ...atl.keys()]);
  const merged = [];
  for (const ym of [...keys].sort()) {
    const e = ersst.get(ym) ?? {};
    const a = atl.get(ym) ?? {};
    merged.push({
      ym,
      nino12_anom_c: e.nino12_anom_c ?? null,
      nino3_anom_c: e.nino3_anom_c ?? null,
      nino34_anom_c: e.nino34_anom_c ?? null,
      nino4_anom_c: e.nino4_anom_c ?? null,
      global_tropics_anom_c: a.global_tropics_anom_c ?? null,
      north_atlantic_anom_c: a.north_atlantic_anom_c ?? null,
      south_atlantic_anom_c: a.south_atlantic_anom_c ?? null,
    });
  }
  return merged;
}

export async function ingest({ force = false } = {}) {
  const db = getDb();

  if (!force) {
    const existing = db.prepare('SELECT COUNT(*) AS n FROM ocean_sst_monthly').get().n;
    if (existing > 0) {
      return { rowCount: existing, notes: 'ocean-sst already ingested (use --force)', logged: false };
    }
  }

  const [ersstText, atlText, oniText] = await Promise.all([
    fetchWithRetry(ERSST_NINO_URL).then((r) => r.text()),
    fetchWithRetry(ATL_TROPICS_URL).then((r) => r.text()),
    fetchWithRetry(ONI_URL).then((r) => r.text()),
  ]);

  const monthly = mergeMonthly(parseErsstNino(ersstText), parseAtlTropics(atlText));
  const oni = parseOni(oniText);

  const monthlySql = `
    INSERT OR REPLACE INTO ocean_sst_monthly (
      ym, nino12_anom_c, nino3_anom_c, nino34_anom_c, nino4_anom_c,
      global_tropics_anom_c, north_atlantic_anom_c, south_atlantic_anom_c
    ) VALUES (
      @ym, @nino12_anom_c, @nino3_anom_c, @nino34_anom_c, @nino4_anom_c,
      @global_tropics_anom_c, @north_atlantic_anom_c, @south_atlantic_anom_c
    )
  `;

  const oniSql = `
    INSERT OR REPLACE INTO ocean_enso_oni (season, year, sst_total_c, anomaly_c)
    VALUES (@season, @year, @sst_total_c, @anomaly_c)
  `;

  const tx = db.transaction(() => {
    if (force) {
      db.prepare('DELETE FROM ocean_sst_monthly').run();
      db.prepare('DELETE FROM ocean_enso_oni').run();
    }
    upsertRows(db, monthlySql, monthly);
    upsertRows(db, oniSql, oni);
  });
  tx();

  const notes = `NOAA CPC ERSSTv5 Niño regions + global tropics OISST indices + ONI; ${monthly.length} months, ${oni.length} ONI seasons`;
  return { rowCount: monthly.length + oni.length, notes, logKey: 'ocean-sst' };
}