/**
 * Experience catalog contract — every theme must resolve layer keys that
 * exist in the UI catalog so themes cannot silently no-op toggles.
 */
import { describe, expect, it } from 'vitest';
import { discoverExperiences } from '../../experiences/registry.mjs';
import { LEGACY_LAYER_UI } from '../../src/layers/legacy-ui.mjs';
import { allLayerUi } from '../../src/layers/ui-registry.mjs';
import { experienceToPreset } from '../../src/experiences/controller.mjs';

const REQUIRED_EXPERIENCE_IDS = [
  'bald-earth',
  'solid-earth',
  'ocean-climate',
  'magnetosphere',
  'earth-spin',
  'orbital',
  'full-instrument',
];

describe('experience manifests', () => {
  it('discovers all guided experiences including bald-earth', async () => {
    const list = await discoverExperiences();
    const ids = list.map((e) => e.id).sort();
    expect(ids).toEqual([...REQUIRED_EXPERIENCE_IDS].sort());
  });

  it('each experience has id, title, layers or showAllLayers, panels', async () => {
    const list = await discoverExperiences();
    for (const exp of list) {
      expect(exp.id).toBeTruthy();
      expect(exp.title).toBeTruthy();
      expect(exp.tagline).toBeTruthy();
      if (!exp.showAllLayers && !exp.bareGlobe) {
        expect(exp.layers).toBeTypeOf('object');
        expect(Object.keys(exp.layers).length).toBeGreaterThan(0);
      }
      if (!exp.showAllPanels && !exp.hideAllPanels) {
        expect(Array.isArray(exp.panels)).toBe(true);
      }
    }
  });

  it('experience layer keys ⊆ catalog keys (legacy + registry)', async () => {
    const catalogKeys = new Set(allLayerUi().map((l) => l.key));
    // legacy keys are the baseline experience vocabulary
    for (const layer of LEGACY_LAYER_UI) {
      expect(catalogKeys.has(layer.key)).toBe(true);
    }

    const list = await discoverExperiences();
    for (const exp of list) {
      if (exp.showAllLayers || !exp.layers) continue;
      for (const key of Object.keys(exp.layers)) {
        expect(catalogKeys.has(key), `${exp.id} unknown layer key: ${key}`).toBe(true);
      }
    }
  });

  it('experienceToPreset turns solid-earth into quakes on / weather off', async () => {
    const list = await discoverExperiences();
    const solid = list.find((e) => e.id === 'solid-earth');
    const preset = experienceToPreset(solid);
    expect(preset.quakes).toBe(true);
    expect(preset.volcanoes).toBe(true);
    expect(preset.weather).toBe(false);
    expect(preset.aurora).toBe(false);
  });

  it('full-instrument enables the full preset stack', async () => {
    const list = await discoverExperiences();
    const full = list.find((e) => e.id === 'full-instrument');
    const preset = experienceToPreset(full);
    // At least core lanes stay on in full mode
    expect(preset.quakes).toBe(true);
    expect(preset.volcanoes).toBe(true);
  });

  it('bald-earth forces every catalog layer off and keeps studio panel', async () => {
    const list = await discoverExperiences();
    const bald = list.find((e) => e.id === 'bald-earth');
    expect(bald).toBeTruthy();
    expect(bald.bareGlobe).toBe(true);
    expect(bald.panels).toContain('bald-studio');
    const preset = experienceToPreset(bald);
    for (const layer of allLayerUi()) {
      expect(preset[layer.key], `bald-earth should hide ${layer.key}`).toBe(false);
    }
  });
});

