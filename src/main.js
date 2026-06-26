import { EarthScene } from './earth.js';
import { HeliocentricScene } from './heliocentric.js';
import { drawPolhode, drawLodChart } from './charts.js';
import { drawEclipticChart, renderOrbitalMetrics } from './ephemeris.js';
import { drawHelicalChart } from './helical-chart.js';
import { drawKpChart, drawDstChart, renderSpaceWeatherMetrics } from './space-weather.js';
import {
  applySpaceWeatherChainHighlight,
  evaluateSpaceWeatherChain,
} from './space-weather-chain.js';
import { fetchOvation, isOvationCurrent, ovationEquatorwardEdge } from './ovation.js';
import { renderEventInspect } from './event-inspect.js';
import { getGlobeInspectContext, renderGlobeTooltip } from './globe-inspect.js';
import { formatDate, addDays, filterQuakesByMinMag } from './utils.js';
import { hasGeomagContext } from './geomag-globe.js';
import { loadCatalog, loadFrame } from './data-client.js';
import {
  EPISTEMIC,
  LAYER_EPISTEMICS,
  renderCitationsList,
  renderPanelEpistemics,
  renderStalenessChips,
} from './epistemics.js';
import { bindLegendHelp, renderLegendHtml } from './legend-help.js';
import { createTimelineSlider } from './timeline-slider.js';
import { createViewTransition, updateViewTransition } from './view-transition.js';

const API_BASE = import.meta.env.VITE_API_BASE || '';

const state = {
  catalog: null,
  dates: [],
  currentIndex: 0,
  playing: false,
  speed: 1,
  /** Real milliseconds per simulated day at 1× playback speed */
  dayLengthMs: 60_000,
  lastFrame: 0,
  dayAccumulator: 0,
  diurnalMode: 'sync',
  view: 'geocentric',
  eopSeries: [],
  ovationData: null,
  recentOnly: true,
  quakeMinMag: 5,
  cachedFrame: null,
  cachedDate: null,
};

let geocentricScene = null;
let heliocentricScene = null;
let viewTransition = null;
let timelineSlider = null;

const LAYER_PRESETS = {
  solid: {
    label: 'Solid Earth',
    quakes: true,
    volcanoes: true,
    spinPole: true,
    trail: true,
    plates: true,
    plateMotion: true,
    hotspots: true,
    aurora: false,
    fieldLines: false,
    bodies: true,
    moon: true,
    cyclones: false,
    weather: false,
  },
  space: {
    label: 'Space Weather',
    quakes: false,
    volcanoes: false,
    spinPole: true,
    trail: true,
    plates: false,
    plateMotion: false,
    hotspots: false,
    aurora: true,
    fieldLines: true,
    bodies: false,
    moon: false,
    cyclones: false,
    weather: false,
  },
  orbital: {
    label: 'Orbital',
    quakes: false,
    volcanoes: false,
    spinPole: true,
    trail: true,
    plates: false,
    plateMotion: false,
    hotspots: false,
    aurora: false,
    fieldLines: false,
    bodies: true,
    moon: true,
    cyclones: false,
    weather: false,
  },
  full: {
    label: 'Full stack',
    quakes: true,
    volcanoes: true,
    spinPole: true,
    trail: true,
    plates: true,
    plateMotion: true,
    hotspots: true,
    aurora: true,
    fieldLines: true,
    bodies: true,
    moon: true,
    cyclones: true,
    weather: true,
  },
  atmosphere: {
    label: 'Atmosphere',
    quakes: false,
    volcanoes: false,
    spinPole: true,
    trail: true,
    plates: false,
    plateMotion: false,
    hotspots: false,
    aurora: false,
    fieldLines: false,
    bodies: false,
    moon: false,
    cyclones: true,
    weather: true,
  },
};

function activeScene() {
  return state.view === 'heliocentric' ? heliocentricScene : geocentricScene;
}

