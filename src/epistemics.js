/** Epistemic classes for Wobblescope trust layer (Phase F). */

import { layerEpistemicMap } from './layers/ui-registry.mjs';
import { $id, $ } from './dom-scope.js';

export const EPISTEMIC = {
  measured: {
    id: 'measured',
    label: 'measured',
    title: 'Direct observation or instrument catalog',
  },
  modeled: {
    id: 'modeled',
    label: 'modeled',
    title: 'Physics-based or reanalysis model output',
  },
  derived: {
    id: 'derived',
    label: 'derived',
    title: 'Computed index or coupling from measured inputs',
  },
  pedagogical: {
    id: 'pedagogical',
    label: 'pedagogical',
    title: 'Teaching visualization — not a forecast or hazard product',
  },
  exploratory: {
    id: 'exploratory',
    label: 'exploratory',
    title: 'Hypothesis exploration only — not validated for prediction',
  },
};

export const PANEL_EPISTEMICS = {
  polhode: ['measured'],
  rotation: ['measured', 'derived'],
  ecliptic: ['measured'],
  helical: ['pedagogical'],
  lunar: ['measured', 'exploratory'],
  spaceWeather: ['measured', 'derived', 'modeled'],
  inspect: ['measured'],
  events: ['measured'],
  citations: [],
};

/** Layer epistemics derived from ui-registry + home-region overrides */
export const LAYER_EPISTEMICS = {
  ...layerEpistemicMap(),
  homeRegion: 'derived',
  geomag: 'modeled',
  magpole: 'modeled',
};

export const PICK_EPISTEMICS = {
  earthquake: 'measured',
  volcano: 'measured',
  hotspot: 'pedagogical',
  plate: 'derived',
  plateBoundary: 'pedagogical',
  'plate-boundary': 'pedagogical',
  cyclone: 'measured',
  weather: 'modeled',
  radar: 'measured',
  magnetometer: 'modeled',
  'magnetic-pole': 'modeled',
  'spin-pole': 'measured',
};

const DAY_MS = 86_400_000;

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function epistemicBadge(id, { compact = false } = {}) {
  const meta = EPISTEMIC[id];
  if (!meta) return '';
  const cls = compact ? 'epi-badge epi-badge--compact' : 'epi-badge';
  return `<span class="${cls} epi-badge--${id}" title="${esc(meta.title)}">${esc(meta.label)}</span>`;
}

export function epistemicBadgeRow(ids, opts) {
  const unique = [...new Set(ids)].filter((id) => EPISTEMIC[id]);
  if (!unique.length) return '';
  return `<span class="epi-badge-row">${unique.map((id) => epistemicBadge(id, opts)).join('')}</span>`;
}

export function renderPanelEpistemics() {
  const panels = [
    { selector: '#polhode-chart', key: 'polhode', parent: true },
    { selector: '#rotation-panel', key: 'rotation' },
    { selector: '#space-weather-panel', key: 'spaceWeather' },
    { selector: '#event-inspect', key: 'inspect', parent: true },
    { selector: '.panel--events', key: 'events' },
    { selector: '.panel--citations', key: 'citations' },
  ];

  for (const { selector, key, parent } of panels) {
    const el = $(selector);
    if (!el) continue;
    const host = parent ? el.closest('.panel') : el;
    const h2 = host?.querySelector('h2');
    if (!h2 || h2.querySelector('.epi-badge-row')) continue;
    const badges = epistemicBadgeRow(PANEL_EPISTEMICS[key] || []);
    if (badges) h2.insertAdjacentHTML('beforeend', badges);
  }

  const orbitalPanel = $('.panel--orbital-split');
  if (orbitalPanel) {
    const panes = orbitalPanel.querySelectorAll('.orbital-split__pane');
    const keys = ['ecliptic', 'helical'];
    panes.forEach((pane, i) => {
      const title = pane.querySelector('.orbital-split__title');
      if (!title || title.querySelector('.epi-badge-row')) return;
      const badges = epistemicBadgeRow(PANEL_EPISTEMICS[keys[i]] || []);
      if (badges) title.insertAdjacentHTML('beforeend', badges);
    });

    const helicalPane = panes[1];
    if (helicalPane && !helicalPane.querySelector('.helical-epi-note')) {
      helicalPane.insertAdjacentHTML(
        'beforeend',
        `<p class="helical-epi-note panel__hint">Helical view: Sun’s motion through the galactic plane (pedagogical). Planet coils use heliocentric JPL vectors — not a hazard or correlation claim.</p>`,
      );
    }
  }

  const lunarPanel = $id('orbital-metrics')?.closest('.panel');
  const lunarH2 = lunarPanel?.querySelector('h2');
  if (lunarH2 && !lunarH2.querySelector('.epi-badge-row')) {
    lunarH2.insertAdjacentHTML('beforeend', epistemicBadgeRow(PANEL_EPISTEMICS.lunar));
  }
}

