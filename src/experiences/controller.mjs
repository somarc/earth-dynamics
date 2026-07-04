import { allLayerUi, buildLayerPresets } from '../layers/ui-registry.mjs';
import { applyPresetToScenes } from '../layers/layer-ui.mjs';
import { $id, $$ } from '../dom-scope.js';
import { allExperiences } from './registry.mjs';

const PANEL_SELECTOR = '[data-panel]';
const FULL_PRESET = buildLayerPresets().full;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function experienceToPreset(exp) {
  if (exp.showAllLayers) return { ...FULL_PRESET };
  const preset = {};
  for (const layer of allLayerUi()) {
    if (exp.layers[layer.key] !== undefined) {
      preset[layer.key] = exp.layers[layer.key];
    } else {
      preset[layer.key] = false;
    }
  }
  return preset;
}

export function applyExperiencePanels(exp) {
  const showAll = exp.showAllPanels;
  const allow = new Set(exp.panels ?? []);
  $$(PANEL_SELECTOR).forEach((el) => {
    const id = el.dataset.panel;
    if (showAll || !allow.size) {
      el.classList.remove('panel--experience-hidden');
      return;
    }
    const hidden = (exp.hiddenPanels ?? []).includes(id) || !allow.has(id);
    el.classList.toggle('panel--experience-hidden', hidden);
  });
}

export function syncExperienceUrl(experienceId, date) {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  url.searchParams.set('experience', experienceId);
  if (date) url.searchParams.set('date', date);
  window.history.replaceState({}, '', url);
}

export function parseExperienceUrl() {
  if (typeof window === 'undefined') return { experienceId: null, date: null };
  const params = new URLSearchParams(window.location.search);
  return {
    experienceId: params.get('experience'),
    date: params.get('date'),
  };
}

export function renderMoments(exp) {
  const el = $id('experience-moments');
  if (!el) return;
  const moments = exp.suggestedMoments ?? [];
  if (!moments.length) {
    el.innerHTML = '';
    el.classList.add('experience-moments--hidden');
    return;
  }
  el.classList.remove('experience-moments--hidden');
  el.innerHTML = `
    <span class="experience-moments__label">Moments</span>
    ${moments.map((m) => `<button type="button" class="moment-btn" data-moment-date="${esc(m.date)}" title="${esc(m.label)}">${esc(m.label)}</button>`).join('')}
  `;
}

export function wireMoments({ onMoment }) {
  const el = $id('experience-moments');
  if (!el || el.dataset.bound) return;
  el.dataset.bound = '1';
  el.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-moment-date]');
    if (!btn) return;
    onMoment?.(btn.dataset.momentDate);
  });
}

export function renderThemeRail(activeId, onSelect) {
  const rail = $id('theme-rail');
  if (!rail) return;
  rail.innerHTML = allExperiences()
    .map((exp) => {
      const active = exp.id === activeId ? ' theme-rail__btn--active' : '';
      const short = exp.id === 'full-instrument' ? 'Full' : exp.title.split(' ')[0];
      return `<button type="button" class="theme-rail__btn${active}" data-experience="${esc(exp.id)}" title="${esc(exp.tagline)}">${esc(short)}</button>`;
    })
    .join('');

  if (rail.dataset.bound) return;
  rail.dataset.bound = '1';
  rail.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-experience]');
    if (!btn) return;
    onSelect?.(btn.dataset.experience);
  });
}

export function applyExperience(exp, {
  geocentricScene,
  heliocentricScene,
  setView,
  date,
  applyEarthOpacity,
} = {}) {
  if (!exp) return;
  const preset = experienceToPreset(exp);
  applyPresetToScenes(preset, geocentricScene, heliocentricScene);
  applyExperiencePanels(exp);

  if (exp.globeOpacity != null && applyEarthOpacity) {
    applyEarthOpacity(exp.globeOpacity, { persist: false });
  }
  geocentricScene?.setHemisphereCullEvents?.(!!exp.hemisphereCull);

  const title = $id('experience-title');
  const tagline = $id('experience-tagline');
  if (title) title.textContent = exp.title;
  if (tagline) tagline.textContent = exp.tagline;

  if (setView && exp.defaultView) setView(exp.defaultView);

  const footerLayers = $id('footer-layers');
  if (footerLayers) {
    footerLayers.classList.toggle('controls__cluster--hidden', !exp.showAllLayers);
  }

  renderMoments(exp);
  syncExperienceUrl(exp.id, date);
}