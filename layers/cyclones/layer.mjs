import { GLOBE_ABOUT } from '../../src/globe-inspect.js';
import { contributeCyclonesToDay } from './snapshot.mjs';
import { buildCycloneGroup } from './globe.mjs';

/** @type {import('../types.d.ts').LayerManifest} */
export default {
  id: 'cyclones',
  kind: 'ingested-timeseries',
  name: 'Tropical Cyclones (IBTrACS)',
  epistemic: 'measured',
  sourceKey: 'ibtracs',
  order: 40,
  ingestKey: 'ibtracs',
  ingestAliases: ['cyclones', 'ibtracs'],
  schema: 'cyclone_storms',

  contributeToDaySnapshot(db, date, opts) {
    return { cyclones: contributeCyclonesToDay(db, date, opts) };
  },

  routes: [],

  globe: {
    defaultVisible: true,
    toggleId: 'show-cyclones',
    legacyKey: 'cyclones',
    parent: 'surface',
    dynamic: true,
    async init() {
      return null;
    },
    update(group, storms, viewDate, ctx) {
      group.clear();
      if (!ctx.visible || !storms?.length) {
        group.visible = false;
        return;
      }
      group.add(buildCycloneGroup(storms, viewDate));
      group.visible = true;
    },
    pickTypes: ['cyclone'],
    legend: {
      id: 'cyclone',
      class: 'cyclone',
      label: '〰 Cyclone',
      title: 'IBTrACS tropical cyclones',
      help: GLOBE_ABOUT.cyclone,
    },
  },

  presets: {
    solid: false,
    space: false,
    orbital: false,
    full: true,
    atmosphere: true,
  },

  ui: {
    group: 'atmos',
    chipId: 'chip-cyclones',
    chipLabel: 'Cyclones',
    countKey: 'cyclones',
    title: 'IBTrACS cyclone tracks in date window',
  },
};