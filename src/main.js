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
  renderAsOfChips,
  renderCitationsList,
  renderPanelEpistemics,
  renderStalenessChips,
} from './epistemics.js';
import { bindLegendHelp, renderLegendHtml } from './legend-help.js';
import { buildLayerPresets } from './layers/ui-registry.mjs';
import {
  applyEpistemicTitles,
  applyPresetToScenes,
  renderLayerChips,
  wireLayerToggles,
} from './layers/layer-ui.mjs';
import { allLayerUi } from './layers/ui-registry.mjs';
import { createTimelineSlider } from './timeline-slider.js';
import { createViewTransition, updateViewTransition } from './view-transition.js';
import { setDomRoot, $id, $, $$ } from './dom-scope.js';

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
  earthOpacity: 1,
  cachedFrame: null,
  cachedDate: null,
};

const EARTH_OPACITY_KEY = 'wobblescope-earth-opacity';

function formatEarthOpacityLabel(opacity) {
  const pct = Math.round(opacity * 100);
  if (pct >= 98) return 'Solid';
  if (pct <= 40) return 'X-ray';
  return `Hybrid ${pct}%`;
}

function applyEarthOpacity(opacity, { persist = true } = {}) {
  const clamped = Math.max(0.12, Math.min(1, opacity));
  state.earthOpacity = clamped;
  geocentricScene?.setEarthOpacity(clamped);

  const slider = $id('earth-opacity');
  const label = $id('earth-opacity-label');
  if (slider) {
    slider.value = String(Math.round(clamped * 100));
    slider.setAttribute('aria-valuenow', String(Math.round(clamped * 100)));
  }
  if (label) label.textContent = formatEarthOpacityLabel(clamped);
  if (persist) {
    try {
      localStorage.setItem(EARTH_OPACITY_KEY, String(clamped));
    } catch {
      /* ignore */
    }
  }
}

let geocentricScene = null;
let heliocentricScene = null;
let viewTransition = null;
let timelineSlider = null;

function formatPlaybackRate(dayLengthMs, speed) {
  const ms = dayLengthMs / speed;
  if (ms >= 86_400_000) {
    const days = ms / 86_400_000;
    return days >= 10 ? `${Math.round(days)}d/sim day` : `${days.toFixed(1)}d/sim day`;
  }
  if (ms >= 3_600_000) {
    const hours = ms / 3_600_000;
    return hours >= 10 ? `${Math.round(hours)}h/sim day` : `${hours.toFixed(1)}h/sim day`;
  }
  if (ms >= 60_000) {
    const minutes = ms / 60_000;
    return minutes >= 10 ? `${Math.round(minutes)}m/sim day` : `${minutes.toFixed(1)}m/sim day`;
  }
  if (ms >= 1000) return `${Math.round(ms / 1000)}s/sim day`;
  return `${Math.round(ms)}ms/sim day`;
}

function playbackMetaSuffix() {
  if (!state.playing) return '';
  let suffix = ` · ${formatPlaybackRate(state.dayLengthMs, state.speed)}`;
  if (state.dayAccumulator > 0.001) {
    suffix += ` · +${Math.round(state.dayAccumulator * 100)}% day`;
  }
  return suffix;
}

function setDiurnalMode(mode) {
  state.diurnalMode = mode === 'free' ? 'free' : 'sync';
  $$('[data-diurnal]').forEach((btn) => {
    btn.classList.toggle('segmented__btn--active', btn.dataset.diurnal === state.diurnalMode);
  });
  geocentricScene?.setDiurnalMode(state.diurnalMode);
}

