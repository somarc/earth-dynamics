/**
 * Bald Earth studio — sidebar dials for naked-globe authoring.
 * Can also save appearance as app-wide defaults for other experiences.
 */
import { $id } from './dom-scope.js';
import {
  BALD_EARTH_DEFAULTS,
  LIT_MAP_SUGGESTED,
  SURFACE_MODELS,
  clearGlobeAppDefaults,
  hasGlobeAppDefaults,
  isLitMap,
  loadBaldEarthParams,
  loadGlobeAppDefaults,
  normalizeBaldEarthParams,
  saveBaldEarthParams,
  saveGlobeAppDefaults,
  surfaceLiftFromOpacity,
  toGlobeAppDefaults,
} from './lib/bald-earth-params.js';

const FIELD_META = [
  { key: 'surfaceOpacity', el: 'bes-surface-opacity', out: 'bes-surface-opacity-out', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'surfaceLift', el: 'bes-surface-lift', out: 'bes-surface-lift-out', fmt: (v) => (v == null ? 'auto' : v.toFixed(2)), optional: true },
  { key: 'contextDim', el: 'bes-context-dim', out: 'bes-context-dim-out', fmt: (v) => v.toFixed(2) },
  { key: 'nightBoost', el: 'bes-night-boost', out: 'bes-night-boost-out', fmt: (v) => v.toFixed(2) },
  { key: 'albedoBoost', el: 'bes-albedo-boost', out: 'bes-albedo-boost-out', fmt: (v) => v.toFixed(2) },
  { key: 'litRoughness', el: 'bes-lit-roughness', out: 'bes-lit-roughness-out', fmt: (v) => v.toFixed(2) },
  { key: 'nightEmissive', el: 'bes-night-emissive', out: 'bes-night-emissive-out', fmt: (v) => v.toFixed(2) },
  { key: 'atmosphereIntensity', el: 'bes-atm-intensity', out: 'bes-atm-intensity-out', fmt: (v) => v.toFixed(2) },
  { key: 'atmosphereScale', el: 'bes-atm-scale', out: 'bes-atm-scale-out', fmt: (v) => v.toFixed(3) },
  { key: 'ambient', el: 'bes-ambient', out: 'bes-ambient-out', fmt: (v) => v.toFixed(2) },
  { key: 'sunIntensity', el: 'bes-sun', out: 'bes-sun-out', fmt: (v) => v.toFixed(2) },
  { key: 'fillIntensity', el: 'bes-fill', out: 'bes-fill-out', fmt: (v) => v.toFixed(2) },
  { key: 'exposure', el: 'bes-exposure', out: 'bes-exposure-out', fmt: (v) => v.toFixed(2) },
  { key: 'autoRotate', el: 'bes-spin', out: 'bes-spin-out', fmt: (v) => v.toFixed(4) },
  { key: 'gridOpacity', el: 'bes-grid-opacity', out: 'bes-grid-opacity-out', fmt: (v) => v.toFixed(2) },
];

/** @type {{ getScene: () => object|null, onDiurnalMode?: (mode: string) => void, onParams?: (p: object) => void } | null} */
let ctx = null;
let params = normalizeBaldEarthParams({});
let liftManual = false;
let prevModel = SURFACE_MODELS.INSTRUMENT;

function readForm() {
  const next = { ...params };
  for (const f of FIELD_META) {
    const el = $id(f.el);
    if (!el) continue;
    if (f.key === 'surfaceLift') {
      if (liftManual) next.surfaceLift = parseFloat(el.value);
      else next.surfaceLift = null;
      continue;
    }
    next[f.key] = parseFloat(el.value);
  }
  next.atmosphereVisible = !!$id('bes-atm-visible')?.checked;
  next.starsVisible = !!$id('bes-stars')?.checked;
  next.bodiesVisible = !!$id('bes-bodies')?.checked;
  next.gridVisible = !!$id('bes-grid')?.checked;
  next.debugSun = !!$id('bes-debug-sun')?.checked;
  next.nightLights = !!$id('bes-night-lights')?.checked;
  next.orientToUser = !!$id('bes-orient-user')?.checked;
  next.useLocalNow = !!$id('bes-use-local-now')?.checked;

  const litRadio = $id('bes-model-lit');
  next.surfaceModel = litRadio?.checked ? SURFACE_MODELS.LIT_MAP : SURFACE_MODELS.INSTRUMENT;

  const diurnal = $id('bes-diurnal-sync')?.checked
    ? 'sync'
    : $id('bes-diurnal-free')?.checked
      ? 'free'
      : params.diurnalMode;
  next.diurnalMode = diurnal === 'sync' ? 'sync' : 'free';
  return normalizeBaldEarthParams(next);
}

