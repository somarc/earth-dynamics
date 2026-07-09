import { describe, expect, it } from 'vitest';
import {
  clampEarthOpacity,
  formatEarthOpacityLabel,
  formatPlaybackRate,
} from '../../src/lib/playback-format.js';

describe('formatPlaybackRate', () => {
  it('formats minute-scale sim days', () => {
    expect(formatPlaybackRate(60_000, 1)).toBe('1.0m/sim day');
    expect(formatPlaybackRate(60_000, 2)).toBe('30s/sim day');
  });

  it('formats hour and day scales', () => {
    expect(formatPlaybackRate(3_600_000, 1)).toBe('1.0h/sim day');
    expect(formatPlaybackRate(86_400_000, 1)).toBe('1.0d/sim day');
  });
});

describe('earth opacity labels', () => {
  it('clamps to readable range', () => {
    expect(clampEarthOpacity(0.1)).toBe(0.65);
    expect(clampEarthOpacity(1.5)).toBe(1);
    expect(clampEarthOpacity(0.9)).toBe(0.9);
  });

  it('labels solid / readable / depth bands', () => {
    expect(formatEarthOpacityLabel(1)).toBe('Solid');
    expect(formatEarthOpacityLabel(0.85)).toBe('Readable 85%');
    expect(formatEarthOpacityLabel(0.65)).toBe('Depth 65%');
  });
});
