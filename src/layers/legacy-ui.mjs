/** UI definitions for layers not yet migrated to layers/<id>/layer.mjs. */

export const PRESET_IDS = ['solid', 'space', 'orbital', 'atmosphere', 'full'];

const P = {
  solid: { solid: true, space: false, orbital: false, atmosphere: false, full: true },
  space: { solid: false, space: true, orbital: false, atmosphere: false, full: true },
  orbital: { solid: false, space: false, orbital: true, atmosphere: false, full: true },
  atmos: { solid: false, space: false, orbital: false, atmosphere: true, full: true },
  off: { solid: false, space: false, orbital: false, atmosphere: false, full: true },
};

export const LEGACY_LAYER_UI = [
  {
    id: 'quakes',
    key: 'quakes',
    toggleId: 'show-quakes',
    epistemic: 'measured',
    ui: { group: 'solid', chipLabel: 'Quakes', title: 'USGS earthquakes' },
    presets: {
      solid: true, space: false, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible, view) {
      scene.showQuakes = visible;
    },
  },
  {
    id: 'volcanoes',
    key: 'volcanoes',
    toggleId: 'show-volcanoes',
    epistemic: 'measured',
    ui: { group: 'solid', chipLabel: 'GVP', title: 'GVP eruption episodes in window' },
    presets: {
      solid: true, space: false, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible) {
      scene.showVolcanoes = visible;
    },
  },
  {
    id: 'spin-pole',
    key: 'spinPole',
    toggleId: 'show-spin-pole',
    epistemic: 'measured',
    ui: {
      group: 'solid',
      chipId: 'chip-spin-pole',
      chipLabel: 'Spin',
      title: 'IERS spin pole marker (exaggerated on globe)',
    },
    presets: {
      solid: true, space: true, orbital: true, atmosphere: true, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible) {
      scene.setSpinPoleVisible(visible);
    },
  },
  {
    id: 'trail',
    key: 'trail',
    toggleId: 'show-trail',
    epistemic: 'measured',
    ui: {
      group: 'solid',
      chipId: 'chip-pole-trail',
      chipLabel: 'Trail',
      title: 'IERS polar wander path — recent trail near spin pole',
    },
    presets: {
      solid: true, space: true, orbital: true, atmosphere: true, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible) {
      scene.setTrailVisible(visible);
    },
  },
  {
    id: 'plates',
    key: 'plates',
    toggleId: 'show-plates',
    epistemic: 'pedagogical',
    ui: {
      group: 'solid',
      chipLabel: 'Plates',
      title: 'PB2002 steps — red=subduction, green=ridge/rift, yellow dashed=transform, orange=convergent (kinematic class, not quake intensity)',
    },
    presets: {
      solid: true, space: false, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric'],
    applyVisible(scene, visible) {
      scene.setPlatesVisible(visible);
    },
  },
  {
    id: 'plate-motion',
    key: 'plateMotion',
    toggleId: 'show-plate-motion',
    epistemic: 'derived',
    ui: { group: 'solid', chipLabel: 'Motion', title: 'Plate motion vectors' },
    presets: {
      solid: true, space: false, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric'],
    applyVisible(scene, visible) {
      scene.setPlateMotionVisible(visible);
    },
  },
  {
    id: 'weather',
    key: 'weather',
    toggleId: 'show-weather-glyphs',
    epistemic: 'modeled',
    ui: {
      group: 'atmos',
      chipId: 'chip-weather',
      chipLabel: 'Weather',
      countKey: 'weather',
      title: 'ERA5 weather glyphs at 16 grid cities',
    },
    presets: {
      solid: false, space: false, orbital: false, atmosphere: true, full: true,
    },
    views: ['geocentric'],
    applyVisible(scene, visible) {
      scene.setWeatherVisible(visible);
    },
    onToggle: 'reapplyEvents',
  },
  {
    id: 'radar',
    key: 'radar',
    toggleId: 'show-radar-sites',
    epistemic: 'measured',
    ui: {
      group: 'atmos',
      chipId: 'chip-radar',
      chipLabel: 'Radar',
      countKey: 'radar',
      title: 'US NEXRAD/TDWR and Canada MSC radar sites with nominal coverage rings',
    },
    presets: {
      solid: false, space: false, orbital: false, atmosphere: true, full: true,
    },
    views: ['geocentric'],
    applyVisible(scene, visible) {
      scene.setRadarVisible(visible);
    },
    onToggle: 'updateChipCounts',
  },
  {
    id: 'aurora',
    key: 'aurora',
    toggleId: 'show-aurora',
    epistemic: 'derived',
    ui: { group: 'space', chipLabel: 'Aurora', title: 'OVATION / Kp aurora' },
    presets: {
      solid: false, space: true, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible) {
      scene.showAurora = visible;
    },
    onToggle: 'updateUI',
  },
  {
    id: 'field-lines',
    key: 'fieldLines',
    toggleId: 'show-field-lines',
    epistemic: 'modeled',
    ui: {
      group: 'space',
      chipId: 'chip-geomag',
      chipLabel: 'Geomag',
      title: 'WMM field lines, IGRF magnetic poles, INTERMAGNET when space-weather data exists',
    },
    presets: {
      solid: false, space: true, orbital: false, atmosphere: false, full: true,
    },
    views: ['geocentric', 'heliocentric'],
    applyVisible(scene, visible) {
      scene.showFieldLines = visible;
      scene.refreshGeomagLayer?.(scene.lastGeomagnetic);
    },
    onToggle: 'geomagChips',
  },
  {
    id: 'bodies',
    key: 'bodies',
    toggleId: 'show-bodies',
    epistemic: 'measured',
    ui: { group: 'sky', chipLabel: 'Bodies', title: 'Moon and Sun markers' },
    presets: {
      solid: true, space: false, orbital: true, atmosphere: false, full: true,
    },
    views: ['geocentric'],
    applyVisible(scene, visible) {
      scene.showBodies = visible;
    },
    onToggle: 'updateUI',
  },
  {
    id: 'moon',
    key: 'moon',
    toggleId: 'show-moon',
    epistemic: 'measured',
    ui: {
      group: 'space',
      chipId: 'show-moon-label',
      chipLabel: 'Moon',
      title: 'Moon in heliocentric view',
      hiddenUntilHelio: true,
    },
    presets: {
      solid: true, space: false, orbital: true, atmosphere: false, full: true,
    },
    views: ['heliocentric'],
    applyVisible(scene, visible) {
      scene.showMoon = visible;
    },
    onToggle: 'updateUI',
  },
  {
    id: 'cme',
    key: 'cme',
    toggleId: 'show-cme',
    epistemic: 'measured',
    ui: {
      group: 'space',
      chipId: 'show-cme-label',
      chipLabel: 'CME',
      title: 'CME markers',
      hiddenUntilHelio: true,
    },
    presets: {
      solid: true, space: true, orbital: true, atmosphere: false, full: true,
    },
    views: ['heliocentric'],
    applyVisible(scene, visible) {
      scene.showCme = visible;
    },
    onToggle: 'updateUI',
  },
];