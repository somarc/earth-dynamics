/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'earth-spin',
  title: "Earth's Spin",
  railLabel: 'Spin',
  tagline: 'Rotation is not constant — pole wander, LOD, AAM',
  layers: {
    quakes: false,
    volcanoes: false,
    plates: false,
    plateMotion: false,
    weather: false,
    cyclones: false,
    fieldLines: false,
    aurora: false,
    oceanTempGrid: false,
    bodies: false,
    spinPole: true,
    trail: true,
  },
  panels: ['polhode', 'rotation'],
  hiddenPanels: ['orbital-split', 'lunar', 'space-weather', 'ocean-sst', 'inspect', 'events', 'citations'],
  defaultView: 'geocentric',
  freshnessKeys: ['iersEop', 'gfzAam'],
  suggestedMoments: [
    { date: '2024-05-11', label: 'LOD + AAM coupling example', connectorRefs: ['gfzAam', 'iersEop'] },
  ],
};