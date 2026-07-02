import {
  initHomeRegionGlobe,
  updateHomeRegionSun,
  setHomeRegionTerrainVisible,
} from './globe.mjs';

/** @type {import('../types.d.ts').LayerManifest} */
export default {
  id: 'home-region',
  kind: 'regional-imagery',
  name: 'Home Region (Eastern Ontario)',
  epistemic: 'derived',
  sourceKey: 'gibsHomeRegion',
  order: 5,
  ingestKey: 'home-region',
  ingestAliases: ['home', 'home-region'],
  schema: 'home_regions',

  routes: [],

  globe: {
    defaultVisible: false,
    parent: 'surface',
    async init(ctx) {
      return initHomeRegionGlobe(ctx);
    },
    updateSun(group, sunDirection) {
      updateHomeRegionSun(group, sunDirection);
    },
    setTerrainVisible(group, visible) {
      const hasTerrain = !!group?.userData?.config?.terrain;
      setHomeRegionTerrainVisible(group, visible, hasTerrain);
    },
    pickTypes: ['home-region'],
  },

  ui: {
    placement: 'globe-appearance',
    actionId: 'fly-home-btn',
  },

  presets: {
    solid: false,
    space: false,
    orbital: false,
    full: false,
    atmosphere: false,
  },

  regional: {
    flyButtonId: 'fly-home-btn',
    configPath: '/data/home-region.json',
    apiPath: '/api/home',
  },
};