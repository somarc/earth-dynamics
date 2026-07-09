import { describe, expect, it } from 'vitest';
import { discoverLayers } from '../../layers/registry.mjs';
import { LAYERS, GLOBE_LAYERS } from '../../src/layers/registry.mjs';

describe('layer registries', () => {
  it('Node discoverLayers finds plugin packs', async () => {
    const layers = await discoverLayers({ reload: true });
    const ids = layers.map((l) => l.id).sort();
    expect(ids).toEqual(
      expect.arrayContaining(['hotspots', 'cyclones', 'ocean-sst', 'home-region', 'terrain']),
    );
  });

  it('browser registry mirrors plugin ids with globe hooks', () => {
    const ids = LAYERS.map((l) => l.id);
    expect(ids).toEqual(
      expect.arrayContaining(['hotspots', 'cyclones', 'home-region', 'terrain']),
    );
    for (const layer of GLOBE_LAYERS) {
      expect(layer.globe).toBeTruthy();
      expect(layer.id).toBeTruthy();
      expect(layer.epistemic).toBeTruthy();
    }
  });

  it('snapshot contributors declare contributeToDaySnapshot', async () => {
    const layers = await discoverLayers({ reload: true });
    const withSnap = layers.filter((l) => typeof l.contributeToDaySnapshot === 'function');
    expect(withSnap.map((l) => l.id).sort()).toEqual(
      expect.arrayContaining(['cyclones', 'ocean-sst']),
    );
  });
});
