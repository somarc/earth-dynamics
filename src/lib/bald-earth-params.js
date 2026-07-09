/**
 * Pure defaults + clamp for Bald Earth studio knobs.
 * All values map to existing EarthScene / material / light controls.
 */

export const BALD_EARTH_STORAGE_KEY = 'wobblescope-bald-earth-studio';

/** App-wide globe look applied to all experiences (Solid, Ocean, …). */
export const GLOBE_APP_DEFAULTS_KEY = 'wobblescope-globe-app-defaults';

/** Surface shading modes on the same sphere mesh. */
export const SURFACE_MODELS = Object.freeze({
  INSTRUMENT: 'instrument',
  LIT_MAP: 'lit-map',
});

/** Production-ish defaults matching current EarthScene init. */
export const BALD_EARTH_DEFAULTS = Object.freeze({
  /** instrument = terminator shader; lit-map = GE-like Standard lighting */
  surfaceModel: SURFACE_MODELS.INSTRUMENT,
  // Surface (instrument shader)
  surfaceOpacity: 1,
  surfaceLift: null,
  contextDim: 1,
  nightBoost: 0.55,
  // Lit-map material (Phong)
  litRoughness: 0.55, // UI: lower = shinier water/land highlights
  nightLights: true,
  nightEmissive: 0.2,
  albedoBoost: 1.4, // multiplies day map color so land reads on dark basemap
  // Atmosphere
  atmosphereVisible: true,
  atmosphereIntensity: 1.2,
  atmosphereScale: 1.0,
  // Lights / post
  ambient: 0.22,
  sunIntensity: 1.35,
  fillIntensity: 0.12,
  exposure: 1.05,
  // Motion
  diurnalMode: 'free',
  autoRotate: 0.002,
  // Viewer orientation (GPS / timezone + local solar time)
  orientToUser: true,
  useLocalNow: true, // scrub to local today + sun phase from local clock
  // Visibility
  starsVisible: true,
  bodiesVisible: true,
  gridVisible: false,
  gridOpacity: 0.15,
  // Debug
  debugSun: false,
});

/**
 * Defaults when switching to lit-map (GE-like).
 * Ambient must be strong + white (see EarthScene) — navy ambient was washing to black.
 */
export const LIT_MAP_SUGGESTED = Object.freeze({
  ambient: 0.55,
  sunIntensity: 2.4,
  fillIntensity: 0.25,
  exposure: 1.25,
  // Shell must stay modest so Live night views aren't a blue halo ball
  atmosphereIntensity: 0.65,
  atmosphereScale: 1.0,
  albedoBoost: 1.45,
  nightEmissive: 0.18,
  litRoughness: 0.55,
});

export function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

/**
 * @param {Partial<typeof BALD_EARTH_DEFAULTS>} raw
 */
export function normalizeBaldEarthParams(raw = {}) {
  const d = BALD_EARTH_DEFAULTS;
  const surfaceOpacity = clamp(
    Number(raw.surfaceOpacity ?? d.surfaceOpacity),
    0.3,
    1,
  );
  let surfaceLift = raw.surfaceLift;
  if (surfaceLift != null && Number.isFinite(Number(surfaceLift))) {
    surfaceLift = clamp(Number(surfaceLift), 0.2, 1.2);
  } else {
    surfaceLift = null;
  }
  const surfaceModel =
    raw.surfaceModel === SURFACE_MODELS.LIT_MAP
      ? SURFACE_MODELS.LIT_MAP
      : SURFACE_MODELS.INSTRUMENT;

  return {
    surfaceModel,
    surfaceOpacity,
    surfaceLift,
    contextDim: clamp(Number(raw.contextDim ?? d.contextDim), 0.08, 1),
    nightBoost: clamp(Number(raw.nightBoost ?? d.nightBoost), 0.05, 1.5),
    litRoughness: clamp(Number(raw.litRoughness ?? d.litRoughness), 0.05, 1),
    nightLights: raw.nightLights !== false,
    nightEmissive: clamp(Number(raw.nightEmissive ?? d.nightEmissive), 0, 2),
    albedoBoost: clamp(Number(raw.albedoBoost ?? d.albedoBoost), 0.5, 2.5),
    atmosphereVisible: raw.atmosphereVisible !== false,
    atmosphereIntensity: clamp(Number(raw.atmosphereIntensity ?? d.atmosphereIntensity), 0, 3),
    atmosphereScale: clamp(Number(raw.atmosphereScale ?? d.atmosphereScale), 0.98, 1.12),
    ambient: clamp(Number(raw.ambient ?? d.ambient), 0, 1.5),
    sunIntensity: clamp(Number(raw.sunIntensity ?? d.sunIntensity), 0, 4),
    fillIntensity: clamp(Number(raw.fillIntensity ?? d.fillIntensity), 0, 1),
    exposure: clamp(Number(raw.exposure ?? d.exposure), 0.4, 2.5),
    diurnalMode: raw.diurnalMode === 'sync' ? 'sync' : 'free',
    autoRotate: clamp(Number(raw.autoRotate ?? d.autoRotate), 0, 0.05),
    orientToUser: raw.orientToUser !== false,
    useLocalNow: raw.useLocalNow !== false,
    starsVisible: raw.starsVisible !== false,
    bodiesVisible: raw.bodiesVisible !== false,
    gridVisible: !!raw.gridVisible,
    gridOpacity: clamp(Number(raw.gridOpacity ?? d.gridOpacity), 0.02, 0.5),
    debugSun: !!raw.debugSun,
  };
}

