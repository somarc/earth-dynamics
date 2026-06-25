import { EarthScene } from './earth.js';
import { HeliocentricScene } from './heliocentric.js';
import { drawPolhode, drawLodChart } from './charts.js';
import { drawEclipticChart, renderOrbitalMetrics } from './ephemeris.js';
import { drawKpChart, drawDstChart, renderSpaceWeatherMetrics } from './space-weather.js';
import { fetchOvation, isOvationCurrent, ovationEquatorwardEdge } from './ovation.js';
import { renderEventInspect } from './event-inspect.js';
import { formatDate, addDays } from './utils.js';
import { loadCatalog, loadFrame } from './data-client.js';

const state = {
  catalog: null,
  dates: [],
  currentIndex: 0,
  playing: false,
  speed: 1,
  lastFrame: 0,
  dayAccumulator: 0,
  view: 'geocentric',
  eopSeries: [],
  ovationData: null,
  recentOnly: true,
};

let geocentricScene = null;
let heliocentricScene = null;

const LAYER_PRESETS = {
  solid: {
    label: 'Solid Earth',
    quakes: true,
    volcanoes: true,
    trail: true,
    plates: true,
    plateMotion: true,
    hotspots: true,
    aurora: false,
    fieldLines: false,
    bodies: true,
    moon: true,
  },
  space: {
    label: 'Space Weather',
    quakes: false,
    volcanoes: false,
    trail: true,
    plates: false,
    plateMotion: false,
    hotspots: false,
    aurora: true,
    fieldLines: true,
    bodies: false,
    moon: false,
  },
  orbital: {
    label: 'Orbital',
    quakes: false,
    volcanoes: false,
    trail: true,
    plates: false,
    plateMotion: false,
    hotspots: false,
    aurora: false,
    fieldLines: false,
    bodies: true,
    moon: true,
  },
  full: {
    label: 'Full stack',
    quakes: true,
    volcanoes: true,
    trail: true,
    plates: true,
    plateMotion: true,
    hotspots: true,
    aurora: true,
    fieldLines: true,
    bodies: true,
    moon: true,
  },
};

function activeScene() {
  return state.view === 'heliocentric' ? heliocentricScene : geocentricScene;
}

function updateEventsPanelMeta(date, counts = null) {
  const eventsTitle = document.getElementById('events-panel-title');
  const eventsDesc = document.getElementById('events-panel-desc');
  const recentEl = document.getElementById('recent-only');
  const filterLabel = document.querySelector('.filter-label');

  if (recentEl) recentEl.checked = state.recentOnly;
  filterLabel?.classList.toggle('filter-label--active', state.recentOnly);

  if (!eventsTitle || !eventsDesc) return;

  if (state.recentOnly) {
    eventsTitle.textContent = 'Events (past 7 days)';
    const range = date ? `${addDays(date, -7)} → ${date}` : 'past 7 days';
    const tally = counts
      ? `${counts.quakes} quake${counts.quakes === 1 ? '' : 's'}`
        + `${counts.storms ? `, ${counts.storms} storm${counts.storms === 1 ? '' : 's'}` : ''}`
      : 'loading…';
    eventsDesc.textContent = `${range} — ${tally}`;
  } else {
    eventsTitle.textContent = 'Events at Date';
    const tally = counts
      ? `${counts.quakes} quake${counts.quakes === 1 ? '' : 's'} (±7d)`
      : '±7 day windows around selected date';
    eventsDesc.textContent = tally;
  }
}

function applyEventLayers(frame, date) {
  geocentricScene.setEarthquakes(frame.earthquakes);
  geocentricScene.setVolcanoes(frame.eruptions);
  heliocentricScene.setEarthquakes(frame.earthquakes);
  heliocentricScene.setVolcanoes(frame.eruptions);
  heliocentricScene.setCmeEvents(frame.spaceWeather, date);
}

function renderCitations() {
  const el = document.getElementById('citations');
  const sources = state.catalog?.manifest?.sources || {};
  const list = Object.values(sources);
  el.innerHTML = list
    .filter((s) => s?.name)
    .map(
      (s) => `
      <li>
        <strong>${s.name}</strong><br />
        <span class="org">${s.org}</span><br />
        <a href="${s.link}" target="_blank" rel="noopener">${s.citation}</a>
      </li>`
    )
    .join('');
}