const LAYER_PRESETS = buildLayerPresets();

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
  const eventsTitle = $id('events-panel-title');
  const eventsDesc = $id('events-panel-desc');
  const recentEl = $id('recent-only');
  const recentLabel = $id('recent-only-label');
  const filterLabel = $('.filter-label');

  if (recentEl) recentEl.checked = state.recentOnly;
  filterLabel?.classList.toggle('filter-label--active', state.recentOnly);

  const tally = formatGlobeTally(counts);
  if (recentLabel) {
    recentLabel.textContent = state.recentOnly ? '7d' : '±7d';
  }

  const footerTally = $id('footer-tally');
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
    const chip = $id(chipId);
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

  for (const layer of allLayerUi()) {
    if (!layer.ui.countKey || !layer.ui.chipId) continue;
    let n = counts[layer.ui.countKey] ?? 0;
    if (layer.ui.countKey === 'radar' && geocentricScene && !geocentricScene.showRadar) {
      n = 0;
    }
    setChip(layer.ui.chipId, layer.ui.chipLabel, n);
  }

  const geomagChip = $id('chip-geomag');
  if (geomagChip) {
    const span = geomagChip.querySelector('span');
    const on = $id('show-field-lines')?.checked;
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

function updateLegend() {
  const legend = $id('legend');
  if (!legend) return;
  legend.innerHTML = renderLegendHtml(state.view, state.quakeMinMag);
}

function applyViewCanvasVisibility(now = performance.now()) {
  const geoCanvas = $id('geo-canvas');
  const helioCanvas = $id('helio-canvas');

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

  $$('.view-btn').forEach((btn) => {
    btn.classList.toggle('view-btn--active', btn.dataset.view === view);
  });
  const geoMotionGroup = $id('geo-motion-group');
  if (geoMotionGroup) geoMotionGroup.style.display = view === 'geocentric' ? '' : 'none';
  $id('show-moon-label').style.display =
    view === 'heliocentric' ? '' : 'none';
  $id('show-cme-label').style.display =
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
    radar: geocentricScene?.showRadar ? geocentricScene.getRadarSiteCount() : 0,
    storms: frame.storms?.length ?? 0,
  };
  updateEventsPanelMeta(date, layerCounts);
  updateLayerChipLabels(layerCounts, {
    geomagContext: hasGeomagContext(frame.geomagnetic, frame.spaceWeather),
    magnetometers: frame.magnetometers?.length ?? 0,
  });

  state.cachedFrame = frame;
  state.cachedDate = date;

  $id('date-display').textContent = formatDate(date);
  renderAsOfChips(frame.requestedDate || date, frame.asOf, frame.coverage);
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
    drawPolhode($id('polhode-chart'), eopWindow, chartIndex);
    drawLodChart($id('lod-chart'), eopWindow, chartIndex, {
      aamWindow: frame.aamWindow,
    });

    if (ephemerisForChart) {
      drawEclipticChart($id('ecliptic-chart'), ephemerisForChart, date);
      const helicalSource = frame.ephemerisOrbit || ephemerisForChart;
      const helicalDays = frame.ephemerisOrbit ? 365 : 90;
      drawHelicalChart(
        $id('helical-chart'),
        helicalSource,
        date,
        helicalDays,
      );
    }
    if (ephemerisDay) {
      renderOrbitalMetrics(
        $id('orbital-metrics'),
        { byDate: { [date]: ephemerisDay } },
        date
      );
    }
    drawKpChart(
      $id('kp-chart'),
      frame.geomagneticWindow || [],
      date
    );
    drawDstChart(
      $id('dst-chart'),
      frame.geomagneticWindow || [],
      date
    );
    renderSpaceWeatherMetrics(
      $id('space-weather-metrics'),
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

  const list = $id('event-list');
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

  applyPresetToScenes(preset, geocentricScene, heliocentricScene);

  $$('.preset-btn').forEach((btn) => {
    btn.classList.toggle('preset-btn--active', btn.dataset.preset === presetId);
  });

  updateUI();
}

function setupControls() {
  const slider = $id('time-slider');
  const playBtn = $id('play-btn');
  const speedSelect = $id('speed-select');
  const dayLengthSelect = $id('day-length-select');

  slider.min = 0;
  slider.max = state.dates.length - 1;
  slider.setAttribute('aria-valuemax', String(state.dates.length - 1));
  $id('start-label').textContent = state.dates[0]?.slice(0, 4) || '1962';
  $id('end-label').textContent = state.dates.at(-1)?.slice(0, 4) || '2026';

  timelineSlider = createTimelineSlider({
    dates: state.dates,
    slider,
    ticksEl: $id('timeline-ticks'),
    fillEl: $id('timeline-fill'),
    dateEl: $id('scrub-date'),
    metaEl: $id('scrub-meta'),
  });
  timelineSlider.setMetaSuffix(playbackMetaSuffix);
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
    timelineSlider?.refreshMeta();
  });

  speedSelect.addEventListener('change', () => {
    state.speed = parseFloat(speedSelect.value);
    timelineSlider?.refreshMeta();
  });

  if (dayLengthSelect) {
    dayLengthSelect.value = String(state.dayLengthMs);
    dayLengthSelect.addEventListener('change', () => {
      state.dayLengthMs = parseInt(dayLengthSelect.value, 10) || 60_000;
      timelineSlider?.refreshMeta();
    });
  }

  $$('.view-btn').forEach((btn) => {
    btn.addEventListener('click', () => setView(btn.dataset.view));
  });

  $$('.preset-btn').forEach((btn) => {
    btn.addEventListener('click', () => applyLayerPreset(btn.dataset.preset));
  });

  const recentOnlyEl = $id('recent-only');
  if (recentOnlyEl) {
    recentOnlyEl.checked = state.recentOnly;
    recentOnlyEl.addEventListener('change', (e) => {
      state.recentOnly = e.target.checked;
      updateEventsPanelMeta(state.dates[state.currentIndex]);
      updateUI();
    });
  }

  const quakeMagEl = $id('quake-min-mag');
  if (quakeMagEl) {
    quakeMagEl.value = String(state.quakeMinMag);
    quakeMagEl.addEventListener('change', (e) => {
      state.quakeMinMag = parseInt(e.target.value, 10) || 5;
      updateLegend();
      updateUI();
    });
  }

  wireLayerToggles({
    geocentricScene,
    heliocentricScene,
    getView: () => state.view,
    onReapplyEvents: reapplyEventLayersFromCache,
    onUpdateUI: updateUI,
    onGeomagChips: () => {
      if (!state.cachedFrame) return;
      updateLayerChipLabels(
        {
          cyclones: state.cachedFrame.cyclones?.length ?? 0,
          weather: state.cachedFrame.weather?.length ?? 0,
          radar: geocentricScene.showRadar ? geocentricScene.getRadarSiteCount() : 0,
        },
        {
          geomagContext: hasGeomagContext(
            state.cachedFrame.geomagnetic,
            state.cachedFrame.spaceWeather,
          ),
          magnetometers: state.cachedFrame.magnetometers?.length ?? 0,
        },
      );
    },
    onUpdateChipCounts: () => {
      updateLayerChipLabels(
        {
          cyclones: state.cachedFrame?.cyclones?.length ?? 0,
          weather: state.cachedFrame?.weather?.length ?? 0,
          radar: geocentricScene.showRadar ? geocentricScene.getRadarSiteCount() : 0,
        },
        {
          geomagContext: hasGeomagContext(
            state.cachedFrame?.geomagnetic,
            state.cachedFrame?.spaceWeather,
          ),
          magnetometers: state.cachedFrame?.magnetometers?.length ?? 0,
        },
      );
    },
  });

  $$('[data-diurnal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setDiurnalMode(btn.dataset.diurnal);
      updateUI();
    });
  });
  setDiurnalMode(state.diurnalMode);
  const earthOpacityEl = $id('earth-opacity');
  if (earthOpacityEl) {
    let savedOpacity = 1;
    try {
      const raw = localStorage.getItem(EARTH_OPACITY_KEY);
      if (raw != null) {
        const parsed = parseFloat(raw);
        if (Number.isFinite(parsed)) {
          savedOpacity = Math.max(0.12, Math.min(1, parsed));
          // Reset persisted "x-ray" values that made the globe read as nearly transparent.
          if (savedOpacity < 0.5) savedOpacity = 1;
        }
      }
    } catch {
      /* ignore */
    }
    applyEarthOpacity(savedOpacity, { persist: true });
    earthOpacityEl.addEventListener('input', (e) => {
      applyEarthOpacity(parseInt(e.target.value, 10) / 100);
    });
  }

  $id('fly-home-btn')?.addEventListener('click', () => {
    if (state.view !== 'geocentric') return;
    geocentricScene?.flyToHome({ animate: true });
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
        $id('play-btn').textContent = '▶';
      }
    }
  }

  applyViewCanvasVisibility(timestamp);

  if (state.view === 'geocentric' && geocentricScene) {
    geocentricScene.setDiurnalPhase(state.playing ? state.dayAccumulator : 0);
  }

  if (state.playing) {
    timelineSlider?.refreshMeta();
  }

  if (viewTransition) {
    geocentricScene.render(delta);
    heliocentricScene.render(delta);
  } else {
    activeScene().render(delta);
  }
}

