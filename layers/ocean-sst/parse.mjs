/** Pure parsers for NOAA CPC ocean SST / ONI ASCII products. */

export function ymKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** ERSSTv5 Niño region monthly anomalies (ersst5.nino.mth.*.ascii). */
export function parseErsstNino(text) {
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

/** Atlantic / global tropics SST anomaly indices (sstoi.atl.indices). */
export function parseAtlTropics(text) {
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

/** Oceanic Niño Index seasonal rows (oni.ascii.txt). */
export function parseOni(text) {
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

/** Join ERSST Niño + Atlantic tropics maps by ym. */
export function mergeMonthly(ersst, atl) {
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
