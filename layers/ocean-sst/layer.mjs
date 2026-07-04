import { contributeOceanToDay } from './snapshot.mjs';

/** @type {import('../types.d.ts').LayerManifest} */
export default {
  id: 'ocean-sst',
  kind: 'chart-lane',
  name: 'Global Ocean SST (NOAA CPC)',
  epistemic: 'measured',
  sourceKey: 'noaaOceanSst',
  order: 55,
  ingestKey: 'ocean-sst',
  ingestAliases: ['ocean', 'enso', 'oni'],

  contributeToDaySnapshot(db, date) {
    return { ocean: contributeOceanToDay(db, date) };
  },

  routes: [],

  presets: {
    solid: false,
    space: false,
    orbital: false,
    full: false,
    atmosphere: true,
  },

  ui: {
    group: 'atmos',
    chipId: 'chip-ocean-sst',
    chipLabel: 'Ocean SST',
    countKey: null,
    title: 'NOAA CPC sea-surface temperature anomalies',
    hiddenUntilHelio: false,
  },
};