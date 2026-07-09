import { describe, expect, it } from 'vitest';
import { aggregateDaily, parseAamText } from '../../ingest/lib/parse-aam.mjs';

// GFZ line: YYYY MM DD HH MJD χ_mass γ_mass χ_motion γ_motion z_mass z_motion
// (parser sums mass + motion for x,y,z)
const sample = `
# ESMGFZ AAM v1.0
2020 01 01 00 58849.000 0.10 0.20 0.30 0.01 0.02 0.03
2020 01 01 03 58849.125 0.20 0.30 0.40 0.02 0.03 0.04
2020 01 02 00 58850.000 -0.10 -0.20 -0.30 0.00 0.00 0.00
junk line without enough fields
`;

describe('parseAamText', () => {
  it('parses data lines and sums mass + motion components', () => {
    const hourly = parseAamText(sample);
    expect(hourly).toHaveLength(3);
    expect(hourly[0].date).toBe('2020-01-01');
    expect(hourly[0].mjd).toBe(58849);
    expect(hourly[0].x).toBeCloseTo(0.11); // 0.10 + 0.01
    expect(hourly[0].y).toBeCloseTo(0.22); // 0.20 + 0.02
    expect(hourly[0].z).toBeCloseTo(0.33); // 0.30 + 0.03
    expect(hourly[1].x).toBeCloseTo(0.22);
    expect(hourly[2].date).toBe('2020-01-02');
    expect(hourly[2].mjd).toBe(58850);
    expect(hourly[2].x).toBeCloseTo(-0.1);
    expect(hourly[2].y).toBeCloseTo(-0.2);
    expect(hourly[2].z).toBeCloseTo(-0.3);
  });

  it('returns empty array for non-matching input', () => {
    expect(parseAamText('# only comments\n').length).toBe(0);
  });
});

describe('aggregateDaily', () => {
  it('averages multi-hour rows per date and keeps last mjd', () => {
    const hourly = parseAamText(sample);
    const daily = aggregateDaily(hourly);
    expect(daily).toHaveLength(2);

    const d1 = daily.find((r) => r.date === '2020-01-01');
    expect(d1.mjd).toBeCloseTo(58849.125);
    expect(d1.aam_x).toBeCloseTo((0.11 + 0.22) / 2);
    expect(d1.aam_y).toBeCloseTo((0.22 + 0.33) / 2);
    expect(d1.aam_z).toBeCloseTo((0.33 + 0.44) / 2);

    const d2 = daily.find((r) => r.date === '2020-01-02');
    expect(d2.aam_x).toBeCloseTo(-0.1);
    expect(d2.aam_y).toBeCloseTo(-0.2);
    expect(d2.aam_z).toBeCloseTo(-0.3);
  });
});
