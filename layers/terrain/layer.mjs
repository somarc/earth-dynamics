import { initTerrainGlobe, setTerrainVisible, getTerrainAbout } from './globe.mjs';

/** @type {import('../types.d.ts').LayerManifest} */
export default {
  id: 'terrain',
  kind: 'derived-runtime',
  name: 'Terrain (Real Topo)',
  epistemic: 'measured',
  order: 4,

  globe: {
    defaultVisible: false,
    toggleId: 'show-terrain',
    legacyKey: 'terrain',
    parent: 'surface',
    async init(ctx) {
      return initTerrainGlobe(ctx);
    },
    setTerrainVisible,
    // Allow external reload e.g. scene.layerControllers.get('terrain')?.invokeGlobe('load', {center})
    async load(group, opts) {
      if (group?.userData?.load) {
        return group.userData.load(opts);
      }
    },
    pickTypes: [],
    legend: {
      id: 'terrain',
      class: 'terrain',
      label: 'Terrain',
      title: 'Real topographic mesh (live DEM)',
      help: 'Live 3D terrain mesh using real Earth elevation from AWS Terrain Tiles (Terrarium). Same data/technique as kaolti/monolith-terrain. Toggle + fly Home for best view.',
    },
  },

  ui: {
    group: 'solid',
    chipLabel: 'Terrain',
    chipId: 'chip-terrain',
    chipBadge: '3D',
    title: 'Real Earth topo (DEM) — 3D relief from AWS Terrain Tiles (monolith-terrain data source). Best with Home fly or zoom.',
  },

  presets: {
    solid: true,
    space: false,
    orbital: false,
    full: true,
    atmosphere: false,
  },
};
