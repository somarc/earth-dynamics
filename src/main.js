import { EarthScene } from './earth.js';
import { HeliocentricScene } from './heliocentric.js';
import { drawPolhode, drawLodChart } from './charts.js';
import { drawEclipticChart, renderOrbitalMetrics } from './ephemeris.js';
import { formatDate } from './utils.js';
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
};

let geocentricScene = null;
let heliocentricScene = null;

function activeScene() {
  return state.view === 'heliocentric' ? heliocentricScene : geocentricScene;
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
  updateLegend();
  updateUI();
  activeScene().handleResize();
}

async function updateUI() {
  const scene = activeScene();
  const date = state.dates[state.currentIndex];
  if (!date) return;

  const frame = await loadFrame(state.catalog, date, state.currentIndex);
  const { record, eopWindow, ephemerisDay, ephemerisForChart } = frame;
  if (!record) return;

  state.eopSeries = eopWindow;

  document.getElementById('date-display').textContent = formatDate(date);
  document.getElementById('time-slider').value = state.currentIndex;

  scene.updatePoleMotion(record, eopWindow);

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

  if (state.view === 'geocentric') {
    scene.updateBodies(ephemerisDay);
  } else {
    heliocentricScene.updateHeliocentric(ephemerisDay, frame.ephemerisOrbit || []);
  }

  scene.setEarthquakes(frame.earthquakes);
  scene.setVolcanoes(frame.eruptions);

  const list = document.getElementById('event-list');
  const items = [];

  if (frame.solar?.sunspot_number != null) {
    items.push(
      `<li><span class="solar">☀</span> Sunspot ${frame.solar.sunspot_number.toFixed(1)}${frame.solar.kp_max ? `, Kp ${frame.solar.kp_max.toFixed(0)}` : ''}</li>`
    );
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
    : '<li class="empty">No events within window</li>';
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

  document.getElementById('show-bodies').addEventListener('change', (e) => {
    geocentricScene.showBodies = e.target.checked;
    updateUI();
  });
  document.getElementById('show-moon').addEventListener('change', (e) => {
    heliocentricScene.showMoon = e.target.checked;
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
    state.currentIndex = Math.max(0, state.dates.length - 365);
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

  renderCitations();
  setupControls();
  updateLegend();
  updateUI();
  requestAnimationFrame(animate);
}

main();