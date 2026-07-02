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