function updateLegend() {
  const legend = document.getElementById('legend');
  if (state.view === 'heliocentric') {
    legend.innerHTML = `
      <span class="legend__item legend__item--sun">☀ Sun (center)</span>
      <span class="legend__item legend__item--axis">— Spin axis (23.44° obliquity)</span>
      <span class="legend__item legend__item--ecliptic">— Ecliptic north</span>
      <span class="legend__item legend__item--pole">● Instantaneous pole</span>
      <span class="legend__item legend__item--moon">◯ Moon</span>
      <span class="legend__item legend__item--cme">▷ CME toward Earth</span>
      <span class="legend__item legend__item--quake">◉ Earthquake</span>
    `;
  } else {
    legend.innerHTML = `
      <span class="legend__item legend__item--pole">● Instantaneous pole</span>
      <span class="legend__item legend__item--axis">— Rotation axis</span>
      <span class="legend__item legend__item--quake">◉ Earthquake (M≥5)</span>
      <span class="legend__item legend__item--volcano">▲ Volcanic eruption</span>
      <span class="legend__item legend__item--storm">◈ Storm event</span>
      <span class="legend__item legend__item--moon">◯ Moon (scaled)</span>
      <span class="legend__item legend__item--sun">☀ Sun direction</span>
      <span class="legend__item legend__item--plates">— Plate boundaries</span>
      <span class="legend__item legend__item--motion">→ Plate motion (mm/yr)</span>
      <span class="legend__item legend__item--hotspot">◎ Mantle hotspot</span>
      <span class="legend__item legend__item--aurora">◌ Aurora (OVATION / Kp)</span>
      <span class="legend__item legend__item--field">⌇ Magnetic field (model)</span>
    `;
  }
}

function setView(view) {
  state.view = view;
  document.getElementById('geo-canvas').classList.toggle('scene-canvas--hidden', view !== 'geocentric');
  document.getElementById('helio-canvas').classList.toggle('scene-canvas--hidden', view !== 'heliocentric');
  document.querySelectorAll('.view-btn').forEach((btn) => {
    btn.classList.toggle('view-btn--active', btn.dataset.view === view);
  });
  document.getElementById('show-bodies').closest('label').style.display =
    view === 'geocentric' ? '' : 'none';
  document.getElementById('show-moon-label').style.display =
    view === 'heliocentric' ? '' : 'none';
  document.getElementById('show-cme-label').style.display =
    view === 'heliocentric' ? '' : 'none';
  geocentricScene.setLabelsVisible?.(false);
  heliocentricScene.setLabelsVisible(view === 'heliocentric');
  updateLegend();
  updateUI();
  activeScene().handleResize();
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

  updateEventsPanelMeta(date, {
    quakes: frame.earthquakes?.length ?? 0,
    storms: frame.storms?.length ?? 0,
  });

  document.getElementById('date-display').textContent = formatDate(date);
  document.getElementById('time-slider').value = state.currentIndex;

  applyEventLayers(frame, date);

  if (!record) return;

  state.eopSeries = eopWindow;

  scene.updatePoleMotion(record, eopWindow);
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
    geocentricScene.setSpaceWeather(frame.geomagnetic, { ovationData: state.ovationData });
    scene.updateBodies(ephemerisDay);
  } else {
    heliocentricScene.updateHeliocentric(ephemerisDay, frame.ephemerisOrbit || []);
  }

  try {
    const chartIndex = eopWindow.length - 1;
    drawPolhode(document.getElementById('polhode-chart'), eopWindow, chartIndex);
    drawLodChart(document.getElementById('lod-chart'), eopWindow, chartIndex);

    if (ephemerisForChart) {
      drawEclipticChart(document.getElementById('ecliptic-chart'), ephemerisForChart, date);
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

  for (const w of (frame.weather || []).slice(0, 3)) {
    items.push(
      `<li><span class="weather">${w.label}</span> ${w.tempMaxC?.toFixed(0)}°C, wind ${w.windMaxKmh?.toFixed(0)} km/h</li>`
    );
  }

  for (const q of frame.earthquakes.slice(0, 6)) {
    items.push(
      `<li><span class="mag">M${q.mag?.toFixed(1)}</span> ${q.place} — <a href="${q.url}" target="_blank" rel="noopener">USGS</a></li>`
    );
  }
  for (const v of frame.eruptions.slice(0, 4)) {
    const status = v.continuing ? 'ongoing' : `ended ${v.endDate || '—'}`;
    items.push(
      `<li><span class="vei">VEI ${v.vei ?? '—'}</span> ${v.name} (${status})</li>`
    );
  }

  list.innerHTML = items.length
    ? items.join('')
    : `<li class="empty">No events in ${state.recentOnly ? 'past 7 days' : 'window'}</li>`;
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
  set('show-trail', preset.trail);
  set('show-plates', preset.plates);
  set('show-plate-motion', preset.plateMotion);
  set('show-hotspots', preset.hotspots);
  set('show-aurora', preset.aurora);
  set('show-field-lines', preset.fieldLines);
  set('show-bodies', preset.bodies);
  set('show-moon', preset.moon);

  geocentricScene.showQuakes = preset.quakes;
  geocentricScene.showVolcanoes = preset.volcanoes;
  geocentricScene.showTrail = preset.trail;
  geocentricScene.setPlatesVisible(preset.plates);
  geocentricScene.setPlateMotionVisible(preset.plateMotion);
  geocentricScene.setHotspotsVisible(preset.hotspots);
  geocentricScene.showAurora = preset.aurora;
  geocentricScene.showFieldLines = preset.fieldLines;
  geocentricScene.showBodies = preset.bodies;
  heliocentricScene.showQuakes = preset.quakes;
  heliocentricScene.showVolcanoes = preset.volcanoes;
  heliocentricScene.showTrail = preset.trail;
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

  slider.min = 0;
  slider.max = state.dates.length - 1;
  slider.value = state.currentIndex;
  document.getElementById('start-label').textContent = state.dates[0]?.slice(0, 4) || '1962';
  document.getElementById('end-label').textContent = state.dates.at(-1)?.slice(0, 4) || '2026';

  slider.addEventListener('input', () => {
    state.currentIndex = parseInt(slider.value, 10);
    updateUI();
  });

  playBtn.addEventListener('click', () => {
    state.playing = !state.playing;
    playBtn.textContent = state.playing ? '⏸' : '▶';
  });

  speedSelect.addEventListener('change', () => {
    state.speed = parseFloat(speedSelect.value);
  });

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

  const sync = (id, prop) => {
    document.getElementById(id).addEventListener('change', (e) => {
      geocentricScene[prop] = e.target.checked;
      heliocentricScene[prop] = e.target.checked;
      updateUI();
    });
  };
  sync('show-quakes', 'showQuakes');
  sync('show-volcanoes', 'showVolcanoes');
  sync('show-trail', 'showTrail');

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
    updateUI();
  });

  document.getElementById('show-bodies').addEventListener('change', (e) => {
    geocentricScene.showBodies = e.target.checked;
    updateUI();
  });
  document.getElementById('show-moon').addEventListener('change', (e) => {
    heliocentricScene.showMoon = e.target.checked;
    updateUI();
  });
  document.getElementById('show-cme').addEventListener('change', (e) => {
    heliocentricScene.showCme = e.target.checked;
    updateUI();
  });
}

