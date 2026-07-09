/**
 * Ephemeris window → chart shape used by data-client when timeline
 * extends past the last ingested ephemeris row.
 */
import { describe, expect, it } from 'vitest';
import { ephWindowToChart } from '../../src/data-client.js';

describe('ephWindowToChart fallback inject', () => {
  it('injects day.ephemeris when scrub date is past window end', () => {
    const window = [
      { date: '2024-05-10', moon: { x: 1 } },
      { date: '2024-05-11', moon: { x: 2 } },
    ];
    const day = { moon: { x: 3 }, lunar: { phaseName: 'Full' } };
    const chart = ephWindowToChart(window, '2024-05-20', day);
    expect(chart.dates).toContain('2024-05-20');
    expect(chart.byDate['2024-05-20']._ephemerisAsOf).toBe('2024-05-11');
    expect(chart.byDate['2024-05-20'].moon.x).toBe(3);
  });

  it('does not duplicate when selected date already in window', () => {
    const window = [{ date: '2024-05-11', moon: { x: 2 } }];
    const chart = ephWindowToChart(window, '2024-05-11', { moon: { x: 9 } });
    expect(chart.dates.filter((d) => d === '2024-05-11')).toHaveLength(1);
    expect(chart.byDate['2024-05-11'].moon.x).toBe(2);
  });
});
