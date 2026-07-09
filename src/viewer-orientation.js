/**
 * Default viewer orientation: face GPS/timezone location + local "now" sun phase.
 */
import {
  localDateString,
  localDayPhase,
  nearestCatalogDate,
} from './lib/earth-orientation.js';
import {
  loadGlobeAppDefaults,
  normalizeBaldEarthParams,
} from './lib/bald-earth-params.js';
import {
  locationStatusText,
  resolveUserLocation,
} from './lib/user-location.js';

/**
 * @param {object} ctx
 * @param {() => object|null} ctx.getScene
 * @param {() => string[]} ctx.getDates
 * @param {() => number} ctx.getCurrentIndex
 * @param {(i: number) => void} ctx.setCurrentIndex
 * @param {() => Promise<void>} ctx.refreshFrame  // updateUI
 * @param {(mode: string) => void} [ctx.setDiurnalMode]
 * @param {() => object|null} [ctx.getCatalog]
 * @param {(catalog: object, date: string) => Promise<object|null>} [ctx.loadNextEphemeris]
 * @param {() => object|null} [ctx.getCachedFrame]
 */
export async function applyViewerOrientation(ctx, { force = false } = {}) {
  const scene = ctx.getScene?.();
  if (!scene?.orientToLocation) return null;

  const appearance =
    scene.getAppearanceParams?.()
    || loadGlobeAppDefaults()
    || normalizeBaldEarthParams({});

  if (!force && appearance.orientToUser === false) return null;

  const loc = await resolveUserLocation();
  const dates = ctx.getDates?.() || [];

  if (appearance.useLocalNow !== false && dates.length) {
    const preferred = localDateString();
    const date = nearestCatalogDate(dates, preferred);
    const idx = date != null ? dates.indexOf(date) : -1;
    if (idx >= 0) {
      ctx.setCurrentIndex?.(idx);
    }
  }

  await ctx.refreshFrame?.();

  scene.orientToLocation({
    lat: loc.lat,
    lon: loc.lon,
    lock: true,
    frameCamera: true,
  });
  ctx.setDiurnalMode?.('free');

  const phase = localDayPhase();
  const frame = ctx.getCachedFrame?.();
  const date = dates[ctx.getCurrentIndex?.() ?? 0];
  let nextEph = null;
  if (ctx.getCatalog && ctx.loadNextEphemeris && date) {
    try {
      nextEph = await ctx.loadNextEphemeris(ctx.getCatalog(), date);
    } catch {
      nextEph = null;
    }
  }
  const day = frame?.ephemerisDay ?? null;
  if (day) {
    scene.applySunPhase?.(phase, day, nextEph);
  }

  return {
    location: loc,
    status: locationStatusText(loc),
    phase,
    date: dates[ctx.getCurrentIndex?.() ?? 0] ?? null,
  };
}
