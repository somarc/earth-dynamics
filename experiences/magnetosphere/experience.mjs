/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'magnetosphere',
  title: 'Magnetosphere',
  railLabel: 'Mag',
  tagline: 'Dynamo → space weather coupling',
  layers: {
    quakes: false,
    volcanoes: false,
    plates: false,
    plateMotion: false,
    weather: false,
    cyclones: false,
    fieldLines: true,
    aurora: true,
    oceanTempGrid: false,
    bodies: false,
    spinPole: false,
    trail: false,
  },
  panels: ['space-weather', 'inspect'],
  hiddenPanels: ['polhode', 'rotation', 'orbital-split', 'lunar', 'ocean-sst', 'events', 'citations'],
  defaultView: 'geocentric',
  freshnessKeys: ['noaaSwpc', 'omni', 'nasaDonki'],
  suggestedMoments: [
    { date: '2003-10-29', label: 'Halloween 2003 storms', connectorRefs: ['omni', 'nasaDonki'] },
  ],
};