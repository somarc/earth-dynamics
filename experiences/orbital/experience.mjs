/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'orbital',
  title: 'Orbital Geometry',
  railLabel: 'Orbit',
  tagline: 'True-scale Moon & Sun — ecliptic, tides, and syzygy',
  /**
   * System geometry, not “you are here.” Distinct from Bald Earth (shell only)
   * and Live orientation (local solar face).
   */
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
    bodies: true,
    spinPole: false,
    trail: false,
    moon: true,
    cme: true,
  },
  panels: ['orbital-split', 'lunar'],
  hiddenPanels: ['polhode', 'rotation', 'space-weather', 'ocean-sst', 'inspect', 'events', 'citations'],
  /** Primary story is Earth around the Sun at true AU scale. */
  defaultView: 'heliocentric',
  /** Do not re-lock the globe to GPS Live — that reads as Bald Earth. */
  orientToUser: false,
  /** Scrub moments / phase; Live “now face” is the other product. */
  preferTimeMode: 'replay',
  /**
   * Per-view entry framing after ephemeris lands.
   * helio-sun-earth = over-Earth shoulder toward true-scale Sun
   * earth-moon = pull back to lunar orbit (~60 R⊕)
   */
  entryFrames: {
    heliocentric: 'helio-sun-earth',
    geocentric: 'earth-moon',
  },
  freshnessKeys: ['jplHorizons'],
  suggestedMoments: [
    { date: '2024-04-08', label: 'Total solar eclipse', connectorRefs: ['jplHorizons'] },
    { date: '2024-03-25', label: 'Penumbra / lunar season', connectorRefs: ['jplHorizons'] },
    { date: '2025-01-13', label: 'Near perigee full Moon', connectorRefs: ['jplHorizons'] },
  ],
};