function pluralCount(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

function formatGlobeTally(counts) {
  if (!counts) return null;
  const parts = [];
  if (counts.quakes != null) parts.push(pluralCount(counts.quakes, 'quake'));
  if (counts.eruptions != null) {
    parts.push(pluralCount(counts.eruptions, 'active GVP eruption', 'active GVP eruptions'));
  }
  if (counts.cyclones != null) parts.push(pluralCount(counts.cyclones, 'cyclone'));
  if (counts.weather != null) parts.push(pluralCount(counts.weather, 'weather grid point', 'weather grid points'));
  if (counts.storms) parts.push(pluralCount(counts.storms, 'storm'));
  return parts.join(', ');
}

function updateEventsPanelMeta(date, counts = null) {
  const eventsTitle = document.getElementById('events-panel-title');
  const eventsDesc = document.getElementById('events-panel-desc');
  const recentEl = document.getElementById('recent-only');
  const recentLabel = document.getElementById('recent-only-label');
  const filterLabel = document.querySelector('.filter-label');

  if (recentEl) recentEl.checked = state.recentOnly;
  filterLabel?.classList.toggle('filter-label--active', state.recentOnly);

  const tally = formatGlobeTally(counts);
  if (recentLabel) {
    recentLabel.textContent = state.recentOnly ? '7d' : '±7d';
  }

  const footerTally = document.getElementById('footer-tally');
  if (footerTally) {
    footerTally.textContent = tally || '';
    footerTally.title = tally || 'Globe event counts';
  }

  if (!eventsTitle || !eventsDesc) return;

  if (state.recentOnly) {
    eventsTitle.textContent = 'Events (past 7 days)';
    const range = date ? `${addDays(date, -7)} → ${date}` : 'past 7 days';
    const globeTally = counts ? formatGlobeTally(counts) : null;
    const onGlobe = globeTally ? `${globeTally} on globe` : 'loading…';
    eventsDesc.textContent = `${range} — ${onGlobe}. ▲ = GVP eruption episodes active in window. Uncheck footer for ±7d.`;
  } else {
    eventsTitle.textContent = 'Events at Date';
    const globeTally = counts ? formatGlobeTally(counts) : null;
    const onGlobe = globeTally ? `${globeTally} on globe (±7d)` : '±7 day windows around selected date';
    eventsDesc.textContent = `${onGlobe}. ▲ = one GVP episode overlapping this date. Check “Past week only” to trim older markers.`;
  }
}

function visibleEarthquakes(quakes) {
  return filterQuakesByMinMag(quakes, state.quakeMinMag);
}

function updateLayerChipLabels(counts = {}, { geomagContext = false, magnetometers = 0 } = {}) {
  const setChip = (chipId, label, count) => {
    const chip = document.getElementById(chipId);
    if (!chip) return;
    if (!chip.dataset.baseTitle) chip.dataset.baseTitle = chip.title;
    const span = chip.querySelector('span');
    if (!span) return;
    const n = count ?? 0;
    span.textContent = n > 0 ? `${label} (${n})` : label;
    chip.classList.toggle('layer-chip--empty', n === 0);
    chip.title = n === 0
      ? `${chip.dataset.baseTitle} — none in current date window`
      : chip.dataset.baseTitle;
  };

  setChip('chip-cyclones', 'Cyclones', counts.cyclones ?? 0);
  setChip('chip-weather', 'Weather', counts.weather ?? 0);

  const geomagChip = document.getElementById('chip-geomag');
  if (geomagChip) {
    const span = geomagChip.querySelector('span');
    const on = document.getElementById('show-field-lines')?.checked;
    if (span) {
      if (on && geomagContext && magnetometers > 0) {
        span.textContent = `Geomag (${magnetometers})`;
      } else {
        span.textContent = 'Geomag';
      }
    }
    geomagChip.classList.remove('layer-chip--empty');
  }
}

async function loadNextEphemeris(catalog, date) {
  const idx = state.dates.indexOf(date);
  const nextDate = state.dates[idx + 1];
  if (!nextDate) return null;
  if (catalog.mode === 'api') {
    try {
      const res = await fetch(`${API_BASE}/api/ephemeris/window?end=${nextDate}&days=1`);
      if (!res.ok) return null;
      const win = await res.json();
      return win.find((row) => row.date === nextDate) ?? win.at(-1) ?? null;
    } catch {
      return null;
    }
  }
  return catalog.ephemeris?.byDate?.[nextDate] ?? null;
}

function reapplyEventLayersFromCache() {
  if (state.cachedFrame && state.cachedDate) {
    applyEventLayers(state.cachedFrame, state.cachedDate);
  }
}

function applyEventLayers(frame, date) {
  const quakes = visibleEarthquakes(frame.earthquakes);
  geocentricScene.viewDate = date;
  geocentricScene.setEarthquakes(quakes);
  geocentricScene.setVolcanoes(frame.eruptions);
  geocentricScene.setCyclones(frame.cyclones, date);
  geocentricScene.setWeatherGlyphs(frame.weather);
  heliocentricScene.setEarthquakes(quakes);
  heliocentricScene.setVolcanoes(frame.eruptions);
  heliocentricScene.setCmeEvents(frame.spaceWeather, date);
}

function renderCitations() {
  renderCitationsList(state.catalog?.manifest);
}

const LAYER_TOGGLE_MAP = {
  'show-quakes': 'quakes',
  'show-volcanoes': 'volcanoes',
  'show-plates': 'plates',
  'show-plate-motion': 'plateMotion',
  'show-hotspots': 'hotspots',
  'show-cyclones': 'cyclones',
  'show-weather-glyphs': 'weather',
  'show-aurora': 'aurora',
  'show-field-lines': 'fieldLines',
  'show-bodies': 'bodies',
};

function applyLayerEpistemicTitles() {
  for (const [id, key] of Object.entries(LAYER_TOGGLE_MAP)) {
    const input = document.getElementById(id);
    const epi = LAYER_EPISTEMICS[key];
    if (!input || !epi) continue;
    const label = input.closest('label');
    const meta = EPISTEMIC[epi];
    if (label && meta) label.title = `${meta.title} (${meta.label})`;
  }
}

function updateLegend() {
  const legend = document.getElementById('legend');
  if (!legend) return;
  legend.innerHTML = renderLegendHtml(state.view, state.quakeMinMag);
}

function applyViewCanvasVisibility(now = performance.now()) {
  const geoCanvas = document.getElementById('geo-canvas');
  const helioCanvas = document.getElementById('helio-canvas');

  if (!viewTransition) {
    geoCanvas.classList.toggle('scene-canvas--hidden', state.view !== 'geocentric');
    helioCanvas.classList.toggle('scene-canvas--hidden', state.view !== 'heliocentric');
    geoCanvas.style.opacity = state.view === 'geocentric' ? '1' : '';
    helioCanvas.style.opacity = state.view === 'heliocentric' ? '1' : '';
    return;
  }

  const { done, outgoingOpacity, incomingOpacity } = updateViewTransition(viewTransition, now);
  const outgoing = viewTransition.fromView;

  geoCanvas.classList.remove('scene-canvas--hidden');
  helioCanvas.classList.remove('scene-canvas--hidden');

  if (outgoing === 'geocentric') {
    geoCanvas.style.opacity = String(outgoingOpacity);
    helioCanvas.style.opacity = String(incomingOpacity);
  } else {
    helioCanvas.style.opacity = String(outgoingOpacity);
    geoCanvas.style.opacity = String(incomingOpacity);
  }

  if (done) {
    viewTransition = null;
    applyViewCanvasVisibility(now);
  }
}

function setView(view) {
  if (view === state.view) return;

  viewTransition = createViewTransition(state.view, view);
  state.view = view;

  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('view-btn--active', btn.dataset.view === view);
  });
  document.getElementById('show-bodies').closest('label').style.display =
    view === 'geocentric' ? '' : 'none';
  const diurnalEl = document.getElementById('diurnal-mode');
  if (diurnalEl) diurnalEl.closest('label').style.display = view === 'geocentric' ? '' : 'none';
  document.getElementById('show-moon-label').style.display =
    view === 'heliocentric' ? '' : 'none';
  document.getElementById('show-cme-label').style.display =
    view === 'heliocentric' ? '' : 'none';
  geocentricScene.setLabelsVisible?.(false);
  heliocentricScene.setLabelsVisible(view === 'heliocentric');

  const incomingScene = view === 'heliocentric' ? heliocentricScene : geocentricScene;
  incomingScene.beginViewEntry?.();

  updateLegend();
  updateUI();
  activeScene().handleResize();
  applyViewCanvasVisibility();
}