function showBootstrapGate(catalog, err) {
  const gate = $id('bootstrap-gate');
  const desc = $id('bootstrap-desc');
  const app = $id('app');
  if (!gate) return;

  if (catalog?.mode === 'api') {
    const count = catalog.manifest?.eop?.count ?? 0;
    desc.textContent = count === 0
      ? 'The API is running but the SQLite database has no EOP rows yet. Fetch remote datasets, ingest into data/ecdo.db, then retry.'
      : 'The API returned an empty timeline. Re-run ingest and ensure data/ecdo.db is populated.';
  } else if (err) {
    desc.textContent = 'Could not load catalog data from the API or static JSON fallback. Fetch and ingest local data, then start the dev stack.';
  } else {
    desc.textContent = 'Static JSON fallback has no EOP dates. Run fetch-data and ingest, or start the API after ingest.';
  }

  gate.classList.remove('bootstrap-gate--hidden');
  app?.classList.add('app--gated');
  $id('date-display').textContent = 'No data';
}

function setupBootstrapRetry() {
  const retryBtn = $id('bootstrap-retry');
  if (!retryBtn || retryBtn.dataset.bound) return;
  retryBtn.dataset.bound = '1';
  retryBtn.addEventListener('click', () => window.location.reload());
}

function seedStateFromDataset(root) {
  const { date, view } = root?.dataset ?? {};
  if (view === 'heliocentric' || view === 'geocentric') state.view = view;
  if (date) state.initialDate = date;
}

