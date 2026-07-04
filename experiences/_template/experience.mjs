/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'my-experience',
  title: 'My Experience',
  tagline: 'One-line story for the theme rail',

  layers: {
    // Registry layer keys → visible
    // quakes: true,
    // cyclones: false,
  },

  panels: [],
  hiddenPanels: [],

  defaultView: 'geocentric',
  freshnessKeys: [],

  suggestedMoments: [
    // { date: 'YYYY-MM-DD', label: 'Historical anchor', connectorRefs: ['sourceKey'] },
  ],
};