async function updateUI() {
  const scene = activeScene();
  const date = state.dates[state.currentIndex];
  if (!date) return;

  updateEventsPanelMeta(date);

  const frame = await loadFrame(state.catalog, date, state.currentIndex, {
    recentOnly: state.recentOnly,
  });
  const { record, eopWindow, ephemerisDay, ephemerisForChart } = frame;

  const quakes = visibleEarthquakes(frame.earthquakes);

  const layerCounts = {
    quakes: quakes.length,
    eruptions: frame.eruptions?.length ?? 0,
    cyclones: frame.cyclones?.length ?? 0,
    weather: frame.weather?.length ?? 0,
    storms: frame.storms?.length ?? 0,
  };
  updateEventsPanelMeta(date, layerCounts);
  updateLayerChipLabels(layerCounts, {
    geomagContext: hasGeomagContext(frame.geomagnetic, frame.spaceWeather),
    magnetometers: frame.magnetometers?.length ?? 0,
  });

  state.cachedFrame = frame;
  state.cachedDate = date;

  document.getElementById('date-display').textContent = formatDate(date);
  timelineSlider?.update(state.currentIndex);

  applyEventLayers(frame, date);

  let ovationMode = false;
  let ovationLat = null;
  if (isOvationCurrent(date)) {
    try {
      state.ovationData = await fetchOvation();
      ovationMode = !!state.ovationData?.coordinates?.length;
      ovationLat = ovationMode ? ovationEquatorwardEdge(state.ovationData) : null;
    } catch {
      state.ovationData = null;
    }
  } else {
    state.ovationData = null;
  }

  if (state.view === 'geocentric') {
    const nextEphemeris = await loadNextEphemeris(state.catalog, date);
    geocentricScene.setDiurnalMode(state.diurnalMode);
    geocentricScene.setDiurnalPhase(state.playing ? state.dayAccumulator : 0);
    geocentricScene.setDiurnalTargets(ephemerisDay, nextEphemeris);
    geocentricScene.setMagnetometers(frame.magnetometers || [], frame.geomagnetic, {
      spaceWeather: frame.spaceWeather,
      magneticPoles: frame.magneticPoles,
    });
    geocentricScene.setSpaceWeather(frame.geomagnetic, { ovationData: state.ovationData });
  } else {
    heliocentricScene.updateHeliocentric(ephemerisDay, frame.ephemerisOrbit || []);
  }

  if (!record) return;

  state.eopSeries = eopWindow;
  scene.updatePoleMotion(record, eopWindow);

  try {
    const chartIndex = eopWindow.length - 1;
    drawPolhode(document.getElementById('polhode-chart'), eopWindow, chartIndex);
    drawLodChart(document.getElementById('lod-chart'), eopWindow, chartIndex, {
      aamWindow: frame.aamWindow,
    });

    if (ephemerisForChart) {
      drawEclipticChart(document.getElementById('ecliptic-chart'), ephemerisForChart, date);
      const helicalSource = frame.ephemerisOrbit || ephemerisForChart;
      const helicalDays = frame.ephemerisOrbit ? 365 : 90;
      drawHelicalChart(
        document.getElementById('helical-chart'),
        helicalSource,
        date,
        helicalDays,
      );
    }
    if (ephemerisDay) {
      renderOrbitalMetrics(
        document.getElementById('orbital-metrics'),
        { byDate: { [date]: ephemerisDay } },
        date
      );
    }
    drawKpChart(
      document.getElementById('kp-chart'),
      frame.geomagneticWindow || [],
      date
    );
    drawDstChart(
      document.getElementById('dst-chart'),
      frame.geomagneticWindow || [],
      date
    );
    renderSpaceWeatherMetrics(
      document.getElementById('space-weather-metrics'),
      frame.geomagnetic,
      frame.spaceWeather,
      { ovationLat, ovationMode }
    );
    applySpaceWeatherChainHighlight(
      evaluateSpaceWeatherChain(frame, { ovationMode }),
    );
  } catch (err) {
    console.error('Chart render error:', err);
  }

  const list = document.getElementById('event-list');
  const items = [];

  if (frame.geomagnetic?.kpMax != null) {
    const g = frame.geomagnetic.gScale ? ` G${frame.geomagnetic.gScale}` : '';
    items.push(
      `<li><span class="geomag">Kp</span> ${frame.geomagnetic.kpMax.toFixed(1)}${g}${frame.geomagnetic.kpMax >= 5 ? ' — auroral activity' : ''}</li>`
    );
  }
  if (frame.geomagnetic?.dstMin != null && frame.geomagnetic.dstMin <= -30) {
    items.push(`<li><span class="dst">Dst</span> ${frame.geomagnetic.dstMin} nT</li>`);
  }
  if (frame.geomagnetic?.swSpeedKms != null) {
    const bz = frame.geomagnetic.swBzNt != null ? `, Bz ${frame.geomagnetic.swBzNt.toFixed(1)} nT` : '';
    items.push(`<li><span class="wind">Wind</span> ${frame.geomagnetic.swSpeedKms.toFixed(0)} km/s${bz}</li>`);
  }
  if (!frame.geomagnetic?.kpMax && frame.solar?.sunspot_number != null) {
    items.push(
      `<li><span class="solar">☀</span> Sunspot ${frame.solar.sunspot_number.toFixed(1)}${frame.solar.kp_max ? `, Kp ${frame.solar.kp_max.toFixed(0)}` : ''}</li>`
    );
  }

  for (const ev of (frame.spaceWeather || []).slice(0, 4)) {
    if (ev.eventType === 'CME' && ev.speed) {
      items.push(`<li><span class="cme">CME</span> ${Math.round(ev.speed)} km/s</li>`);
    } else if (ev.eventType === 'GST') {
      items.push(`<li><span class="gst">Storm</span> ${ev.magnitude || `Kp ${ev.kpPeak?.toFixed(1) ?? '—'}`}</li>`);
    } else if (ev.eventType === 'FLR' && /^[XM]/i.test(ev.magnitude || '')) {
      items.push(`<li><span class="flare">${ev.magnitude}</span> flare ${ev.sourceLocation || ''}</li>`);
    }
  }

  if (ephemerisDay?.lunar) {
    const l = ephemerisDay.lunar;
    const tags = [];
    if (l.syzygy) tags.push(l.syzygy === 'new' ? 'New Moon' : 'Full Moon');
    if (l.isPerigee) tags.push('Perigee');
    if (ephemerisDay.alignments?.length) {
      tags.push(`${ephemerisDay.alignments[0].planets.join('/')} ${ephemerisDay.alignments[0].separationDeg.toFixed(0)}°`);
    }
    items.push(
      `<li><span class="orbital">☽</span> ${l.phaseName}, ${l.moonDistanceKm?.toLocaleString()} km${tags.length ? ` — ${tags.join(', ')}` : ''}</li>`
    );
  }

  for (const s of (frame.storms || []).slice(0, 4)) {
    items.push(
      `<li><span class="storm">${s.eventType}</span> ${s.state || ''} ${s.magnitude ? `(${s.magnitude})` : ''}</li>`
    );
  }

  for (const c of (frame.cyclones || []).slice(0, 4)) {
    const wind = c.maxWindKts != null ? `${Math.round(c.maxWindKts)} kt` : '—';
    items.push(
      `<li><span class="cyclone">${c.name || 'Cyclone'}</span> ${c.basin || ''} ${c.season || ''} · ${wind}</li>`
    );
  }

  for (const w of (frame.weather || []).slice(0, 3)) {
    items.push(
      `<li><span class="weather">${w.label}</span> ${w.tempMaxC?.toFixed(0)}°C, wind ${w.windMaxKmh?.toFixed(0)} km/h</li>`
    );
  }

  for (const q of quakes.slice(0, 6)) {
    items.push(
      `<li><span class="mag">M${q.mag?.toFixed(1)}</span> ${q.place} — <a href="${q.url}" target="_blank" rel="noopener">USGS</a></li>`
    );
  }
  for (const v of frame.eruptions.slice(0, 4)) {
    const status = v.continuing
      ? `ongoing since ${v.startDate || '—'}`
      : `${v.startDate || '—'} → ${v.endDate || '—'}`;
    items.push(
      `<li><span class="vei">GVP VEI ${v.vei ?? '—'}</span> ${v.name} <span class="event-range">(${status})</span></li>`
    );
  }

  const magNote = state.quakeMinMag > 5 ? ` at M≥${state.quakeMinMag}` : '';
  list.innerHTML = items.length
    ? items.join('')
    : `<li class="empty">No events in ${state.recentOnly ? 'past 7 days' : 'window'}${magNote}</li>`;
}