function animate(timestamp) {
  requestAnimationFrame(animate);
  const delta = timestamp - state.lastFrame;
  state.lastFrame = timestamp;

  if (state.playing && delta > 0) {
    state.dayAccumulator += (delta / 16) * state.speed;
    while (state.dayAccumulator >= 1) {
      state.dayAccumulator -= 1;
      if (state.currentIndex < state.dates.length - 1) {
        state.currentIndex++;
        updateUI();
      } else {
        state.playing = false;
        document.getElementById('play-btn').textContent = '▶';
      }
    }
  }
  activeScene().render(delta);
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

  const modeBadge = document.createElement('span');
  modeBadge.className = 'mode-badge';
  modeBadge.textContent = state.catalog.mode === 'api' ? 'SQLite API' : 'JSON fallback';
  document.querySelector('.header__right').prepend(modeBadge);

  renderEventInspect(document.getElementById('event-inspect'), null);

  renderCitations();
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

  canvas.addEventListener('click', (e) => {
    if (state.view !== 'geocentric') return;
    const picked = geocentricScene.pickAt(e.clientX, e.clientY);
    renderEventInspect(document.getElementById('event-inspect'), picked);
  });

  canvas.addEventListener('mousemove', (e) => {
    if (state.view !== 'geocentric') {
      tooltip.classList.add('plate-tooltip--hidden');
      return;
    }
    const hit = geocentricScene.hoverPlateAt(e.clientX, e.clientY);
    if (!hit) {
      tooltip.classList.add('plate-tooltip--hidden');
      return;
    }
    tooltip.classList.remove('plate-tooltip--hidden');
    tooltip.style.left = `${hit.x}px`;
    tooltip.style.top = `${hit.y}px`;
    tooltip.innerHTML = `
      <strong>${hit.name}</strong> (${hit.plates})<br />
      <span class="plate-type">${hit.type}</span>
    `;
  });

  canvas.addEventListener('mouseleave', () => {
    tooltip.classList.add('plate-tooltip--hidden');
  });
}

main();