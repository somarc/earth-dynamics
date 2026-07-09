import { allLayerUi, buildLayerPresets } from '../layers/ui-registry.mjs';
import { applyPresetToScenes } from '../layers/layer-ui.mjs';
import { $id, $$ } from '../dom-scope.js';
import { allExperiences } from './registry.mjs';
import { getExperienceIcon } from '../experience-icons.mjs';

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
  const hideAll = exp.hideAllPanels;
  const allow = new Set(exp.panels ?? []);
  $$(PANEL_SELECTOR).forEach((el) => {
    const id = el.dataset.panel;
    if (hideAll) {
      el.classList.add('panel--experience-hidden');
      return;
    }
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

/**
 * Pure parse of experience deep-link params from a search string, full URL, or URLSearchParams.
 * @param {string | URLSearchParams | URL | null | undefined} searchOrUrl
 * @returns {{ experienceId: string | null, date: string | null }}
 */
export function parseExperienceSearch(searchOrUrl) {
  let params;
  if (searchOrUrl instanceof URLSearchParams) {
    params = searchOrUrl;
  } else if (searchOrUrl instanceof URL) {
    params = searchOrUrl.searchParams;
  } else if (typeof searchOrUrl === 'string' && searchOrUrl.length) {
    try {
      if (/^https?:\/\//i.test(searchOrUrl) || searchOrUrl.startsWith('//')) {
        params = new URL(searchOrUrl, 'http://localhost').searchParams;
      } else if (searchOrUrl.includes('?')) {
        params = new URLSearchParams(searchOrUrl.slice(searchOrUrl.indexOf('?')));
      } else if (searchOrUrl.startsWith('experience=') || searchOrUrl.includes('=')) {
        params = new URLSearchParams(searchOrUrl);
      } else {
        params = new URLSearchParams(searchOrUrl.startsWith('?') ? searchOrUrl : `?${searchOrUrl}`);
      }
    } catch {
      params = new URLSearchParams();
    }
  } else {
    params = new URLSearchParams();
  }
  return {
    experienceId: params.get('experience'),
    date: params.get('date'),
  };
}

/** Thin wrapper around window.location for the live app. */
export function parseExperienceUrl() {
  if (typeof window === 'undefined') return { experienceId: null, date: null };
  return parseExperienceSearch(window.location.search);
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
      const icon = getExperienceIcon(exp.id);
      const label = exp.railLabel || exp.title;

      // Icon-only button with rich tooltip. The icon itself stays upright.
      return `
        <button
          type="button"
          class="theme-rail__btn${active}"
          data-experience="${esc(exp.id)}"
          title="${esc(label)} — ${esc(exp.tagline)}"
          aria-label="${esc(label)}: ${esc(exp.tagline)}"
        >
          ${icon}
        </button>
      `;
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

  // Bare globe: hide instrument chrome (axis line, etc.) that is not a data layer chip.
  const bare = !!exp.bareGlobe;
  geocentricScene?.setBareGlobeMode?.(bare);
  heliocentricScene?.setBareGlobeMode?.(bare);

  const title = $id('experience-title');
  const tagline = $id('experience-tagline');
  if (title) title.textContent = exp.title;
  if (tagline) tagline.textContent = exp.tagline;

  if (setView && exp.defaultView) setView(exp.defaultView);

  const footerLayers = $id('footer-layers');
  if (footerLayers) {
    footerLayers.classList.toggle('controls__cluster--hidden', !exp.showAllLayers);
  }

  // Bald Earth is for authoring the shell — hide moment chips and keep footer quiet.
  const moments = $id('experience-moments');
  if (bare && moments) {
    moments.innerHTML = '';
    moments.classList.add('experience-moments--hidden');
  } else {
    renderMoments(exp);
  }
  syncExperienceUrl(exp.id, date);
}