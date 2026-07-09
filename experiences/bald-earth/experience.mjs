/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'bald-earth',
  title: 'Bald Earth',
  railLabel: 'Bald',
  tagline: 'Naked globe — sphere, textures, atmosphere, sun. No data layers.',
  /**
   * Empty layers map → experienceToPreset forces every catalog key off.
   * Use this experience to author the base planetary body without overlay noise.
   */
  layers: {},
  /** Only the studio panel — every other sidebar panel is hidden. */
  panels: ['bald-studio'],
  hideAllPanels: false,
  showAllPanels: false,
  showAllLayers: false,
  /** Strip spin-axis chrome, trail, and pole so only the body remains. */
  bareGlobe: true,
  defaultView: 'geocentric',
  globeOpacity: 1,
  hemisphereCull: false,
  freshnessKeys: [],
  suggestedMoments: [],
};
