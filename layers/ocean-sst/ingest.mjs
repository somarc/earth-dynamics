import { fetchWithRetry, upsertRows } from '../../ingest/lib/index.mjs';
import { getDb } from '../../ingest/db.mjs';
import { mergeMonthly, parseAtlTropics, parseErsstNino, parseOni } from './parse.mjs';

const CPC = 'https://www.cpc.ncep.noaa.gov/data/indices';
const ERSST_NINO_URL = `${CPC}/ersst5.nino.mth.91-20.ascii`;
const ATL_TROPICS_URL = `${CPC}/sstoi.atl.indices`;
const ONI_URL = `${CPC}/oni.ascii.txt`;

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
