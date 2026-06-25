import {
  GLOBE_ABOUT,
  earthquakeNote,
  gvpVolcanoUrl,
  plateBoundaryNote,
  plateNote,
  volcanoNote,
} from './globe-inspect.js';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderGlossary(context) {
  const entries = [
    ['Earthquakes', context.earthquake ?? GLOBE_ABOUT.earthquake],
    ['Active eruptions (GVP)', context.volcano ?? GLOBE_ABOUT.volcano],
    ['Hotspots', context.hotspotAbout ?? context.hotspot ?? GLOBE_ABOUT.hotspot],
    ['Plate motion', context.plateAbout ?? context.plate ?? GLOBE_ABOUT.plate],
    ['Boundaries', context.plateBoundary ?? GLOBE_ABOUT.plateBoundary],
    ['Cyclones (IBTrACS)', context.cyclone ?? GLOBE_ABOUT.cyclone],
    ['Weather grid', context.weather ?? GLOBE_ABOUT.weather],
  ];
  return `
    <dl class="inspect-glossary">
      ${entries.map(([label, text]) => `
        <div><dt>${label}</dt><dd>${esc(text)}</dd></div>
      `).join('')}
    </dl>
  `;
}

export function renderEventInspect(container, selection, context = {}) {
  if (!selection) {
    container.innerHTML = `
      <p class="inspect-empty">Hover or click markers on the globe — earthquakes, eruptions, hotspots, plate arrows, and boundaries.</p>
      ${renderGlossary(context)}
    `;
    return;
  }

  const { type, data } = selection;

  if (type === 'earthquake') {
    const note = earthquakeNote(data);
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Earthquake</dd></div>
        <div><dt>Magnitude</dt><dd>M${data.mag?.toFixed(1) ?? '—'}</dd></div>
        <div><dt>Location</dt><dd>${esc(data.place || '—')}</dd></div>
        <div><dt>Depth</dt><dd>${data.depth != null ? `${data.depth.toFixed(1)} km` : '—'}</dd></div>
        <div><dt>Coordinates</dt><dd>${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(2)}°</dd></div>
        <div><dt>Date</dt><dd>${data.date || '—'}</dd></div>
        <div><dt>Tsunami</dt><dd>${data.tsunami ? 'Flagged in catalog' : 'No'}</dd></div>
      </dl>
      ${note ? `<p class="inspect-note">${esc(note)}</p>` : ''}
      <p class="inspect-about">${esc(context.earthquake ?? GLOBE_ABOUT.earthquake)}</p>
      ${data.url ? `<a class="inspect-link" href="${esc(data.url)}" target="_blank" rel="noopener">USGS event page →</a>` : ''}
    `;
    return;
  }

  if (type === 'volcano') {
    const status = data.continuing ? 'Ongoing eruption' : `Ended ${data.endDate || '—'}`;
    const note = volcanoNote(data);
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Active GVP eruption episode</dd></div>
        <div><dt>Volcano</dt><dd>${esc(data.name || '—')}</dd></div>
        <div><dt>VEI (max)</dt><dd>${data.vei ?? '—'}</dd></div>
        <div><dt>Activity window</dt><dd>${data.startDate || '—'}${data.endDate ? ` → ${data.endDate}` : ''}</dd></div>
        <div><dt>GVP status</dt><dd>${status}</dd></div>
        <div><dt>Coordinates</dt><dd>${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(2)}°</dd></div>
      </dl>
      ${note ? `<p class="inspect-note">${esc(note)}</p>` : ''}
      <p class="inspect-about">${esc(context.volcano ?? GLOBE_ABOUT.volcano)}</p>
      <a class="inspect-link" href="${esc(gvpVolcanoUrl(data.volcanoNumber))}" target="_blank" rel="noopener">Smithsonian GVP volcano page →</a>
    `;
    return;
  }

  if (type === 'hotspot') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Mantle hotspot</dd></div>
        <div><dt>Name</dt><dd>${esc(data.name)}</dd></div>
        <div><dt>Surface feature</dt><dd>${esc(data.volcano || '—')}</dd></div>
        <div><dt>Chain / trail</dt><dd>${esc(data.chain || '—')}</dd></div>
        <div><dt>Region</dt><dd>${esc(data.region || '—')}</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(1)}°, ${data.lon?.toFixed(1)}°</dd></div>
      </dl>
      ${data.note ? `<p class="inspect-note">${esc(data.note)}</p>` : ''}
      <p class="inspect-about">${esc(context.hotspotAbout ?? context.hotspot ?? GLOBE_ABOUT.hotspot)}</p>
      <a class="inspect-link" href="https://volcano.si.edu/glossary/Hotspot/" target="_blank" rel="noopener">GVP hotspot reference →</a>
    `;
    return;
  }

  if (type === 'plate') {
    const note = plateNote(data);
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Plate motion</dd></div>
        <div><dt>Plate</dt><dd>${esc(data.name)} (${esc(data.code)})</dd></div>
        <div><dt>Speed</dt><dd>${data.speedMmYr?.toFixed(1) ?? '—'} mm/yr</dd></div>
        <div><dt>Euler pole</dt><dd>${data.poleLat?.toFixed(1)}°N, ${data.poleLon?.toFixed(1)}°E</dd></div>
        <div><dt>ω</dt><dd>${data.degPerMa?.toFixed(2) ?? '—'} °/Ma</dd></div>
        <div><dt>Centroid</dt><dd>${data.lat?.toFixed(1)}°, ${data.lon?.toFixed(1)}°</dd></div>
      </dl>
      ${note ? `<p class="inspect-note">${esc(note)}</p>` : ''}
      <p class="inspect-about">${esc(context.plateAbout ?? context.plate ?? GLOBE_ABOUT.plate)}</p>
      <a class="inspect-link" href="https://www.ngdc.noaa.gov/mgg/ocean/plate_boundary/" target="_blank" rel="noopener">PB2002 reference →</a>
    `;
    return;
  }

  if (type === 'cyclone') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Tropical cyclone (IBTrACS)</dd></div>
        <div><dt>Name</dt><dd>${esc(data.name)} (${data.season || '—'})</dd></div>
        <div><dt>Basin</dt><dd>${esc(data.basin || '—')}</dd></div>
        <div><dt>Peak wind</dt><dd>${data.maxWindKts != null ? `${Math.round(data.maxWindKts)} kt` : '—'}${data.maxSshs != null && data.maxSshs >= 0 ? ` · Cat ${data.maxSshs}` : ''}</dd></div>
        <div><dt>Track window</dt><dd>${data.startDate || '—'} → ${data.endDate || '—'}</dd></div>
      </dl>
      <p class="inspect-about">${esc(context.cyclone ?? GLOBE_ABOUT.cyclone)}</p>
      <a class="inspect-link" href="https://www.ncei.noaa.gov/products/international-best-track-archive" target="_blank" rel="noopener">IBTrACS →</a>
    `;
    return;
  }

  if (type === 'weather') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>ERA5 grid point</dd></div>
        <div><dt>Location</dt><dd>${esc(data.label || data.gridId)}</dd></div>
        <div><dt>Max temp</dt><dd>${data.tempMaxC != null ? `${data.tempMaxC.toFixed(1)}°C` : '—'}</dd></div>
        <div><dt>Max wind</dt><dd>${data.windMaxKmh != null ? `${data.windMaxKmh.toFixed(0)} km/h` : '—'}</dd></div>
        <div><dt>Precip</dt><dd>${data.precipMm != null ? `${data.precipMm.toFixed(1)} mm` : '—'}</dd></div>
      </dl>
      <p class="inspect-about">${esc(context.weather ?? GLOBE_ABOUT.weather)}</p>
    `;
    return;
  }

  if (type === 'plate-boundary') {
    const note = plateBoundaryNote({ Type: data.type });
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Plate boundary</dd></div>
        <div><dt>Segment</dt><dd>${esc(data.name)}</dd></div>
        <div><dt>Plates</dt><dd>${esc(data.plates)}</dd></div>
        <div><dt>Boundary class</dt><dd>${esc(data.type)}</dd></div>
      </dl>
      ${note ? `<p class="inspect-note">${esc(note)}</p>` : ''}
      <p class="inspect-about">${esc(context.plateBoundary ?? GLOBE_ABOUT.plateBoundary)}</p>
      <a class="inspect-link" href="https://www.ngdc.noaa.gov/mgg/ocean/plate_boundary/" target="_blank" rel="noopener">PB2002 reference →</a>
    `;
  }
}

export function classifyPick(hit) {
  let obj = hit.object;
  while (obj) {
    const d = obj.userData;
    if (d?.pickType === 'earthquake') return { type: 'earthquake', data: d };
    if (d?.pickType === 'volcano') return { type: 'volcano', data: d };
    if (d?.pickType === 'hotspot') return { type: 'hotspot', data: d };
    if (d?.pickType === 'cyclone') return { type: 'cyclone', data: d };
    if (d?.pickType === 'weather') return { type: 'weather', data: d };
    if (d?.pickType === 'plate') return { type: 'plate', data: d };
    if (d?.id && d.mag != null) return { type: 'earthquake', data: d };
    if (d?.volcanoNumber != null || (d?.name && d?.vei != null)) return { type: 'volcano', data: d };
    if (d?.id && d.name && d.region && d.volcano) return { type: 'hotspot', data: d };
    if (d?.code && d.speedMmYr != null) return { type: 'plate', data: d };
    obj = obj.parent;
  }
  return null;
}