function writeForm(p) {
  for (const f of FIELD_META) {
    const el = $id(f.el);
    const out = $id(f.out);
    if (!el) continue;
    let val = p[f.key];
    if (f.key === 'surfaceLift') {
      val = p.surfaceLift != null ? p.surfaceLift : surfaceLiftFromOpacity(p.surfaceOpacity);
      el.value = String(val);
      if (out) out.textContent = p.surfaceLift == null ? `auto ${val.toFixed(2)}` : val.toFixed(2);
      continue;
    }
    el.value = String(val);
    if (out) out.textContent = f.fmt(val);
  }
  const setCheck = (id, v) => {
    const el = $id(id);
    if (el) el.checked = !!v;
  };
  setCheck('bes-atm-visible', p.atmosphereVisible);
  setCheck('bes-stars', p.starsVisible);
  setCheck('bes-bodies', p.bodiesVisible);
  setCheck('bes-grid', p.gridVisible);
  setCheck('bes-debug-sun', p.debugSun);
  setCheck('bes-night-lights', p.nightLights);
  setCheck('bes-orient-user', p.orientToUser !== false);
  setCheck('bes-use-local-now', p.useLocalNow !== false);
  setCheck('bes-diurnal-sync', p.diurnalMode === 'sync');
  setCheck('bes-diurnal-free', p.diurnalMode === 'free');

  const inst = $id('bes-model-instrument');
  const lit = $id('bes-model-lit');
  if (inst) inst.checked = !isLitMap(p);
  if (lit) lit.checked = isLitMap(p);

  const liftLock = $id('bes-lift-manual');
  if (liftLock) liftLock.checked = liftManual || p.surfaceLift != null;

  updateSectionVisibility(p);
  updateAppDefaultsStatus();
}

function updateSectionVisibility(p) {
  const lit = isLitMap(p);
  const instSec = $id('bes-section-instrument');
  const litSec = $id('bes-section-lit');
  if (instSec) instSec.hidden = lit;
  if (litSec) litSec.hidden = !lit;
}

function updateAppDefaultsStatus() {
  const el = $id('bes-app-defaults-status');
  if (!el) return;
  const saved = loadGlobeAppDefaults();
  if (!saved) {
    el.textContent = 'No app defaults saved — other themes use factory globe.';
    el.classList.add('bes-status--empty');
    return;
  }
  const mode = saved.surfaceModel === SURFACE_MODELS.LIT_MAP ? 'Lit map' : 'Instrument';
  el.textContent = `App defaults active: ${mode} · ambient ${saved.ambient.toFixed(2)} · sun ${saved.sunIntensity.toFixed(2)}`;
  el.classList.remove('bes-status--empty');
}

function maybeSuggestLitDefaults(next) {
  const switchingToLit =
    next.surfaceModel === SURFACE_MODELS.LIT_MAP
    && prevModel !== SURFACE_MODELS.LIT_MAP;
  const staleLitPreset =
    next.surfaceModel === SURFACE_MODELS.LIT_MAP
    && next.ambient <= 0.35
    && next.sunIntensity <= 2.0
    && (next.albedoBoost == null || next.albedoBoost <= 1.05);

  if (switchingToLit || staleLitPreset) {
    return normalizeBaldEarthParams({
      ...next,
      ...LIT_MAP_SUGGESTED,
    });
  }
  return next;
}

function applyAndPersist() {
  let next = readForm();
  if (!liftManual) next.surfaceLift = null;
  next = maybeSuggestLitDefaults(next);
  prevModel = next.surfaceModel;
  params = next;

  const scene = ctx?.getScene?.();
  scene?.applyBareGlobeStudio?.(params);
  saveBaldEarthParams(params);
  writeForm(params);
  ctx?.onParams?.(params);
  if (params.diurnalMode) ctx?.onDiurnalMode?.(params.diurnalMode);

  const foot = $id('earth-opacity');
  if (foot) {
    foot.value = String(Math.round(params.surfaceOpacity * 100));
    foot.min = '30';
  }
  const footLabel = $id('earth-opacity-label');
  if (footLabel) footLabel.textContent = `${Math.round(params.surfaceOpacity * 100)}%`;
}

function flashButton(id, label, ms = 1400) {
  const btn = $id(id);
  if (!btn) return;
  const prev = btn.textContent;
  btn.textContent = label;
  setTimeout(() => { btn.textContent = prev; }, ms);
}

