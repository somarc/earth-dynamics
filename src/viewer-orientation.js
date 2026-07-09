/**
 * Default viewer orientation: face GPS/timezone location + wall-clock sun.
 *
 * Important: daily ephemeris sun vectors do NOT encode hour-of-day (Earth rotation).
 * Live lighting uses body-fixed subsolar lon from UTC + seasonal declination.
 */
import {
  localDateString,
  nearestCatalogDate,
  solarElevationCos,
  subsolarLatLon,
  utcDayPhase,
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
  const now = new Date();

  if (appearance.useLocalNow !== false && dates.length) {
    const preferred = localDateString(now);
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
  // free = don't spin surface under a fake day phase; Live sun owns terminator.
  ctx.setDiurnalMode?.('free');

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
    scene.diurnalDay = day;
    scene.diurnalNextDay = nextEph || day;
    scene.liveSunClock = true;
    scene.applyLiveSunFromClock?.(now);
  }

  const elev = day?.sun
    ? solarElevationCos(loc.lat, loc.lon, now, { sunBody: day.sun })
    : null;
  const sub = day?.sun ? subsolarLatLon(now, { sunBody: day.sun }) : null;

  return {
    location: loc,
    status: locationStatusText(loc),
    phase: utcDayPhase(now),
    solarElevationCos: elev,
    subsolar: sub,
    date: dates[ctx.getCurrentIndex?.() ?? 0] ?? null,
  };
}