function applyLayerPreset(presetId) {
  const preset = LAYER_PRESETS[presetId];
  if (!preset) return;

  const set = (id, checked) => {
    const el = document.getElementById(id);
    if (el) el.checked = checked;
  };

  set('show-quakes', preset.quakes);
  set('show-volcanoes', preset.volcanoes);
  set('show-spin-pole', preset.spinPole ?? true);
  set('show-trail', preset.trail);
  set('show-plates', preset.plates);
  set('show-plate-motion', preset.plateMotion);
  set('show-hotspots', preset.hotspots);
  set('show-aurora', preset.aurora);
  set('show-field-lines', preset.fieldLines);
  set('show-bodies', preset.bodies);
  set('show-moon', preset.moon);
  set('show-cyclones', preset.cyclones ?? true);
  set('show-weather-glyphs', preset.weather ?? true);

  geocentricScene.showQuakes = preset.quakes;
  geocentricScene.showVolcanoes = preset.volcanoes;
  geocentricScene.setSpinPoleVisible(preset.spinPole ?? true);
  geocentricScene.setTrailVisible(preset.trail);
  geocentricScene.setPlatesVisible(preset.plates);
  geocentricScene.setPlateMotionVisible(preset.plateMotion);
  geocentricScene.setHotspotsVisible(preset.hotspots);
  geocentricScene.showAurora = preset.aurora;
  geocentricScene.showFieldLines = preset.fieldLines;
  geocentricScene.refreshGeomagLayer(geocentricScene.lastGeomagnetic);
  geocentricScene.showBodies = preset.bodies;
  geocentricScene.setCyclonesVisible(preset.cyclones ?? true);
  geocentricScene.setWeatherVisible(preset.weather ?? true);
  heliocentricScene.showQuakes = preset.quakes;
  heliocentricScene.showVolcanoes = preset.volcanoes;
  heliocentricScene.setSpinPoleVisible(preset.spinPole ?? true);
  heliocentricScene.setTrailVisible(preset.trail);
  heliocentricScene.showAurora = preset.aurora;
  heliocentricScene.showFieldLines = preset.fieldLines;
  heliocentricScene.showMoon = preset.moon;

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.classList.toggle('preset-btn--active', btn.dataset.preset === presetId);
  });

  updateUI();
}

