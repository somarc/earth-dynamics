/**
 * Layer manifest template — copy to layers/<your-id>/layer.mjs
 * @type {import('../types.d.ts').LayerManifest}
 */
export default {
  id: '__template__',
  kind: 'static-reference', // or ingested-timeseries | derived-runtime | regional-imagery
  name: 'Human-readable name',
  epistemic: 'measured',
  sourceKey: 'keyInIngestConstants',
  order: 100,

  // ingested-timeseries only:
  ingest: null,
  schema: null,
  ingestKey: 'your-layer-id',
  contributeToDaySnapshot: null,
  routes: [],

  // static-reference only:
  static: {
    url: '/data/your-layer.json',
    load: async () => {
      const res = await fetch('/data/your-layer.json');
      if (!res.ok) throw new Error(`your-layer ${res.status}`);
      return res.json();
    },
  },

  globe: {
    defaultVisible: true,
    toggleId: 'show-your-layer',
    legacyKey: 'yourLayer',
    parent: 'surface',
    async init(ctx) {
      // return THREE.Group
      return null;
    },
    pickTypes: [],
    legend: {
      id: 'your-layer',
      class: 'your-layer',
      label: '◎ Layer',
      title: 'Your layer',
      help: 'Description for legend tooltip.',
    },
  },

  presets: {
    solid: false,
    space: false,
    orbital: false,
    full: true,
    atmosphere: false,
  },
};