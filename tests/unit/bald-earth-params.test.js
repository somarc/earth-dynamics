import { describe, expect, it } from 'vitest';
import {
  BALD_EARTH_DEFAULTS,
  SURFACE_MODELS,
  isLitMap,
  normalizeBaldEarthParams,
  surfaceLiftFromOpacity,
} from '../../src/lib/bald-earth-params.js';

describe('bald-earth params', () => {
  it('normalizes defaults', () => {
    const p = normalizeBaldEarthParams({});
    expect(p.surfaceOpacity).toBe(BALD_EARTH_DEFAULTS.surfaceOpacity);
    expect(p.atmosphereIntensity).toBe(1.2);
    expect(p.diurnalMode).toBe('free');
    expect(p.surfaceModel).toBe(SURFACE_MODELS.INSTRUMENT);
  });

  it('accepts lit-map surface model and lit knobs', () => {
    const p = normalizeBaldEarthParams({
      surfaceModel: 'lit-map',
      litRoughness: 0.5,
      nightLights: false,
      nightEmissive: 1.2,
      albedoBoost: 1.6,
    });
    expect(p.surfaceModel).toBe(SURFACE_MODELS.LIT_MAP);
    expect(isLitMap(p)).toBe(true);
    expect(p.litRoughness).toBe(0.5);
    expect(p.nightLights).toBe(false);
    expect(p.nightEmissive).toBe(1.2);
    expect(p.albedoBoost).toBe(1.6);
  });

  it('clamps out-of-range values', () => {
    const p = normalizeBaldEarthParams({
      surfaceOpacity: 9,
      exposure: 0.1,
      autoRotate: 99,
      ambient: -1,
    });
    expect(p.surfaceOpacity).toBe(1);
    expect(p.exposure).toBe(0.4);
    expect(p.autoRotate).toBe(0.05);
    expect(p.ambient).toBe(0);
  });

  it('maps opacity to surface lift like production', () => {
    expect(surfaceLiftFromOpacity(1)).toBeCloseTo(0.72, 5);
    expect(surfaceLiftFromOpacity(0.65)).toBeCloseTo(0.46 + 0.26 * 0.65, 5);
  });
});

