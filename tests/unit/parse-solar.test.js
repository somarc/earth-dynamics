import { describe, expect, it } from 'vitest';
import {
  expandMonthlyToDaily,
  parseKpJson,
  parseSpotNum,
} from '../../ingest/lib/parse-solar.mjs';

describe('parseSpotNum', () => {
  const sample = `
# NASA MSFC sunspot numbers
YEAR  MON  SSN
1961  12   50.0
1962   1   12.5
1962   2   20.0
1990  06  140.2
not enough
  `;

  it('parses monthly SSN and skips pre-minYear rows', () => {
    const rows = parseSpotNum(sample);
    expect(rows).toEqual([
      { year: 1962, month: 1, ssn: 12.5 },
      { year: 1962, month: 2, ssn: 20 },
      { year: 1990, month: 6, ssn: 140.2 },
    ]);
  });

  it('respects custom minYear', () => {
    expect(parseSpotNum(sample, { minYear: 1990 })).toEqual([
      { year: 1990, month: 6, ssn: 140.2 },
    ]);
  });

  it('ignores header and blank lines', () => {
    expect(parseSpotNum('YEAR MON SSN\n\n# hi\n').length).toBe(0);
  });
});

describe('expandMonthlyToDaily', () => {
  it('replicates monthly SSN across calendar days up to maxDate', () => {
    const daily = expandMonthlyToDaily(
      [{ year: 2024, month: 2, ssn: 99 }],
      '2024-02-03',
    );
    expect(daily).toEqual([
      { date: '2024-02-01', sunspot_number: 99 },
      { date: '2024-02-02', sunspot_number: 99 },
      { date: '2024-02-03', sunspot_number: 99 },
    ]);
  });

  it('includes full February non-leap month when maxDate is late enough', () => {
    const daily = expandMonthlyToDaily(
      [{ year: 2023, month: 2, ssn: 1 }],
      '2023-03-01',
    );
    expect(daily).toHaveLength(28);
    expect(daily[0].date).toBe('2023-02-01');
    expect(daily[27].date).toBe('2023-02-28');
  });
});

describe('parseKpJson', () => {
  it('aggregates multi-slot Kp into daily max and avg', () => {
    const data = [
      ['time_tag', 'Kp'],
      ['2024-05-10 00:00:00', '3'],
      ['2024-05-10 03:00:00', '5'],
      ['2024-05-11 00:00:00', '2'],
    ];
    const byDate = parseKpJson(data);
    expect(byDate.get('2024-05-10')).toEqual({ kp_max: 5, kp_avg: 4 });
    expect(byDate.get('2024-05-11')).toEqual({ kp_max: 2, kp_avg: 2 });
  });

  it('returns empty Map for non-array or header-only', () => {
    expect(parseKpJson(null).size).toBe(0);
    expect(parseKpJson([['time_tag', 'Kp']]).size).toBe(0);
  });

  it('skips non-finite Kp values', () => {
    const data = [
      ['time_tag', 'Kp'],
      ['2024-01-01 00:00:00', 'n/a'],
      ['2024-01-01 03:00:00', '4'],
    ];
    expect(parseKpJson(data).get('2024-01-01')).toEqual({ kp_max: 4, kp_avg: 4 });
  });
});
