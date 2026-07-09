/**
 * Pure parsers for GFZ ESMGFZ operational AAM ASCII products.
 */

const DATA_LINE =
  /^(\d{4})\s+(\d{2})\s+(\d{2})\s+(\d{2})\s+(\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)\s+(-?\S+)/;

/**
 * Parse 3-hourly AAM ASCII into hourly component rows (mass + motion summed).
 * @param {string} text
 * @returns {{ date: string, mjd: number, x: number, y: number, z: number }[]}
 */
export function parseAamText(text) {
  const hourly = [];
  for (const line of text.split('\n')) {
    const m = line.match(DATA_LINE);
    if (!m) continue;
    const [, y, mo, d, , mjd, mx, my, mz, ox, oy, oz] = m;
    hourly.push({
      date: `${y}-${mo}-${d}`,
      mjd: parseFloat(mjd),
      x: parseFloat(mx) + parseFloat(ox),
      y: parseFloat(my) + parseFloat(oy),
      z: parseFloat(mz) + parseFloat(oz),
    });
  }
  return hourly;
}

/**
 * Average 3-hourly AAM rows into daily means.
 * @param {{ date: string, mjd: number, x: number, y: number, z: number }[]} hourly
 * @returns {{ date: string, mjd: number, aam_x: number, aam_y: number, aam_z: number }[]}
 */
export function aggregateDaily(hourly) {
  const byDate = new Map();
  for (const row of hourly) {
    let agg = byDate.get(row.date);
    if (!agg) {
      agg = { mjd: row.mjd, sx: 0, sy: 0, sz: 0, n: 0 };
      byDate.set(row.date, agg);
    }
    agg.sx += row.x;
    agg.sy += row.y;
    agg.sz += row.z;
    agg.n += 1;
    agg.mjd = row.mjd;
  }
  return [...byDate.entries()].map(([date, agg]) => ({
    date,
    mjd: agg.mjd,
    aam_x: agg.sx / agg.n,
    aam_y: agg.sy / agg.n,
    aam_z: agg.sz / agg.n,
  }));
}
