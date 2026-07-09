import { describe, expect, it } from 'vitest';
import {
  mergeMonthly,
  parseAtlTropics,
  parseErsstNino,
  parseOni,
  ymKey,
} from '../../layers/ocean-sst/parse.mjs';

describe('ymKey', () => {
  it('zero-pads month', () => {
    expect(ymKey(2024, 5)).toBe('2024-05');
    expect(ymKey(1990, 12)).toBe('1990-12');
  });
});

describe('parseErsstNino', () => {
  // Columns: YR MO NINO1+2 ANOM NINO3 ANOM NINO4 ANOM NINO3.4 ANOM
  const sample = `
YR   MO    NINO1+2  ANOM   NINO3    ANOM   NINO4    ANOM   NINO3.4  ANOM
2024   1   25.00   0.10   26.00   -0.20   28.50    0.30   27.00   -0.50
2024   2   25.10   0.15   26.10   -0.10   28.40    0.20   27.10   -0.40
not a data line
  `;

  it('parses anomaly columns into Map keyed by ym', () => {
    const rows = parseErsstNino(sample);
    expect(rows.size).toBe(2);
    expect(rows.get('2024-01')).toEqual({
      ym: '2024-01',
      nino12_anom_c: 0.1,
      nino3_anom_c: -0.2,
      nino4_anom_c: 0.3,
      nino34_anom_c: -0.5,
    });
    expect(rows.get('2024-02').nino34_anom_c).toBeCloseTo(-0.4);
  });

  it('returns empty Map for blank input', () => {
    expect(parseErsstNino('').size).toBe(0);
    expect(parseErsstNino('YR MO junk\n').size).toBe(0);
  });
});

describe('parseAtlTropics', () => {
  // Columns: YR MO NATL ANOM SATL ANOM TROP ANOM
  const sample = `
YR MO NATL ANOM SATL ANOM TROP ANOM
2023  6  27.0  0.5  26.0 -0.1  27.5  0.2
2023  7  27.1  0.6  26.1  0.0  27.6  0.3
  `;

  it('parses NATL/SATL/TROP anomalies', () => {
    const rows = parseAtlTropics(sample);
    expect(rows.get('2023-06')).toEqual({
      global_tropics_anom_c: 0.2,
      north_atlantic_anom_c: 0.5,
      south_atlantic_anom_c: -0.1,
    });
    expect(rows.get('2023-07').north_atlantic_anom_c).toBeCloseTo(0.6);
  });
});

describe('parseOni', () => {
  const sample = `
SEAS  YR   TOTAL  ANOM
DJF  2023  26.45  -0.72
JFM  2023  26.80  -0.40
# comment
  `;

  it('parses seasonal ONI rows', () => {
    const rows = parseOni(sample);
    expect(rows).toEqual([
      { season: 'DJF', year: 2023, sst_total_c: 26.45, anomaly_c: -0.72 },
      { season: 'JFM', year: 2023, sst_total_c: 26.8, anomaly_c: -0.4 },
    ]);
  });
});

describe('mergeMonthly', () => {
  it('outer-joins by ym and fills nulls for missing sides', () => {
    const ersst = new Map([
      ['2024-01', {
        ym: '2024-01',
        nino12_anom_c: 0.1,
        nino3_anom_c: 0.2,
        nino34_anom_c: 0.3,
        nino4_anom_c: 0.4,
      }],
    ]);
    const atl = new Map([
      ['2024-01', {
        global_tropics_anom_c: 0.5,
        north_atlantic_anom_c: 0.6,
        south_atlantic_anom_c: 0.7,
      }],
      ['2024-02', {
        global_tropics_anom_c: 1.0,
        north_atlantic_anom_c: 1.1,
        south_atlantic_anom_c: 1.2,
      }],
    ]);
    const merged = mergeMonthly(ersst, atl);
    expect(merged.map((r) => r.ym)).toEqual(['2024-01', '2024-02']);
    expect(merged[0].nino34_anom_c).toBe(0.3);
    expect(merged[0].north_atlantic_anom_c).toBe(0.6);
    expect(merged[1].nino34_anom_c).toBeNull();
    expect(merged[1].global_tropics_anom_c).toBe(1.0);
  });
});
