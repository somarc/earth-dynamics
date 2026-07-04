function findMonthIndex(series, ym) {
  if (!series?.length || !ym) return -1;
  return series.findIndex((r) => r.ym === ym);
}

function drawThresholds(ctx, pad, plotW, plotH, yScale) {
  const bands = [
    { value: 0, color: 'rgba(138, 155, 181, 0.35)', dash: [4, 4] },
    { value: 0.5, color: 'rgba(255, 209, 102, 0.25)', dash: null },
    { value: 1.0, color: 'rgba(255, 140, 66, 0.22)', dash: null },
    { value: 2.0, color: 'rgba(255, 92, 106, 0.18)', dash: null },
    { value: -0.5, color: 'rgba(77, 163, 255, 0.2)', dash: null },
  ];
  ctx.lineWidth = 1;
  for (const band of bands) {
    const y = pad.top + plotH - yScale(band.value);
    ctx.strokeStyle = band.color;
    if (band.dash) ctx.setLineDash(band.dash);
    else ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(pad.left + plotW, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawSeries(ctx, series, key, pad, plotW, plotH, yScale, { color, width = 1.5, alpha = 1 } = {}) {
  const points = series
    .map((r, i) => ({ i, v: r[key] }))
    .filter((p) => p.v != null);
  if (points.length < 2) return;

  ctx.beginPath();
  points.forEach((p, idx) => {
    const x = pad.left + (p.i / Math.max(series.length - 1, 1)) * plotW;
    const y = pad.top + plotH - yScale(p.v);
    if (idx === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
  ctx.globalAlpha = 1;
}

export function drawOceanSstChart(canvas, windowData, currentDate) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const pad = { top: 16, right: 10, bottom: 22, left: 38 };
  const monthly = windowData?.monthly ?? [];
  const ym = currentDate?.slice(0, 7);

  ctx.clearRect(0, 0, w, h);
  if (!monthly.length) {
    ctx.fillStyle = 'rgba(138,155,181,0.7)';
    ctx.font = '11px IBM Plex Sans, sans-serif';
    ctx.fillText('Run npm run ingest -- --only=ocean-sst', 10, 24);
    return;
  }

  const vals = monthly.flatMap((r) => [
    r.nino34AnomC,
    r.globalTropicsAnomC,
  ]).filter((v) => v != null);
  const minV = Math.min(-2.5, ...vals);
  const maxV = Math.max(2.5, ...vals);
  const range = maxV - minV || 1;
  const yScale = (v) => ((v - minV) / range) * (h - pad.top - pad.bottom);

  const plotW = w - pad.left - pad.right;
  const plotH = h - pad.top - pad.bottom;

  drawThresholds(ctx, pad, plotW, plotH, yScale);
  drawSeries(ctx, monthly, 'globalTropicsAnomC', pad, plotW, plotH, yScale, {
    color: 'rgba(77, 163, 255, 0.85)',
    width: 1.25,
  });
  drawSeries(ctx, monthly, 'nino34AnomC', pad, plotW, plotH, yScale, {
    color: 'rgba(255, 140, 66, 0.95)',
    width: 2,
  });

  const idx = findMonthIndex(monthly, ym);
  if (idx >= 0) {
    const x = pad.left + (idx / Math.max(monthly.length - 1, 1)) * plotW;
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.85)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, pad.top);
    ctx.lineTo(x, pad.top + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const cur = monthly.find((r) => r.ym === ym) ?? monthly.at(-1);
  const oni = windowData?.oni?.at(-1);

  ctx.fillStyle = 'rgba(138, 155, 181, 0.75)';
  ctx.font = '9px IBM Plex Mono, monospace';
  ctx.fillText('°C anom', pad.left, 11);
  if (cur?.nino34AnomC != null) {
    ctx.fillText(`Niño3.4 ${cur.nino34AnomC >= 0 ? '+' : ''}${cur.nino34AnomC.toFixed(2)}`, w - 118, 11);
  }
  if (cur?.globalTropicsAnomC != null) {
    ctx.fillText(`tropics ${cur.globalTropicsAnomC >= 0 ? '+' : ''}${cur.globalTropicsAnomC.toFixed(2)}`, w - 118, h - 6);
  }

  ctx.fillStyle = 'rgba(255, 140, 66, 0.9)';
  ctx.fillRect(pad.left, h - 14, 10, 2);
  ctx.fillStyle = 'rgba(138, 155, 181, 0.75)';
  ctx.fillText('Niño3.4', pad.left + 14, h - 6);
  ctx.fillStyle = 'rgba(77, 163, 255, 0.9)';
  ctx.fillRect(pad.left + 72, h - 14, 10, 2);
  ctx.fillStyle = 'rgba(138, 155, 181, 0.75)';
  ctx.fillText('global tropics', pad.left + 86, h - 6);

  return { current: cur, oni };
}

export function renderOceanSstMetrics(container, ocean, { oni } = {}) {
  if (!container) return;
  const m = ocean?.monthly;
  const oniRow = oni ?? ocean?.oni;
  if (!m && !oniRow) {
    container.innerHTML = '<p class="orbital-empty">No NOAA CPC ocean indices ingested. Run <code>npm run ingest -- --only=ocean-sst</code>.</p>';
    return;
  }

  const lines = [];
  if (m?.nino34AnomC != null) {
    lines.push(`<div><dt>Niño 3.4</dt><dd>${m.nino34AnomC >= 0 ? '+' : ''}${m.nino34AnomC.toFixed(2)} °C <span class="panel__hint">ERSSTv5 monthly</span></dd></div>`);
  }
  if (m?.globalTropicsAnomC != null) {
    lines.push(`<div><dt>Global tropics</dt><dd>${m.globalTropicsAnomC >= 0 ? '+' : ''}${m.globalTropicsAnomC.toFixed(2)} °C <span class="panel__hint">10°S–10°N OISST</span></dd></div>`);
  }
  if (oniRow?.anomalyC != null) {
    lines.push(`<div><dt>ONI</dt><dd>${oniRow.anomalyC >= 0 ? '+' : ''}${oniRow.anomalyC.toFixed(2)} °C <span class="panel__hint">${oniRow.season} ${oniRow.year} · CPC ENSO index</span></dd></div>`);
  }
  lines.push('<p class="panel__hint">Measured SST anomalies from NOAA CPC — not altimetry or model fill. Kelvin-wave / SSH signals require a separate altimetry source.</p>');
  lines.push('<a class="inspect-link" href="https://www.cpc.ncep.noaa.gov/products/analysis_monitoring/ensostuff/" target="_blank" rel="noopener">NOAA CPC ENSO monitoring →</a>');

  container.innerHTML = `<dl class="inspect-grid inspect-grid--compact">${lines.join('')}</dl>`;
}