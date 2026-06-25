import * as THREE from 'three';
import { EARTH_RADIUS } from './utils.js';

export function auroraLatitudeFromKp(kp) {
  if (kp == null || kp < 2) return null;
  return Math.max(50, 67 - kp * 2.2);
}

export function gScaleLabel(g) {
  if (!g) return 'Quiet';
  return `G${g} storm`;
}

export function dstStormLabel(dst) {
  if (dst == null) return '—';
  if (dst > -30) return 'Quiet';
  if (dst > -50) return 'Weak';
  if (dst > -100) return 'Moderate';
  if (dst > -200) return 'Intense';
  return 'Super storm';
}

export function drawDstChart(canvas, series, currentDate) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 14, right: 10, bottom: 20, left: 34 };

  ctx.clearRect(0, 0, w, h);
  const withDst = (series || []).filter((r) => r.dstMin != null);
  if (!withDst.length) {
    ctx.fillStyle = 'rgba(138,155,181,0.7)';
    ctx.font = '11px IBM Plex Sans, sans-serif';
    ctx.fillText('Run npm run ingest -- --only=omni', 10, 24);
    return;
  }

  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const dstVals = withDst.map((r) => r.dstMin);
  const minDst = Math.min(-500, ...dstVals);
  const maxDst = Math.max(20, ...dstVals);

  const stormBands = [
    { dst: -50, color: 'rgba(255, 213, 74, 0.08)' },
    { dst: -100, color: 'rgba(255, 140, 66, 0.1)' },
    { dst: -200, color: 'rgba(255, 92, 106, 0.12)' },
  ];
  for (const band of stormBands) {
    const y = pad.top + ((band.dst - maxDst) / (minDst - maxDst)) * plotH;
    ctx.fillStyle = band.color;
    ctx.fillRect(pad.left, y, plotW, pad.top + plotH - y);
  }

  ctx.beginPath();
  withDst.forEach((r, i) => {
    const x = pad.left + (i / Math.max(withDst.length - 1, 1)) * plotW;
    const y = pad.top + ((r.dstMin - maxDst) / (minDst - maxDst)) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#ff8c6a';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const idx = withDst.findIndex((r) => r.date === currentDate);
  if (idx >= 0) {
    const x = pad.left + (idx / Math.max(withDst.length - 1, 1)) * plotW;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.8)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const cur = withDst.find((r) => r.date === currentDate) ?? withDst.at(-1);
  ctx.fillStyle = 'rgba(138, 155, 181, 0.75)';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.fillText('Dst min', pad.left, 11);
  if (cur?.dstMin != null) {
    ctx.fillText(`${cur.dstMin} nT`, w - 64, 11);
  }
}

export function drawKpChart(canvas, series, currentDate) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 14, right: 10, bottom: 20, left: 34 };

  ctx.clearRect(0, 0, w, h);
  if (!series?.length) {
    ctx.fillStyle = 'rgba(138,155,181,0.7)';
    ctx.font = '11px IBM Plex Sans, sans-serif';
    ctx.fillText('Run npm run ingest -- --only=space-weather', 10, 24);
    return;
  }

  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;
  const kpVals = series.map((r) => r.kpMax ?? 0);
  const maxKp = Math.max(9, ...kpVals);

  const stormBands = [
    { kp: 5, color: 'rgba(62, 207, 142, 0.08)', label: 'G1' },
    { kp: 6, color: 'rgba(255, 213, 74, 0.1)', label: 'G2' },
    { kp: 7, color: 'rgba(255, 140, 66, 0.12)', label: 'G3' },
    { kp: 8, color: 'rgba(255, 92, 106, 0.14)', label: 'G4' },
  ];

  for (const band of stormBands) {
    const y = pad.top + plotH - (band.kp / maxKp) * plotH;
    ctx.fillStyle = band.color;
    ctx.fillRect(pad.left, y, plotW, pad.top + plotH - y);
  }

  ctx.beginPath();
  series.forEach((r, i) => {
    const x = pad.left + (i / Math.max(series.length - 1, 1)) * plotW;
    const y = pad.top + plotH - ((r.kpMax ?? 0) / maxKp) * plotH;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = '#6ec9a0';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const idx = series.findIndex((r) => r.date === currentDate);
  if (idx >= 0) {
    const x = pad.left + (idx / Math.max(series.length - 1, 1)) * plotW;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.8)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const cur = series.find((r) => r.date === currentDate) ?? series.at(-1);
  ctx.fillStyle = 'rgba(138, 155, 181, 0.75)';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.fillText('Kp max', pad.left, 11);
  if (cur?.kpMax != null) {
    ctx.fillText(`Kp ${cur.kpMax.toFixed(1)}`, w - 56, 11);
  }
}

export function renderSpaceWeatherMetrics(container, geomagnetic, events, { ovationLat = null, ovationMode = false } = {}) {
  const g = geomagnetic;
  const cmes = (events || []).filter((e) => e.eventType === 'CME').slice(0, 3);
  const storms = (events || []).filter((e) => e.eventType === 'GST').slice(0, 2);
  const flares = (events || []).filter((e) => e.eventType === 'FLR' && /^[XM]/i.test(e.magnitude || '')).slice(0, 2);

  if (!g && !events?.length) {
    container.innerHTML = '<p class="orbital-empty">No space weather data for this date. Run <code>npm run ingest -- --only=space-weather</code>.</p>';
    return;
  }

  const kpAuroraLat = g?.kpMax != null ? auroraLatitudeFromKp(g.kpMax) : null;
  const auroraLat = ovationLat ?? kpAuroraLat;
  const tags = [];
  if (g?.gScale) tags.push(`<span class="tag tag--storm">G${g.gScale}</span>`);
  if (g?.dstMin != null && g.dstMin <= -50) {
    tags.push(`<span class="tag tag--dst">Dst ${g.dstMin} nT</span>`);
  }
  if (auroraLat != null && (g?.kpMax >= 4 || ovationMode)) {
    tags.push(`<span class="tag tag--aurora">Aurora ~${auroraLat.toFixed(0)}°</span>`);
  }
  if (g?.swBzNt != null && g.swBzNt < -5) {
    tags.push(`<span class="tag tag--bz">Bz ${g.swBzNt.toFixed(1)} nT</span>`);
  }

  const eventLines = [];
  for (const c of cmes) {
    const speed = c.speed ? `${Math.round(c.speed)} km/s` : '—';
    eventLines.push(`<li><span class="cme">CME</span> ${speed}${c.magnitude ? ` (${c.magnitude})` : ''}</li>`);
  }
  for (const s of storms) {
    eventLines.push(`<li><span class="gst">Storm</span> ${s.magnitude || `Kp ${s.kpPeak?.toFixed(1) ?? '—'}`}</li>`);
  }
  for (const f of flares) {
    eventLines.push(`<li><span class="flare">${f.magnitude}</span> ${f.sourceLocation || ''}</li>`);
  }

  const auroraNote = ovationMode
    ? 'OVATION probability grid (NOAA nowcast)'
    : 'Kp-estimated oval (historical fallback)';

  container.innerHTML = `
    <dl class="orbital-metrics">
      <div><dt>Kp (max)</dt><dd>${g?.kpMax?.toFixed(1) ?? '—'}</dd></div>
      <div><dt>Dst (min)</dt><dd>${g?.dstMin != null ? `${g.dstMin} nT` : '—'} <span class="metric-sub">${dstStormLabel(g?.dstMin)}</span></dd></div>
      <div><dt>Solar wind</dt><dd>${g?.swSpeedKms != null ? `${g.swSpeedKms.toFixed(0)} km/s` : '—'}</dd></div>
      <div><dt>Bz (GSM min)</dt><dd>${g?.swBzNt != null ? `${g.swBzNt.toFixed(1)} nT` : '—'}</dd></div>
      <div><dt>Storm level</dt><dd>${gScaleLabel(g?.gScale)}</dd></div>
      <div><dt>Auroral oval</dt><dd>${auroraLat != null ? `~${auroraLat.toFixed(0)}° — ${auroraNote}` : 'Below threshold'}</dd></div>
    </dl>
    ${tags.length ? `<div class="orbital-tags">${tags.join('')}</div>` : ''}
    ${eventLines.length ? `<ul class="sw-event-list">${eventLines.join('')}</ul>` : ''}
    <p class="orbital-note">Dst and solar wind from OMNI / NOAA DSCOVR. ${auroraNote}. CMEs from NASA DONKI. Overlay explores Sun–magnetosphere coupling — not earthquake causation.</p>
  `;
}

function ringPoints(latDeg, radius, segments = 128) {
  const lat = (latDeg * Math.PI) / 180;
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const lon = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        radius * Math.cos(lat) * Math.cos(lon),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon),
      ),
    );
  }
  return points;
}

