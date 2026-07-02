import { GLOBE_ABOUT } from '../../src/globe-inspect.js';
import { buildHotspotGroup, loadHotspots } from './globe.mjs';

/** @type {import('../types.d.ts').LayerManifest} */
export default {
  id: 'hotspots',
  kind: 'static-reference',
  name: 'Mantle Hotspots',
  epistemic: 'pedagogical',
  sourceKey: 'mantleHotspots',
  order: 30,

  ingest: null,
  schema: null,
  contributeToDaySnapshot: null,
  routes: [],

  static: {
    url: '/data/hotspots.json',
    load: loadHotspots,
  },

  globe: {
    defaultVisible: true,
    toggleId: 'show-hotspots',
    legacyKey: 'hotspots',
    parent: 'surface',
    async init({ EARTH_RADIUS }) {
      const data = await loadHotspots();
      const radius = EARTH_RADIUS * 1.017;
      const group = buildHotspotGroup(data, radius);
      group.userData.about = data.about ?? null;
      return group;
    },
    pickTypes: ['hotspot'],
    legend: {
      id: 'hotspot',
      class: 'hotspot',
      label: '◎ Hotspot',
      title: 'Mantle hotspots',
      help: GLOBE_ABOUT.hotspot,
    },
  },

  presets: {
    solid: true,
    space: false,
    orbital: false,
    full: true,
    atmosphere: false,
  },

  ui: {
    group: 'solid',
    chipLabel: 'Hotspots',
    title: 'Mantle hotspots',
  },
};