function setupControls() {
  const slider = document.getElementById('time-slider');
  const playBtn = document.getElementById('play-btn');
  const speedSelect = document.getElementById('speed-select');
  const dayLengthSelect = document.getElementById('day-length-select');

  slider.min = 0;
  slider.max = state.dates.length - 1;
  slider.setAttribute('aria-valuemax', String(state.dates.length - 1));
  document.getElementById('start-label').textContent = state.dates[0]?.slice(0, 4) || '1962';
  document.getElementById('end-label').textContent = state.dates.at(-1)?.slice(0, 4) || '2026';

  timelineSlider = createTimelineSlider({
    dates: state.dates,
    slider,
    ticksEl: document.getElementById('timeline-ticks'),
    fillEl: document.getElementById('timeline-fill'),
    dateEl: document.getElementById('scrub-date'),
    metaEl: document.getElementById('scrub-meta'),
  });
  timelineSlider.update(state.currentIndex);

  slider.addEventListener('input', () => {
    state.currentIndex = parseInt(slider.value, 10);
    state.dayAccumulator = 0;
    geocentricScene?.setDiurnalPhase(0);
    timelineSlider.update(state.currentIndex);
    updateUI();
  });

  playBtn.addEventListener('click', () => {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? '⏸' : '▶';
  });

  speedSelect.addEventListener('change', () => {
    state.speed = parseFloat(speedSelect.value);
  });

  if (dayLengthSelect) {
    dayLengthSelect.value = String(state.dayLengthMs);
    dayLengthSelect.addEventListener('change', () => {
      state.dayLengthMs = parseInt(dayLengthSelect.value, 10) || 60_000;
    });
  }

  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  document.querySelectorAll('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLayerPreset(btn.dataset.preset));
  });

  const recentOnlyEl = document.getElementById('recent-only');
  if (recentOnlyEl) {
    recentOnlyEl.checked = state.recentOnly;
    recentOnlyEl.addEventListener('change', (e) => {
      state.recentOnly = e.target.checked;
      updateEventsPanelMeta(state.dates[state.currentIndex]);
      updateUI();
    });
  }

  const quakeMagEl = document.getElementById('quake-min-mag');
  if (quakeMagEl) {
    quakeMagEl.value = String(state.quakeMinMag);
    quakeMagEl.addEventListener('change', (e) => {
      state.quakeMinMag = parseInt(e.target.value, 10) || 5;
      updateLegend();
      updateUI();
    });
  }

  const sync = (id, prop) => {
    document.getElementById(id).addEventListener('change', (e) => {
      geocentricScene[prop] = e.target.checked;
      heliocentricScene[prop] = e.target.checked;
      updateUI();
    });
  };
  sync('show-quakes', 'showQuakes');
  sync('show-volcanoes', 'showVolcanoes');

  document.getElementById('show-spin-pole').addEventListener('change', (e) => {
    geocentricScene.setSpinPoleVisible(e.target.checked);
    heliocentricScene.setSpinPoleVisible(e.target.checked);
  });

  document.getElementById('show-trail').addEventListener('change', (e) => {
    geocentricScene.setTrailVisible(e.target.checked);
    heliocentricScene.setTrailVisible(e.target.checked);
  });

  document.getElementById('show-plates').addEventListener('change', (e) => {
    geocentricScene.setPlatesVisible(e.target.checked);
  });
  document.getElementById('show-hotspots').addEventListener('change', (e) => {
    geocentricScene.setHotspotsVisible(e.target.checked);
  });
  document.getElementById('show-plate-motion').addEventListener('change', (e) => {
    geocentricScene.setPlateMotionVisible(e.target.checked);
  });

  document.getElementById('show-aurora').addEventListener('change', (e) => {
    geocentricScene.showAurora = e.target.checked;
    updateUI();
  });
  document.getElementById('show-field-lines').addEventListener('change', (e) => {
    geocentricScene.showFieldLines = e.target.checked;
    geocentricScene.refreshGeomagLayer(geocentricScene.lastGeomagnetic);
    if (state.cachedFrame) {
      updateLayerChipLabels(
        {
          cyclones: state.cachedFrame.cyclones?.length ?? 0,
          weather: state.cachedFrame.weather?.length ?? 0,
        },
        {
          geomagContext: hasGeomagContext(
            state.cachedFrame.geomagnetic,
            state.cachedFrame.spaceWeather,
          ),
          magnetometers: state.cachedFrame.magnetometers?.length ?? 0,
        },
      );
    }
  });

  document.getElementById('show-bodies').addEventListener('change', (e) => {
    geocentricScene.showBodies = e.target.checked;
    updateUI();
  });

  const diurnalModeEl = document.getElementById('diurnal-mode');
  if (diurnalModeEl) {
    diurnalModeEl.value = state.diurnalMode;
    diurnalModeEl.addEventListener('change', (e) => {
      state.diurnalMode = e.target.value;
      geocentricScene.setDiurnalMode(state.diurnalMode);
      updateUI();
    });
  }
  document.getElementById('show-moon').addEventListener('change', (e) => {
    heliocentricScene.showMoon = e.target.checked;
    updateUI();
  });
  document.getElementById('show-cme').addEventListener('change', (e) => {
    heliocentricScene.showCme = e.target.checked;
    updateUI();
  });

  document.getElementById('show-cyclones').addEventListener('change', (e) => {
    geocentricScene.setCyclonesVisible(e.target.checked);
    reapplyEventLayersFromCache();
  });
  document.getElementById('show-weather-glyphs').addEventListener('change', (e) => {
    geocentricScene.setWeatherVisible(e.target.checked);
    reapplyEventLayersFromCache();
  });
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  const delta = timestamp - state.lastFrame;
  state.lastFrame = timestamp;

  if (state.playing && delta > 0) {
    state.dayAccumulator += (delta / state.dayLengthMs) * state.speed;
    while (state.dayAccumulator >= 1) {
      state.dayAccumulator -= 1;
      if (state.currentIndex < state.dates.length - 1) {
        state.currentIndex++;
        geocentricScene.triggerDayPulse?.();
        heliocentricScene.triggerDayPulse?.();
        updateUI();
      } else {
        state.playing = false;
        document.getElementById('play-btn').textContent = '▶';
      }
    }
  }

  applyViewCanvasVisibility(timestamp);

  if (state.view === 'geocentric' && geocentricScene) {
    geocentricScene.setDiurnalPhase(state.playing ? state.dayAccumulator : 0);
  }

  if (viewTransition) {
    geocentricScene.render(delta);
    heliocentricScene.render(delta);
  } else {
    activeScene().render(delta);
  }
}

