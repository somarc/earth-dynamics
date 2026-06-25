import { resolveEphemerisDate, BODY_COLORS, BODY_LABELS } from './ephemeris.js';

/** Sun's speed relative to the local standard of rest (~solar apex). */
const SUN_LSR_VELOCITY_KMS = 19.4;
const AU_KM = 149597870.7;
const AU_PER_DAY = (SUN_LSR_VELOCITY_KMS * 86400) / AU_KM;

const TRAIL_BODIES = ['earth', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];

export function sliceEphemerisWindow(ephemeris, date, historyDays = 365) {
  if (!ephemeris?.byDate || !date) return null;
  const resolved = resolveEphemerisDate(ephemeris, date);
  if (!resolved) return null;
  const dates = ephemeris.dates;
  const idx = dates.indexOf(resolved);
  if (idx < 0) return ephemeris;
  const start = Math.max(0, idx - historyDays + 1);
  const windowDates = dates.slice(start, idx + 1);
  const byDate = Object.fromEntries(
    windowDates.map((d) => [d, ephemeris.byDate[d]]).filter(([, row]) => row),
  );
  return { dates: windowDates, byDate };
}

function bodyHelio(day, key) {
  const earth = day.earthHelio;
  if (!earth) return null;
  if (key === 'earth') return earth;
  const geo = day[key];
  if (!geo) return null;
  return {
    x: earth.x + geo.x,
    y: earth.y + geo.y,
    z: earth.z + geo.z,
  };
}

function galacticPoint(dayOffset, helio) {
  return {
    advance: dayOffset * AU_PER_DAY,
    y: helio.y,
    z: helio.z,
  };
}

export function drawHelicalChart(canvas, ephemeris, date, historyDays = 365) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const window = sliceEphemerisWindow(ephemeris, date, historyDays);
  const resolvedDate = resolveEphemerisDate(ephemeris, date);
  const day = resolvedDate ? ephemeris?.byDate?.[resolvedDate] : null;

  if (!window?.dates?.length || !day?.earthHelio) {
    ctx.fillStyle = 'rgba(138,155,181,0.7)';
    ctx.font = '10px IBM Plex Sans, sans-serif';
    ctx.fillText('Heliocentric ephemeris unavailable', 10, 22);
    return;
  }

  const pad = { left: 30, right: 10, top: 22, bottom: 16 };
  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.bottom - pad.top;
  const midY = pad.top + plotH / 2;

  const samples = [];
  for (let i = 0; i < window.dates.length; i++) {
    const row = window.byDate[window.dates[i]];
    if (!row?.earthHelio) continue;
    for (const key of TRAIL_BODIES) {
      const helio = bodyHelio(row, key);
      if (!helio) continue;
      const gp = galacticPoint(i, helio);
      samples.push({ key, gp, isCurrent: window.dates[i] === resolvedDate });
    }
  }

  if (!samples.length) return;

  const advances = samples.map((s) => s.gp.advance);
  const ys = samples.map((s) => s.gp.y);
  const xMin = Math.min(...advances);
  const xMax = Math.max(...advances);
  const yMax = Math.max(0.12, ...ys.map(Math.abs), ...samples.map((s) => Math.abs(s.gp.z)));

  const xSpan = Math.max(xMax - xMin, 0.05);
  const toScreen = (advance, y) => ({
    x: pad.left + ((advance - xMin) / xSpan) * plotW,
    y: midY - (y / yMax) * (plotH * 0.46),
  });

  ctx.strokeStyle = 'rgba(60,90,130,0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 5]);
  ctx.beginPath();
  ctx.moveTo(pad.left, midY);
  ctx.lineTo(w - pad.right, midY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.fillStyle = 'rgba(138,155,181,0.55)';
  ctx.font = '8px IBM Plex Mono, monospace';
  ctx.fillText('galactic plane', pad.left, midY + 11);

  ctx.fillStyle = 'rgba(138,155,181,0.6)';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.fillText('helical XY (AU)', 8, 12);
  ctx.fillText(`Sun +${SUN_LSR_VELOCITY_KMS} km/s LSR`, 8, 24);

  const staleAsOf = day._ephemerisAsOf ?? (resolvedDate !== date ? resolvedDate : null);
  if (staleAsOf) {
    ctx.fillStyle = 'rgba(138,155,181,0.45)';
    ctx.font = '8px IBM Plex Mono, monospace';
    ctx.fillText(`as of ${staleAsOf}`, 8, 36);
  }

  const drawTrail = (key, { alpha = 0.45, width = 1.2 } = {}) => {
    const pts = [];
    for (let i = 0; i < window.dates.length; i++) {
      const row = window.byDate[window.dates[i]];
      const helio = bodyHelio(row, key);
      if (!helio) continue;
      pts.push(toScreen(galacticPoint(i, helio).advance, galacticPoint(i, helio).y));
    }
    if (pts.length < 2) return;
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = hexAlpha(BODY_COLORS[key] || '#9ab0c8', alpha);
    ctx.lineWidth = width;
    ctx.stroke();
  };

  drawTrail('saturn', { alpha: 0.28, width: 1 });
  drawTrail('jupiter', { alpha: 0.3, width: 1 });
  drawTrail('mars', { alpha: 0.35, width: 1 });
  drawTrail('venus', { alpha: 0.38, width: 1 });
  drawTrail('mercury', { alpha: 0.4, width: 1 });
  drawTrail('earth', { alpha: 0.75, width: 1.8 });

  const sunTrail = window.dates.map((_, i) => toScreen(i * AU_PER_DAY, 0));
  if (sunTrail.length > 1) {
    ctx.beginPath();
    sunTrail.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = 'rgba(255, 213, 74, 0.35)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  const currentIdx = window.dates.indexOf(resolvedDate);
  if (currentIdx >= 0) {
    const sunP = toScreen(currentIdx * AU_PER_DAY, 0);
    ctx.beginPath();
    ctx.arc(sunP.x, sunP.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = BODY_COLORS.sun;
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 230, 160, 0.85)';
    ctx.font = '8px IBM Plex Mono, monospace';
    ctx.fillText('Sun', sunP.x + 7, sunP.y + 3);
  }

  const markerSizes = {
    earth: 4.5,
    mercury: 2,
    venus: 2.5,
    mars: 2.8,
    jupiter: 3.2,
    saturn: 3,
  };

  for (const key of [...TRAIL_BODIES].reverse()) {
    const helio = bodyHelio(day, key);
    if (!helio || currentIdx < 0) continue;
    const p = toScreen(galacticPoint(currentIdx, helio).advance, galacticPoint(currentIdx, helio).y);
    const size = markerSizes[key] || 3;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fillStyle = BODY_COLORS[key] || '#9ab0c8';
    ctx.fill();
    if (key === 'earth' || key === 'mars') {
      ctx.fillStyle = 'rgba(200,210,225,0.8)';
      ctx.font = '8px IBM Plex Mono, monospace';
      ctx.fillText(BODY_LABELS[key], p.x + size + 2, p.y + 3);
    }
  }
}

function hexAlpha(hex, alpha) {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}