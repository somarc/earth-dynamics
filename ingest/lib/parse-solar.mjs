/**
 * Pure parsers for solar ingest inputs
 * (NASA MSFC spot_num.txt monthly SSN + NOAA SWPC planetary K-index JSON).
 */

/**
 * Parse NASA MSFC monthly sunspot number ASCII.
 * @param {string} text
 * @param {{ minYear?: number }} [opts]
 * @returns {{ year: number, month: number, ssn: number }[]}
 */
export function parseSpotNum(text, { minYear = 1962 } = {}) {
  const monthly = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('YEAR') || line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const ssn = parseFloat(parts[2]);
    if (year >= minYear && Number.isFinite(ssn)) monthly.push({ year, month, ssn });
  }
  return monthly;
}

/**
 * Expand monthly SSN rows into per-day records up to maxDate (YYYY-MM-DD).
 * @param {{ year: number, month: number, ssn: number }[]} monthly
 * @param {string} [maxDate] ISO date inclusive upper bound (default: today UTC)
 * @returns {{ date: string, sunspot_number: number }[]}
 */
export function expandMonthlyToDaily(monthly, maxDate = new Date().toISOString().slice(0, 10)) {
  const rows = [];
  for (const { year, month, ssn } of monthly) {
    const daysInMonth = new Date(year, month, 0).getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      if (date > maxDate) continue;
      rows.push({ date, sunspot_number: ssn });
    }
  }
  return rows;
}

/**
 * Parse NOAA SWPC planetary K-index JSON array (header row + data rows).
 * @param {unknown[]} kpData
 * @returns {Map<string, { kp_max: number, kp_avg: number }>}
 */
export function parseKpJson(kpData) {
  const kpByDate = new Map();
  if (!Array.isArray(kpData)) return kpByDate;

  for (let i = 1; i < kpData.length; i++) {
    const row = kpData[i];
    if (!Array.isArray(row) || row.length < 2) continue;
    const [time, kp] = row;
    if (typeof time !== 'string') continue;
    const date = time.slice(0, 10);
    const val = parseFloat(kp);
    if (!Number.isFinite(val)) continue;
    if (!kpByDate.has(date)) kpByDate.set(date, []);
    kpByDate.get(date).push(val);
  }

  const out = new Map();
  for (const [date, vals] of kpByDate) {
    out.set(date, {
      kp_max: Math.max(...vals),
      kp_avg: vals.reduce((a, b) => a + b, 0) / vals.length,
    });
  }
  return out;
}
