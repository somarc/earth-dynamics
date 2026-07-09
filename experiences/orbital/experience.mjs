/** @type {import('../types.d.ts').ExperienceManifest} */
export default {
  id: 'orbital',
  title: 'Orbital Geometry',
  railLabel: 'Orbit',
  tagline: 'True-scale Moon, ecliptic context, tides & syzygy',
  /**
   * GEO-first system geometry (not Bald “shell only”, not Live “you are here”).
   * Helio stays available as a manual switch — parked as a product surface until
   * solar-domain ingest (CME / spots / corona) justifies real investment.
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
  /** Product default is GEO; true-scale Moon orbit is the readable story today. */
  defaultView: 'geocentric',
  /** Do not re-lock to GPS Live face — that collapses Orbit into Bald/Live. */
  orientToUser: false,
  /** Scrub phases / distance / moments. */
  preferTimeMode: 'replay',
  entryFrames: {
    geocentric: 'earth-moon',
    // Helio only if the user opts in via the view chip — no forced landing.
    heliocentric: 'helio-sun-earth',
  },
  freshnessKeys: ['jplHorizons'],
  suggestedMoments: [
    { date: '2024-04-08', label: 'Total solar eclipse', connectorRefs: ['jplHorizons'] },
    { date: '2024-03-25', label: 'Penumbra / lunar season', connectorRefs: ['jplHorizons'] },
    { date: '2025-01-13', label: 'Near perigee full Moon', connectorRefs: ['jplHorizons'] },
  ],
};
