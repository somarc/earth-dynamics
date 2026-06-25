const POLE_SCALE = 1e8;

export function drawPolhode(canvas, eop, currentIndex, trailLength = 400) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;

  ctx.clearRect(0, 0, w, h);

  const start = Math.max(0, currentIndex - trailLength);
  const slice = eop.slice(start, currentIndex + 1);

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;

  for (const r of slice) {
    const px = r.xMas;
    const py = -r.yMas;
    minX = Math.min(minX, px);
    maxX = Math.max(maxX, px);
    minY = Math.min(minY, py);
    maxY = Math.max(maxY, py);
  }

  const pad = 20;
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const scale = Math.min((w - pad * 2) / rangeX, (h - pad * 2) / rangeY);

  const toScreen = (xMas, yMas) => ({
    x: cx + (xMas - (minX + maxX) / 2) * scale,
    y: cy - (yMas - (minY + maxY) / 2) * scale,
  });

  ctx.strokeStyle = 'rgba(60, 90, 130, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(w, h) * 0.35, 0, Math.PI * 2);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(77, 163, 255, 0.25)';
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, h);
  ctx.moveTo(0, cy);
  ctx.lineTo(w, cy);
  ctx.stroke();

  if (slice.length > 1) {
    ctx.beginPath();
    const first = toScreen(slice[0].xMas, -slice[0].yMas);
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < slice.length; i++) {
      const p = toScreen(slice[i].xMas, -slice[i].yMas);
      ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  if (slice.length) {
    const cur = slice.at(-1);
    const p = toScreen(cur.xMas, -cur.yMas);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#ffd166';
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(138, 155, 181, 0.8)';
  ctx.font = '10px IBM Plex Mono, monospace';
  ctx.fillText('mas', w - 30, 14);
  const last = slice.at(-1);
  ctx.fillText(`x: ${last?.xMas != null ? last.xMas.toFixed(1) : '—'}`, 8, h - 20);
  ctx.fillText(`−y: ${last?.yMas != null ? (-last.yMas).toFixed(1) : '—'}`, 8, h - 8);
}

function buildAamByDate(aamWindow) {
  if (!aamWindow?.length) return null;
  return Object.fromEntries(aamWindow.map((r) => [r.date, r]));
}

function anomalySeries(values) {
  const valid = values.filter((v) => v != null);
  if (!valid.length) return null;
  const mean = valid.reduce((a, b) => a + b, 0) / valid.length;
  return values.map((v) => (v == null ? null : v - mean));
}

export function drawLodChart(canvas, eop, currentIndex, { aamWindow = null, windowSize = 365 } = {}) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 14, right: 8, bottom: 18, left: 42 };

  ctx.clearRect(0, 0, w, h);

  const start = Math.max(0, currentIndex - windowSize);
  const slice = eop.slice(start, currentIndex + 1);
  if (!slice.length) return;

  const lodValues = slice.map((r) => r.lodMs);
  const omegaValues = slice.map((r) => r.deltaOmegaPicoradS / 1000);
  const aamByDate = buildAamByDate(aamWindow);
  const aamZRaw = aamByDate ? slice.map((r) => aamByDate[r.date]?.aamZ ?? null) : null;
  const aamZAnomaly = aamZRaw ? anomalySeries(aamZRaw) : null;
  const hasAam = aamZAnomaly?.some((v) => v != null);

  const minLod = Math.min(...lodValues);
  const maxLod = Math.max(...lodValues);
  const minOmega = Math.min(...omegaValues);
  const maxOmega = Math.max(...omegaValues);

  const plotW = w - pad.left - pad.right;
  const plotH = (h - pad.top - pad.bottom) / 2 - 4;
  const lodRange = maxLod - minLod || 1;

  const drawSeries = (values, min, max, y0, color, label, { width = 1.5, dash = [] } = {}) => {
    const range = max - min || 1;
    ctx.beginPath();
    let started = false;
    values.forEach((v, i) => {
      if (v == null) return;
      const x = pad.left + (i / (values.length - 1 || 1)) * plotW;
      const y = y0 + plotH - ((v - min) / range) * plotH;
      if (!started) {
        ctx.moveTo(x, y);
        started = true;
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.setLineDash(dash);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = 'rgba(138, 155, 181, 0.7)';
    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.fillText(label, pad.left, y0 - 2);
    const lastVal = values.at(-1);
    if (label && lastVal != null) ctx.fillText(`${lastVal.toFixed(2)}`, w - pad.right - 50, y0 + 10);
  };

  drawSeries(lodValues, minLod, maxLod, pad.top, '#4da3ff', 'ΔLOD (ms)');
  drawSeries(
    omegaValues,
    minOmega,
    maxOmega,
    pad.top + plotH + 8,
    '#3ecf8e',
    'Δω₃ (nrad/s)'
  );

  if (hasAam) {
    const validAam = aamZAnomaly.filter((v) => v != null);
    const minA = Math.min(...validAam);
    const maxA = Math.max(...validAam);
    const aamRange = maxA - minA || 1;
    const scaledAam = aamZAnomaly.map((v) =>
      v == null ? null : minLod + ((v - minA) / aamRange) * lodRange,
    );
    drawSeries(scaledAam, minLod, maxLod, pad.top, 'rgba(255, 140, 66, 0.85)', '', {
      width: 1.25,
      dash: [5, 4],
    });
    ctx.fillStyle = 'rgba(255, 154, 85, 0.85)';
    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.fillText('AAM z anomaly', pad.left + 72, pad.top - 2);
  } else {
    ctx.fillStyle = 'rgba(138, 155, 181, 0.45)';
    ctx.font = '8px IBM Plex Mono, monospace';
    ctx.fillText('npm run ingest -- --only=aam', pad.left + 72, pad.top - 2);
  }

  const cursorX = pad.left + plotW;
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cursorX, pad.top);
  ctx.lineTo(cursorX, h - pad.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
}