export function loadBaldEarthParams() {
  try {
    const raw = localStorage.getItem(BALD_EARTH_STORAGE_KEY);
    if (!raw) return normalizeBaldEarthParams({});
    return normalizeBaldEarthParams(JSON.parse(raw));
  } catch {
    return normalizeBaldEarthParams({});
  }
}

export function saveBaldEarthParams(params) {
  try {
    localStorage.setItem(BALD_EARTH_STORAGE_KEY, JSON.stringify(normalizeBaldEarthParams(params)));
  } catch {
    /* ignore */
  }
}

/**
 * Keys that define the planetary body look shared across experiences.
 * Excludes studio-only motion/guides that would fight layer experiences.
 */
export const GLOBE_APPEARANCE_KEYS = [
  'surfaceModel',
  'surfaceOpacity',
  'surfaceLift',
  'contextDim',
  'nightBoost',
  'litRoughness',
  'nightLights',
  'nightEmissive',
  'albedoBoost',
  'atmosphereVisible',
  'atmosphereIntensity',
  'atmosphereScale',
  'ambient',
  'sunIntensity',
  'fillIntensity',
  'exposure',
  'starsVisible',
  'orientToUser',
  'useLocalNow',
];

/** Slice studio params into app-wide appearance defaults. */
export function toGlobeAppDefaults(params) {
  const p = normalizeBaldEarthParams(params);
  const out = {};
  for (const k of GLOBE_APPEARANCE_KEYS) {
    out[k] = p[k];
  }
  return normalizeBaldEarthParams(out);
}

export function loadGlobeAppDefaults() {
  try {
    const raw = localStorage.getItem(GLOBE_APP_DEFAULTS_KEY);
    if (!raw) return null;
    return toGlobeAppDefaults(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveGlobeAppDefaults(params) {
  const sliced = toGlobeAppDefaults(params);
  try {
    localStorage.setItem(GLOBE_APP_DEFAULTS_KEY, JSON.stringify(sliced));
  } catch {
    /* ignore */
  }
  return sliced;
}

export function clearGlobeAppDefaults() {
  try {
    localStorage.removeItem(GLOBE_APP_DEFAULTS_KEY);
  } catch {
    /* ignore */
  }
}

export function hasGlobeAppDefaults() {
  try {
    return !!localStorage.getItem(GLOBE_APP_DEFAULTS_KEY);
  } catch {
    return false;
  }
}

/** Surface opacity → uSurfaceLift (same curve as production setEarthOpacity). */
export function surfaceLiftFromOpacity(opacity) {
  const t = clamp(opacity, 0.3, 1);
  return 0.46 + 0.26 * t;
}

export function isLitMap(params) {
  return (params?.surfaceModel ?? SURFACE_MODELS.INSTRUMENT) === SURFACE_MODELS.LIT_MAP;
}