export function updateAuroraRings(group, kp, visible, { skipIfOvation = false } = {}) {
  group.clear();
  if (!visible || skipIfOvation) return;

  const lat = auroraLatitudeFromKp(kp);
  if (lat == null) return;

  const opacity = Math.min(0.8, 0.18 + (kp ?? 0) * 0.075);
  const buildRing = (latitude, color) => {
    const shell = EARTH_RADIUS * 1.009;
    const geo = new THREE.BufferGeometry().setFromPoints(ringPoints(latitude, shell, 128));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color, transparent: true, opacity }),
    );
    group.add(line);

    const bandLat = latitude > 0 ? latitude + 1.5 : latitude - 1.5;
    const bandPoints = ringPoints(bandLat, EARTH_RADIUS * 1.007, 160);
    const bandPositions = new Float32Array(bandPoints.length * 3);
    const bandColors = new Float32Array(bandPoints.length * 3);
    const c = new THREE.Color(color);
    bandPoints.forEach((p, i) => {
      bandPositions[i * 3] = p.x;
      bandPositions[i * 3 + 1] = p.y;
      bandPositions[i * 3 + 2] = p.z;
      bandColors[i * 3] = c.r;
      bandColors[i * 3 + 1] = c.g;
      bandColors[i * 3 + 2] = c.b;
    });
    const bandGeo = new THREE.BufferGeometry();
    bandGeo.setAttribute('position', new THREE.BufferAttribute(bandPositions, 3));
    bandGeo.setAttribute('color', new THREE.BufferAttribute(bandColors, 3));
    group.add(new THREE.Points(
      bandGeo,
      new THREE.PointsMaterial({
        size: 0.014,
        vertexColors: true,
        transparent: true,
        opacity: opacity * 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    ));
  };

  buildRing(lat, 0x5cff8a);
  buildRing(-lat, 0xff6b9d);
}

function fieldLinePoints(longitudeDeg, bulge, radius) {
  const lon = (longitudeDeg * Math.PI) / 180;
  const points = [];
  for (let lat = 80; lat >= -80; lat -= 5) {
    const latRad = (lat * Math.PI) / 180;
    const colat = Math.abs(lat) / 90;
    const r = radius * (1.04 + bulge * Math.sin(colat * Math.PI) ** 2);
    points.push(
      new THREE.Vector3(
        r * Math.cos(latRad) * Math.cos(lon),
        r * Math.sin(latRad),
        r * Math.cos(latRad) * Math.sin(lon),
      ),
    );
  }
  return points;
}

export function updateFieldLines(group, kp, visible) {
  group.clear();
  if (!visible) return;

  const bulge = 1.15 + Math.min((kp ?? 0) * 0.08, 0.55);
  const mat = new THREE.LineBasicMaterial({
    color: 0x7eb8ff,
    transparent: true,
    opacity: 0.28,
  });

  for (let i = 0; i < 10; i++) {
    const lon = (i / 10) * 360;
    const geo = new THREE.BufferGeometry().setFromPoints(
      fieldLinePoints(lon, bulge, EARTH_RADIUS),
    );
    group.add(new THREE.Line(geo, mat));
  }
}