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
  ctx.fillText(`x: ${slice.at(-1)?.xMas.toFixed(1) ?? '—'}`, 8, h - 20);
  ctx.fillText(`−y: ${slice.at(-1) ? (-slice.at(-1).yMas).toFixed(1) : '—'}`, 8, h - 8);
}

export function drawLodChart(canvas, eop, currentIndex, windowSize = 365) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 12, right: 8, bottom: 18, left: 42 };

  ctx.clearRect(0, 0, w, h);

  const start = Math.max(0, currentIndex - windowSize);
  const slice = eop.slice(start, currentIndex + 1);
  if (!slice.length) return;

  const lodValues = slice.map((r) => r.lodMs);
  const omegaValues = slice.map((r) => r.deltaOmegaPicoradS / 1000);

  const minLod = Math.min(...lodValues);
  const maxLod = Math.max(...lodValues);
  const minOmega = Math.min(...omegaValues);
  const maxOmega = Math.max(...omegaValues);

  const plotW = w - pad.left - pad.right;
  const plotH = (h - pad.top - pad.bottom) / 2 - 4;

  const drawSeries = (values, min, max, y0, color, label) => {
    const range = max - min || 1;
    ctx.beginPath();
    values.forEach((v, i) => {
      const x = pad.left + (i / (values.length - 1 || 1)) * plotW;
      const y = y0 + plotH - ((v - min) / range) * plotH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = 'rgba(138, 155, 181, 0.7)';
    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.fillText(label, pad.left, y0 - 2);
    ctx.fillText(`${values.at(-1).toFixed(2)}`, w - pad.right - 50, y0 + 10);
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

  const cursorX = pad.left + plotW;
  ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cursorX, pad.top);
  ctx.lineTo(cursorX, h - pad.bottom);
  ctx.stroke();
  ctx.setLineDash([]);
}