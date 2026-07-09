/**
 * Bald Earth studio — sidebar dials for naked-globe authoring.
 */
import { $id, $$ } from './dom-scope.js';
import {
  BALD_EARTH_DEFAULTS,
  loadBaldEarthParams,
  normalizeBaldEarthParams,
  saveBaldEarthParams,
  surfaceLiftFromOpacity,
} from './lib/bald-earth-params.js';

const FIELD_META = [
  { key: 'surfaceOpacity', el: 'bes-surface-opacity', out: 'bes-surface-opacity-out', fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'surfaceLift', el: 'bes-surface-lift', out: 'bes-surface-lift-out', fmt: (v) => (v == null ? 'auto' : v.toFixed(2)), optional: true },
  { key: 'contextDim', el: 'bes-context-dim', out: 'bes-context-dim-out', fmt: (v) => v.toFixed(2) },
  { key: 'nightBoost', el: 'bes-night-boost', out: 'bes-night-boost-out', fmt: (v) => v.toFixed(2) },
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
  setCheck('bes-diurnal-sync', p.diurnalMode === 'sync');
  setCheck('bes-diurnal-free', p.diurnalMode === 'free');
  const liftLock = $id('bes-lift-manual');
  if (liftLock) liftLock.checked = liftManual || p.surfaceLift != null;
}

function applyAndPersist() {
  params = readForm();
  if (!liftManual) params.surfaceLift = null;
  const scene = ctx?.getScene?.();
  scene?.applyBareGlobeStudio?.(params);
  saveBaldEarthParams(params);
  writeForm(params);
  ctx?.onParams?.(params);
  if (params.diurnalMode) ctx?.onDiurnalMode?.(params.diurnalMode);
  // Sync footer surface slider if present
  const foot = $id('earth-opacity');
  if (foot) {
    foot.value = String(Math.round(params.surfaceOpacity * 100));
    foot.min = '30';
  }
  const footLabel = $id('earth-opacity-label');
  if (footLabel) footLabel.textContent = `${Math.round(params.surfaceOpacity * 100)}%`;
}

export function mountBaldEarthStudio(options) {
  ctx = options;
  params = loadBaldEarthParams();
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
      if (!liftManual) {
        params.surfaceLift = null;
      } else {
        params.surfaceLift = surfaceLiftFromOpacity(params.surfaceOpacity);
      }
    }
    if (t.id === 'bes-surface-lift') liftManual = true;
    if (t.id === 'bes-diurnal-sync' || t.id === 'bes-diurnal-free') {
      // radio-style checkboxes
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

  $id('bes-reset')?.addEventListener('click', () => {
    params = normalizeBaldEarthParams({ ...BALD_EARTH_DEFAULTS });
    liftManual = false;
    writeForm(params);
    applyAndPersist();
  });

  $id('bes-copy')?.addEventListener('click', async () => {
    const text = JSON.stringify(params, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      const btn = $id('bes-copy');
      if (btn) {
        const prev = btn.textContent;
        btn.textContent = 'Copied';
        setTimeout(() => { btn.textContent = prev; }, 1200);
      }
    } catch {
      console.info('[bald-earth studio]', text);
    }
  });
}

/** Activate/deactivate studio when experience changes. */
export function setBaldEarthStudioActive(active) {
  const panel = document.querySelector('[data-panel="bald-studio"]');
  const scene = ctx?.getScene?.();
  if (active) {
    params = loadBaldEarthParams();
    liftManual = params.surfaceLift != null;
    writeForm(params);
    scene?.applyBareGlobeStudio?.(params);
    panel?.classList.remove('panel--experience-hidden');
  } else {
    scene?.clearBareGlobeStudio?.();
    // Restore production surface clamp on footer slider
    const foot = $id('earth-opacity');
    if (foot) foot.min = '65';
  }
}

export function getBaldEarthStudioParams() {
  return { ...params };
}
