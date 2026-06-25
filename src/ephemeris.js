const BODY_COLORS = {
  moon: '#c8c8d8',
  sun: '#ffd54a',
  mercury: '#9a9a9a',
  venus: '#e8c87a',
  mars: '#e07050',
  jupiter: '#d4a574',
  saturn: '#c9b896',
};

const BODY_LABELS = {
  moon: 'Moon',
  sun: 'Sun',
  mercury: 'Me',
  venus: 'Ve',
  mars: 'Ma',
  jupiter: 'Ju',
  saturn: 'Sa',
};

export function getEphemerisForDate(ephemeris, date) {
  return ephemeris?.byDate?.[date] ?? null;
}

export function drawEclipticChart(canvas, ephemeris, date, historyDays = 28) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const day = getEphemerisForDate(ephemeris, date);
  if (!day) {
    ctx.fillStyle = 'rgba(138,155,181,0.7)';
    ctx.font = '11px IBM Plex Sans, sans-serif';
    ctx.fillText('Ephemeris data unavailable', 12, 24);
    return;
  }

  const dates = ephemeris.dates;
  const idx = dates.indexOf(date);
  const history = [];
  if (idx >= 0) {
    for (let i = Math.max(0, idx - historyDays); i <= idx; i++) {
      const d = ephemeris.byDate[dates[i]];
      if (d?.moon) history.push(d.moon);
    }
  }

  const maxAu = 1.05;
  const scale = (Math.min(w, h) * 0.42) / maxAu;

  const toXY = (body) => ({
    x: cx + body.x * scale,
    y: cy - body.y * scale,
  });

  ctx.strokeStyle = 'rgba(60,90,130,0.25)';
  ctx.lineWidth = 1;
  for (const r of [0.25, 0.5, 0.75, 1.0]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(138,155,181,0.6)';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.fillText('ecliptic XY (AU)', 8, 12);
  ctx.fillText('log-scaled geocentric', 8, 24);

  if (history.length > 1) {
    ctx.beginPath();
    history.forEach((m, i) => {
      const p = toXY(m);
      if (i === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.strokeStyle = 'rgba(200,200,220,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const drawBody = (key, size, showLabel = true) => {
    const body = day[key];
    if (!body) return;
    const p = toXY(body);
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = BODY_COLORS[key];
    ctx.fill();
    if (showLabel) {
      ctx.fillStyle = 'rgba(200,210,225,0.8)';
      ctx.font = '8px IBM Plex Mono, monospace';
      ctx.fillText(BODY_LABELS[key], p.x + size + 2, p.y + 3);
    }
  };

  drawBody('saturn', 4, false);
  drawBody('jupiter', 4.5, false);
  drawBody('mars', 3.5, false);
  drawBody('venus', 3, false);
  drawBody('mercury', 2.5, false);
  drawBody('sun', 6);
  drawBody('moon', 4);

  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#4da3ff';
  ctx.fill();
  ctx.fillStyle = '#e8edf5';
  ctx.font = '8px IBM Plex Mono, monospace';
  ctx.fillText('Earth', cx + 7, cy + 3);
}

export function renderOrbitalMetrics(container, ephemeris, date) {
  const day = getEphemerisForDate(ephemeris, date);
  if (!day) {
    container.innerHTML = '<p class="orbital-empty">Run <code>npm run fetch-data</code> to load JPL Horizons ephemeris.</p>';
    return;
  }

  const { lunar, alignments } = day;
  const tags = [];

  if (lunar.syzygy === 'new') tags.push('<span class="tag tag--syzygy">New Moon</span>');
  if (lunar.syzygy === 'full') tags.push('<span class="tag tag--syzygy">Full Moon</span>');
  if (lunar.isPerigee) tags.push('<span class="tag tag--perigee">Perigee</span>');
  if (lunar.isApogee) tags.push('<span class="tag tag--apogee">Apogee</span>');

  for (const a of alignments || []) {
    if (a.separationDeg == null) continue;
    tags.push(`<span class="tag tag--align">${a.planets.join('–')} ${a.separationDeg.toFixed(1)}°</span>`);
  }

  const illumPct = lunar.illumination != null ? (lunar.illumination * 100).toFixed(0) : '—';
  const moonDist = lunar.moonDistanceKm != null ? lunar.moonDistanceKm.toLocaleString() : '—';
  const phaseAngle = lunar.phaseAngle != null ? `${lunar.phaseAngle.toFixed(1)}°` : '—';
  const tidal = lunar.tidalIndex != null ? lunar.tidalIndex.toFixed(3) : '—';
  const elong = lunar.sunElongation != null ? `${lunar.sunElongation.toFixed(1)}°` : '—';

  container.innerHTML = `
    <dl class="orbital-metrics">
      <div><dt>Moon phase</dt><dd>${lunar.phaseName || '—'} (${illumPct}% lit)</dd></div>
      <div><dt>Moon distance</dt><dd>${moonDist} km</dd></div>
      <div><dt>Phase angle</dt><dd>${phaseAngle}</dd></div>
      <div><dt>Tidal index</dt><dd>${tidal} <span class="metric-hint">(1.0 = mean)</span></dd></div>
      <div><dt>Sun elongation</dt><dd>${elong}</dd></div>
    </dl>
    ${tags.length ? `<div class="orbital-tags">${tags.join('')}</div>` : ''}
    <p class="orbital-note">Tidal forcing is physically real. USGS and seismology literature find no reliable prediction of individual earthquakes from lunar phase or planetary alignments — overlay is for exploration only.</p>
  `;
}