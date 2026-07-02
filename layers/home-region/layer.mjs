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

  ui: {
    placement: 'globe-appearance',
    toggles: [
      {
        id: 'home-detail',
        toggleId: 'show-home-detail',
        chipId: 'chip-home-detail',
        chipLabel: 'Detail',
        legacyKey: 'homeDetail',
        title: 'High-resolution regional imagery where you live — global shell dims only when Home focus is active',
        defaultVisible: false,
      },
      {
        id: 'home-terrain',
        toggleId: 'show-home-terrain',
        chipId: 'chip-home-terrain',
        chipLabel: 'Terrain',
        legacyKey: 'homeTerrain',
        title: 'Cross-border LiDAR hillshade — Canada HRDEM + US 3DEP fused at the border',
        defaultVisible: true,
      },
    ],
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