export function mountBaldEarthStudio(options) {
  ctx = options;
  params = loadBaldEarthParams();
  prevModel = params.surfaceModel;
  liftManual = params.surfaceLift != null;
  writeForm(params);

  const panel = $id('bald-earth-studio') || document.querySelector('[data-panel="bald-studio"]');
  if (!panel || panel.dataset.bound) return;
  panel.dataset.bound = '1';

  panel.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.id === 'bes-lift-manual') {
      liftManual = !!t.checked;
      if (!liftManual) params.surfaceLift = null;
      else params.surfaceLift = surfaceLiftFromOpacity(params.surfaceOpacity);
    }
    if (t.id === 'bes-surface-lift') liftManual = true;
    if (t.id === 'bes-diurnal-sync' || t.id === 'bes-diurnal-free') {
      if (t.id === 'bes-diurnal-sync' && t.checked) {
        const free = $id('bes-diurnal-free');
        if (free) free.checked = false;
      }
      if (t.id === 'bes-diurnal-free' && t.checked) {
        const sync = $id('bes-diurnal-sync');
        if (sync) sync.checked = false;
      }
    }
    applyAndPersist();
  });

  panel.addEventListener('change', (e) => {
    if (e.target?.name === 'bes-surface-model') applyAndPersist();
  });

  $id('bes-reset')?.addEventListener('click', () => {
    params = normalizeBaldEarthParams({ ...BALD_EARTH_DEFAULTS });
    prevModel = params.surfaceModel;
    liftManual = false;
    writeForm(params);
    applyAndPersist();
  });

  $id('bes-copy')?.addEventListener('click', async () => {
    const text = JSON.stringify(params, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      flashButton('bes-copy', 'Copied');
    } catch {
      console.info('[bald-earth studio]', text);
    }
  });

  $id('bes-save-app')?.addEventListener('click', () => {
    // Capture latest form (and persist studio session too)
    applyAndPersist();
    const saved = saveGlobeAppDefaults(params);
    updateAppDefaultsStatus();
    flashButton('bes-save-app', `Saved · ${saved.surfaceModel === 'lit-map' ? 'Lit map' : 'Instrument'}`);
  });

  $id('bes-clear-app')?.addEventListener('click', () => {
    clearGlobeAppDefaults();
    updateAppDefaultsStatus();
    flashButton('bes-clear-app', 'Cleared');
  });

  $id('bes-locate')?.addEventListener('click', async () => {
    applyAndPersist();
    const btn = $id('bes-locate');
    if (btn) btn.textContent = 'Locating…';
    try {
      await ctx?.onLocateMe?.();
      flashButton('bes-locate', 'Oriented');
    } catch {
      flashButton('bes-locate', 'Failed');
    } finally {
      if (btn) setTimeout(() => { btn.textContent = 'Locate me now'; }, 1200);
    }
  });
}

/**
 * Activate Bald studio, or leave it and apply app-wide globe defaults if any.
 */
export function setBaldEarthStudioActive(active) {
  const panel = document.querySelector('[data-panel="bald-studio"]');
  const scene = ctx?.getScene?.();
  if (active) {
    params = loadBaldEarthParams();
    // Prefer app defaults as starting point if user saved them and studio is factory-ish
    const app = loadGlobeAppDefaults();
    if (app && !hasStudioCustomization(params)) {
      params = normalizeBaldEarthParams({ ...params, ...app });
    }
    prevModel = params.surfaceModel;
    liftManual = params.surfaceLift != null;
    writeForm(params);
    scene?.applyBareGlobeStudio?.(params);
    panel?.classList.remove('panel--experience-hidden');
  } else {
    const app = loadGlobeAppDefaults();
    scene?.clearBareGlobeStudio?.(app);
    const foot = $id('earth-opacity');
    if (foot) foot.min = '65';
  }
}

function hasStudioCustomization(p) {
  // Heuristic: if user already moved off factory instrument defaults, keep studio session.
  if (p.surfaceModel === SURFACE_MODELS.LIT_MAP) return true;
  if (p.ambient !== BALD_EARTH_DEFAULTS.ambient) return true;
  if (p.sunIntensity !== BALD_EARTH_DEFAULTS.sunIntensity) return true;
  if (p.atmosphereIntensity !== BALD_EARTH_DEFAULTS.atmosphereIntensity) return true;
  return false;
}

/** Apply saved app defaults to the live scene (for non-bald experiences). */
export function applyGlobeAppDefaultsToScene(scene) {
  if (!scene) return null;
  const app = loadGlobeAppDefaults();
  if (!app) {
    scene.clearBareGlobeStudio?.(null);
    return null;
  }
  scene.applyGlobeAppearance?.(app, { bare: false, motion: false, guides: false });
  return app;
}

export function getBaldEarthStudioParams() {
  return { ...params };
}

export function getGlobeAppDefaultsSnapshot() {
  return loadGlobeAppDefaults();
}

export { hasGlobeAppDefaults, toGlobeAppDefaults };