function parseDateMs(dateStr) {
  if (!dateStr) return null;
  const ms = Date.parse(`${dateStr}T12:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

function daysBetween(a, b) {
  const ams = parseDateMs(a);
  const bms = parseDateMs(b);
  if (ams == null || bms == null) return null;
  return Math.round((bms - ams) / DAY_MS);
}

function ageDaysFrom(isoTimestamp) {
  if (!isoTimestamp) return null;
  const ms = Date.parse(isoTimestamp);
  if (!Number.isFinite(ms)) return null;
  return Math.floor((Date.now() - ms) / DAY_MS);
}

export function buildStalenessChips(meta) {
  if (!meta) return [];
  const chips = [];
  const freshness = meta.freshness || {};
  const ingested = new Map((meta.ingested || []).map((r) => [r.source, r]));

  const quakeLog = ingested.get('earthquakes-incremental') || ingested.get('earthquakes');
  const quakeAge = ageDaysFrom(quakeLog?.completed_at);
  if (quakeAge != null && quakeAge > 0) {
    chips.push({ id: 'quakes', label: `USGS +${quakeAge}d`, stale: quakeAge > 1, title: 'Earthquake ingest age' });
  } else if (freshness.earthquakesThrough) {
    const lag = daysBetween(freshness.earthquakesThrough, freshness.timelineEnd);
    if (lag > 0) {
      chips.push({ id: 'quakes', label: `Quakes −${lag}d`, stale: true, title: 'Catalog may miss very recent events until ingest runs' });
    }
  }

  const eopLag = freshness.eopLagDays;
  if (eopLag != null && eopLag > 0) {
    chips.push({
      id: 'eop',
      label: `EOP −${eopLag}d`,
      stale: eopLag > 7,
      title: `IERS EOP ends ${freshness.eopEnd}; visible timeline ${freshness.timelineEnd}`,
    });
  }

  const ephLag = freshness.ephemerisLagDays;
  if (ephLag != null && ephLag > 0) {
    chips.push({
      id: 'ephemeris',
      label: `Ephemeris −${ephLag}d`,
      stale: ephLag > 7,
      title: `JPL ephemeris ends ${freshness.ephemerisEnd}; visible timeline ${freshness.timelineEnd}`,
    });
  }

  const weatherLog = ingested.get('weather');
  const weatherNote = weatherLog?.notes || '';
  if (weatherNote.includes('/16')) {
    const m = weatherNote.match(/(\d+)\/16/);
    const n = m ? Number.parseInt(m[1], 10) : 16;
    if (n < 16) {
      chips.push({ id: 'weather', label: `Weather ${n}/16`, stale: true, title: 'Open-Meteo grid incomplete' });
    }
  }

  const omniLog = ingested.get('omni');
  const omniAge = ageDaysFrom(omniLog?.completed_at);
  if (omniAge != null && omniAge > 14) {
    chips.push({ id: 'omni', label: `OMNI +${omniAge}d`, stale: omniAge > 30, title: 'OMNI / Dst ingest age' });
  }

  return chips;
}

const ASOF_LABELS = {
  eop: 'EOP',
  ephemeris: 'Ephemeris',
  aam: 'AAM',
};

export function buildAsOfChips(requestedDate, asOf, coverage) {
  if (!requestedDate || !asOf) return [];
  const chips = [];
  for (const key of ['eop', 'ephemeris', 'aam']) {
    const resolved = asOf[key];
    const mode = coverage?.[key];
    if (!resolved || mode !== 'fallback' || resolved === requestedDate) continue;
    chips.push({
      id: `asof-${key}`,
      label: `${ASOF_LABELS[key]} → ${resolved}`,
      stale: true,
      title: `${ASOF_LABELS[key]} for ${requestedDate} uses the nearest prior row (${resolved})`,
    });
  }
  return chips;
}

export function renderAsOfChips(requestedDate, asOf, coverage) {
  const el = $id('asof-chips');
  if (!el) return;
  const chips = buildAsOfChips(requestedDate, asOf, coverage);
  if (!chips.length) {
    el.innerHTML = '';
    el.classList.add('asof-chips--hidden');
    return;
  }
  el.classList.remove('asof-chips--hidden');
  el.innerHTML = chips
    .map(
      (c) =>
        `<span class="stale-chip stale-chip--warn" title="${esc(c.title)}">${esc(c.label)}</span>`,
    )
    .join('');
}

export function renderStalenessChips(meta) {
  const el = $id('staleness-chips');
  if (!el) return;
  const chips = buildStalenessChips(meta);
  if (!chips.length) {
    el.innerHTML = '';
    el.classList.add('staleness-chips--hidden');
    return;
  }
  el.classList.remove('staleness-chips--hidden', 'header-chips--empty');
  el.innerHTML = chips
    .map(
      (c) =>
        `<span class="stale-chip${c.stale ? ' stale-chip--warn' : ''}" title="${esc(c.title)}">${esc(c.label)}</span>`,
    )
    .join('');
}

export function renderCitationsList(meta) {
  const el = $id('citations');
  if (!el) return;
  const sources = meta?.sources || {};
  const ingested = new Map((meta.ingested || []).map((r) => [r.source, r]));

  const list = Object.entries(sources)
    .map(([key, s]) => ({ key, ...s }))
    .filter((s) => s?.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  el.innerHTML = list
    .map((s) => {
      const ingestKeys = s.ingestKeys || [];
      const lastIngest = ingestKeys.map((k) => ingested.get(k)).find(Boolean);
      const age = ageDaysFrom(lastIngest?.completed_at);
      const staleLine = age != null
        ? `<span class="citation-stale${age > 30 ? ' citation-stale--warn' : ''}">ingested ${age === 0 ? 'today' : `${age}d ago`}</span>`
        : '';
      const epi = s.epistemic ? epistemicBadge(s.epistemic, { compact: true }) : '';
      return `
      <li>
        <div class="citation-head">
          <strong>${esc(s.name)}</strong>
          ${epi}
        </div>
        <span class="org">${esc(s.org)}</span><br />
        <a href="${esc(s.link)}" target="_blank" rel="noopener">${esc(s.citation)}</a>
        ${staleLine}
      </li>`;
    })
    .join('');
}

export function legendEpistemicHint(layerKey) {
  const id = LAYER_EPISTEMICS[layerKey];
  return id ? epistemicBadge(id, { compact: true }) : '';
}