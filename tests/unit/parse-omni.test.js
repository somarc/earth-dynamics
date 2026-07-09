import { describe, expect, it } from 'vitest';
import {
  aggregateDaily,
  doyToDate,
  isFill,
  parseOmniLine,
} from '../../ingest/lib/parse-omni.mjs';

/**
 * Build a synthetic OMNI2 line with ≥42 whitespace-separated fields.
 * Indices used by the parser: year@0, doy@1, hour@2, bz@16, density@23, speed@24, dst@40.
 */
function omniLine({
  year = 2020,
  doy = 1,
  hour = 0,
  bz = -5.2,
  density = 4.1,
  speed = 420,
  dst = -30,
} = {}) {
  const parts = new Array(42).fill('0');
  parts[0] = String(year);
  parts[1] = String(doy);
  parts[2] = String(hour);
  parts[16] = String(bz);
  parts[23] = String(density);
  parts[24] = String(speed);
  parts[40] = String(dst);
  return parts.join(' ');
}

describe('isFill', () => {
  it('flags OMNI fill sentinels and NaN', () => {
    expect(isFill(9999)).toBe(true);
    expect(isFill(99999.99)).toBe(true);
    expect(isFill(999999.99)).toBe(true);
    expect(isFill(NaN)).toBe(true);
    expect(isFill(null)).toBe(true);
    expect(isFill(-30)).toBe(false);
    expect(isFill(4.5)).toBe(false);
  });
});

describe('parseOmniLine', () => {
  it('parses year/doy/hour and plasma/IMF/Dst fields', () => {
    const row = parseOmniLine(omniLine());
    expect(row).toEqual({
      year: 2020,
      doy: 1,
      hour: 0,
      bz: -5.2,
      density: 4.1,
      speed: 420,
      dst: -30,
    });
  });

  it('nulls fill values recognized by isFill', () => {
    // Sentinels that match FILL exactly or via Math.round (production behavior).
    const row = parseOmniLine(
      omniLine({ bz: 9999, density: 999, speed: 9999, dst: 99999 }),
    );
    expect(row.bz).toBeNull();
    expect(row.density).toBeNull();
    expect(row.speed).toBeNull();
    expect(row.dst).toBeNull();
  });

  it('rejects short lines, bad hour, or missing year/doy', () => {
    expect(parseOmniLine('2020 1 0 too short')).toBeNull();
    expect(parseOmniLine(omniLine({ hour: 24 }))).toBeNull();
    expect(parseOmniLine(omniLine({ year: 0 }))).toBeNull();
    expect(parseOmniLine(omniLine({ doy: 0 }))).toBeNull();
  });
});

describe('doyToDate', () => {
  it('maps day-of-year to ISO date', () => {
    expect(doyToDate(2020, 1)).toBe('2020-01-01');
    expect(doyToDate(2020, 32)).toBe('2020-02-01'); // leap year
    expect(doyToDate(2021, 32)).toBe('2021-02-01');
    expect(doyToDate(2020, 366)).toBe('2020-12-31');
  });
});

describe('aggregateDaily', () => {
  it('mins Dst/Bz and averages speed/density per date', () => {
    const hourly = [
      parseOmniLine(omniLine({ doy: 1, hour: 0, dst: -10, bz: -2, speed: 400, density: 4 })),
      parseOmniLine(omniLine({ doy: 1, hour: 12, dst: -50, bz: -8, speed: 500, density: 6 })),
      parseOmniLine(omniLine({ doy: 2, hour: 0, dst: -5, bz: 1, speed: 350, density: 3 })),
    ];
    const daily = aggregateDaily(hourly);
    expect(daily).toHaveLength(2);

    const d1 = daily.find((r) => r.date === '2020-01-01');
    expect(d1.dstMin).toBe(-50);
    expect(d1.bzMin).toBe(-8);
    expect(d1.speed).toBeCloseTo(450);
    expect(d1.density).toBeCloseTo(5);

    const d2 = daily.find((r) => r.date === '2020-01-02');
    expect(d2.dstMin).toBe(-5);
    expect(d2.speed).toBeCloseTo(350);
  });

  it('keeps nulls when all hourly values are missing', () => {
    const hourly = [
      {
        year: 2020,
        doy: 10,
        dst: null,
        speed: null,
        bz: null,
        density: null,
      },
    ];
    expect(aggregateDaily(hourly)).toEqual([
      {
        date: '2020-01-10',
        dstMin: null,
        speed: null,
        bzMin: null,
        density: null,
      },
    ]);
  });
});
