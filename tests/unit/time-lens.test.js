import { describe, expect, it } from 'vitest';
import {
  DEFAULT_TIME_LENS,
  emptyEventsMessage,
  eventsTitleForLens,
  formatLensRange,
  getTimeLens,
  lensToPastDays,
  normalizePastDays,
} from '../../src/lib/time-lens.js';
import { addDays } from '../../src/utils.js';

describe('time lens', () => {
  it('defaults to week', () => {
    expect(DEFAULT_TIME_LENS).toBe('week');
    expect(lensToPastDays('week')).toBe(7);
    expect(lensToPastDays('unknown')).toBe(7);
  });

  it('maps lenses to trailing day counts', () => {
    expect(lensToPastDays('day')).toBe(1);
    expect(lensToPastDays('month')).toBe(30);
    expect(lensToPastDays('season')).toBe(90);
    expect(lensToPastDays('year')).toBe(365);
    expect(lensToPastDays('decade')).toBe(3650);
  });

  it('normalizePastDays defaults and caps', () => {
    expect(normalizePastDays(null)).toBe(7);
    expect(normalizePastDays(0)).toBe(7);
    expect(normalizePastDays(14)).toBe(14);
    expect(normalizePastDays(99999)).toBe(3650);
  });

  it('formats human range and titles', () => {
    expect(eventsTitleForLens('week')).toMatch(/week/i);
    expect(formatLensRange('2024-05-11', 'week', { addDaysFn: addDays })).toBe(
      '2024-05-04 → 2024-05-11',
    );
    expect(emptyEventsMessage('month', { quakeMinMag: 6 })).toMatch(/month/);
    expect(emptyEventsMessage('month', { quakeMinMag: 6 })).toMatch(/M≥6/);
  });

  it('getTimeLens returns short labels for footer', () => {
    expect(getTimeLens('season').short).toBe('90d');
  });
});