async function main() {
  try {
    state.catalog = await loadCatalog();
    state.dates = state.catalog.dates;
    state.currentIndex = Math.max(0, state.dates.length - 1);
  } catch (err) {
    document.getElementById('date-display').textContent = 'Run npm run ingest';
    console.error(err);
    return;
  }

  geocentricScene = await new EarthScene(document.getElementById('geo-canvas')).ready;
  heliocentricScene = await new HeliocentricScene(document.getElementById('helio-canvas')).ready;

  const modeBadge = document.getElementById('mode-badge');
  if (modeBadge) {
    modeBadge.textContent = state.catalog.mode === 'api' ? 'API' : 'JSON';
    modeBadge.title = state.catalog.mode === 'api' ? 'SQLite API backend' : 'Static JSON fallback';
    modeBadge.hidden = false;
  }

  renderEventInspect(
    document.getElementById('event-inspect'),
    null,
    getGlobeInspectContext(geocentricScene),
  );

  renderCitations();
  renderPanelEpistemics();
  renderStalenessChips(state.catalog?.manifest);
  applyLayerEpistemicTitles();
  bindLegendHelp(
    document.getElementById('legend'),
    document.getElementById('legend-help'),
  );
  setupControls();
  setupGlobePick();
  applyLayerPreset('full');
  updateLegend();
  updateUI();
  requestAnimationFrame(animate);
}