export default async function mountWeatherly(root) {
  root.classList.add('weatherly');
  setDomRoot(root);
  seedStateFromDataset(root);

  try {
    state.catalog = await loadCatalog();
    state.dates = state.catalog.dates || [];
  } catch (err) {
    console.error(err);
    showBootstrapGate(null, err);
    setupBootstrapRetry();
    return;
  }

  if (!state.dates.length) {
    showBootstrapGate(state.catalog);
    setupBootstrapRetry();
    return;
  }

  if (state.initialDate) {
    const idx = state.dates.indexOf(state.initialDate);
    if (idx >= 0) state.currentIndex = idx;
    delete state.initialDate;
  } else {
    state.currentIndex = Math.max(0, state.dates.length - 1);
  }

  geocentricScene = await new EarthScene($id('geo-canvas')).ready;
  heliocentricScene = await new HeliocentricScene($id('helio-canvas')).ready;

  const modeBadge = $id('mode-badge');
  if (modeBadge) {
    modeBadge.textContent = state.catalog.mode === 'api' ? 'API' : 'JSON';
    modeBadge.title = state.catalog.mode === 'api' ? 'SQLite API backend' : 'Static JSON fallback';
    modeBadge.hidden = false;
  }

  renderEventInspect(
    $id('event-inspect'),
    null,
    getGlobeInspectContext(geocentricScene),
  );

  renderCitations();
  renderPanelEpistemics();
  renderStalenessChips(state.catalog?.manifest);
  renderLayerChips();
  applyEpistemicTitles();
  bindLegendHelp(
    $id('legend'),
    $id('legend-help'),
  );
  setupControls();
  setupGlobePick();
  applyLayerPreset('atmosphere');
  const homeCfg = geocentricScene?.getHomeRegionConfig?.();
  const homeBtn = $id('fly-home-btn');
  if (homeBtn && homeCfg) {
    const mpp = homeCfg.metersPerPixel?.eastWest;
    const res = mpp ? `~${mpp} m/px` : 'hi-res';
    homeBtn.title = `Fly to ${homeCfg.name} — ${res} imagery with LiDAR hillshade on the regional patch; global shell dims while focused`;
  }
  updateLegend();
  requestAnimationFrame(animate);
}

function setupGlobePick() {
  const canvas = $id('geo-canvas');
  const tooltip = $id('plate-tooltip');
  canvas.classList.add('scene-canvas--pickable');

  const inspectContext = () => getGlobeInspectContext(geocentricScene);

  canvas.addEventListener('click', (e) => {
    if (state.view !== 'geocentric') return;
    const picked = geocentricScene.pickAt(e.clientX, e.clientY);
    renderEventInspect($id('event-inspect'), picked, inspectContext());
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

if (import.meta.env.VITE_WIDGET !== 'true') {
  setDomRoot(document.body);
  mountWeatherly(document.body);
}