function setupGlobePick() {
  const canvas = document.getElementById('geo-canvas');
  const tooltip = document.getElementById('plate-tooltip');
  canvas.classList.add('scene-canvas--pickable');

  const inspectContext = () => getGlobeInspectContext(geocentricScene);

  canvas.addEventListener('click', (e) => {
    if (state.view !== 'geocentric') return;
    const picked = geocentricScene.pickAt(e.clientX, e.clientY);
    renderEventInspect(document.getElementById('event-inspect'), picked, inspectContext());
  });

  canvas.addEventListener('mousemove', (e) => {
    if (state.view !== 'geocentric') {
      tooltip.classList.add('plate-tooltip--hidden');
      return;
    }

    const hover = geocentricScene.hoverPickAt(e.clientX, e.clientY);
    const rendered = renderGlobeTooltip(hover);
    if (!rendered) {
      tooltip.classList.add('plate-tooltip--hidden');
      return;
    }

    tooltip.classList.remove('plate-tooltip--hidden');
    tooltip.className = `plate-tooltip ${rendered.className}`;
    tooltip.style.left = `${hover.x}px`;
    tooltip.style.top = `${hover.y}px`;
    tooltip.innerHTML = rendered.html;
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.classList.add('plate-tooltip--hidden');
  });
}

main();