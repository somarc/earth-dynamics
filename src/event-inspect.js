import {
  GLOBE_ABOUT,
  earthquakeNote,
  gvpVolcanoUrl,
  plateBoundaryNote,
  plateNote,
  volcanoNote,
} from './globe-inspect.js';
import { PICK_EPISTEMICS, epistemicBadge } from './epistemics.js';

function inspectEpistemic(type) {
  const id = PICK_EPISTEMICS[type];
  return id ? epistemicBadge(id, { compact: true }) : '';
}

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
    ['Radar coverage', context.radarAbout ?? context.radar ?? GLOBE_ABOUT.radar],
    ['Geomagnetic field', context.geomag ?? GLOBE_ABOUT.geomag],
    ['Spin pole (IERS)', context.spinPole ?? GLOBE_ABOUT.spinPole],
    ['Magnetic poles (IGRF)', context.magneticPole ?? GLOBE_ABOUT.magneticPole],
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Earthquake</dd></div>
        <div><dt>Magnitude</dt><dd>M${data.mag?.toFixed(1) ?? '—'}</dd></div>
        <div><dt>Location</dt><dd>${esc(data.place || '—')}</dd></div>
        <div><dt>Depth</dt><dd>${data.depth != null ? `${data.depth.toFixed(1)} km hypocenter` : '—'}</dd></div>
        <div><dt>Globe position</dt><dd>${data.depth != null && data.depth > 0 ? 'Embedded below surface by depth' : 'Near-surface focus'}</dd></div>
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
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
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
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

  if (type === 'radar') {
    const lastSweep = data.lastSweep
      ? new Date(data.lastSweep).toISOString().replace('T', ' ').slice(0, 19) + ' UTC'
      : '—';
    container.innerHTML = `
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Weather radar site</dd></div>
        <div><dt>Site ID</dt><dd>${esc(data.siteId)}</dd></div>
        <div><dt>Name</dt><dd>${esc(data.name || '—')}</dd></div>
        <div><dt>Network</dt><dd>${esc(data.network)} · ${esc(data.stationType || '—')}</dd></div>
        <div><dt>Country</dt><dd>${esc(data.country || '—')}</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(3)}°, ${data.lon?.toFixed(3)}°</dd></div>
        <div><dt>Nominal ring</dt><dd>${data.rangeKmNominal != null ? `${data.rangeKmNominal} km` : '—'}</dd></div>
        <div><dt>Status</dt><dd>${esc(data.status || '—')}</dd></div>
        <div><dt>Last sweep</dt><dd>${esc(lastSweep)}</dd></div>
        <div><dt>Source</dt><dd>${esc(data.sourceCitation || '—')}</dd></div>
      </dl>
      <p class="inspect-note">Dashed ring is nominal low-level reach from agency docs — not beam-height truth. Composite products merge overlapping site sweeps; gaps remain outside all rings.</p>
      <p class="inspect-about">${esc(context.radarAbout ?? context.radar ?? GLOBE_ABOUT.radar)}</p>
      ${data.sourceUrl ? `<a class="inspect-link" href="${esc(data.sourceUrl)}" target="_blank" rel="noopener">Source record →</a>` : ''}
    `;
    return;
  }

  if (type === 'plate-boundary') {
    const note = plateBoundaryNote(data);
    const styleHints = {
      subduction: 'Red tube — subduction (SUB)',
      divergent: 'Green solid — spreading ridge or rift (OSR/CRB)',
      transform: 'Yellow dashed — transform fault (OTF/CTF)',
      convergent: 'Orange solid — convergent non-subduction (OCB/CCB)',
    };
    const styleHint = styleHints[data.boundaryKind] || 'PB2002 boundary step';
    container.innerHTML = `
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
      <dl class="inspect-card">
        <div><dt>Class</dt><dd>${esc(data.boundaryLabel || 'Plate boundary')}${data.stepClass ? ` (${esc(data.stepClass)})` : ''}</dd></div>
        <div><dt>Globe style</dt><dd>${esc(styleHint)}</dd></div>
        <div><dt>Segment</dt><dd>${esc(data.name)}</dd></div>
        <div><dt>Plates</dt><dd>${esc(data.plates)}</dd></div>
        ${data.velocityMmYr != null ? `<div><dt>Slip rate</dt><dd>${esc(data.velocityMmYr.toFixed(1))} mm/yr (PB2002)</dd></div>` : ''}
      </dl>
      ${note ? `<p class="inspect-note">${esc(note)}</p>` : ''}
      <p class="inspect-about">${esc(context.plateBoundary ?? GLOBE_ABOUT.plateBoundary)}</p>
      <a class="inspect-link" href="https://www.ngdc.noaa.gov/mgg/ocean/plate_boundary/" target="_blank" rel="noopener">PB2002 reference →</a>
    `;
    return;
  }

  if (type === 'spin-pole') {
    container.innerHTML = `
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Instantaneous rotation pole</dd></div>
        <div><dt>Source</dt><dd>IERS Earth orientation (EOP)</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(3)}°, ${data.lon?.toFixed(3)}°</dd></div>
        <div><dt>Pole offset</dt><dd>x ${data.xArcsec?.toFixed(2) ?? '—'}″, y ${data.yArcsec?.toFixed(2) ?? '—'}″</dd></div>
      </dl>
      <p class="inspect-about">${esc(context.spinPole ?? GLOBE_ABOUT.spinPole)}</p>
      <a class="inspect-link" href="https://hpiers.obspm.fr/eop-pc/index.php?index=C04&lang=en" target="_blank" rel="noopener">IERS EOP C04 →</a>
    `;
    return;
  }

  if (type === 'magnetic-pole') {
    const hemi = data.hemisphere === 'south' ? 'South' : 'North';
    container.innerHTML = `
      <div class="inspect-epi">${inspectEpistemic(type)}</div>
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>${hemi} geomagnetic dip pole</dd></div>
        <div><dt>Model</dt><dd>IGRF-14 at scrub date</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(1)}°</dd></div>
        <div><dt>Inclination</dt><dd>${data.inclinationDeg?.toFixed(2) ?? '—'}°</dd></div>
      </dl>
      <p class="inspect-note">Not the spin pole (yellow sphere). Magnetic north wanders on the order of km/yr; polar wander in the Polhode panel is meters-scale.</p>
      <p class="inspect-about">${esc(context.magneticPole ?? GLOBE_ABOUT.magneticPole)}</p>
      <a class="inspect-link" href="https://www.ncei.noaa.gov/products/international-geomagnetic-reference-field" target="_blank" rel="noopener">IGRF-14 reference →</a>
    `;
    return;
  }

  if (type === 'magnetometer') {
    const f = data.field || {};
    container.innerHTML = `
      <div class="inspect-epi">${inspectEpistemic(type)} <span class="epi-badge epi-badge--compact epi-badge--measured" title="Observatory site in the INTERMAGNET network">measured site</span></div>
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>INTERMAGNET observatory</dd></div>
        <div><dt>Code</dt><dd>${esc(data.iagaCode)}</dd></div>
        <div><dt>Name</dt><dd>${esc(data.name)}</dd></div>
        <div><dt>Institute</dt><dd>${esc(data.institute || '—')}</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(2)}°</dd></div>
        <div><dt>Field model</dt><dd>IGRF-14 at scrub date</dd></div>
        <div><dt>Total F</dt><dd>${f.totalNt != null ? `${Math.round(f.totalNt)} nT` : '—'}</dd></div>
        <div><dt>Declination D</dt><dd>${f.declDeg != null ? `${f.declDeg.toFixed(2)}°` : '—'}</dd></div>
        <div><dt>Inclination I</dt><dd>${f.inclDeg != null ? `${f.inclDeg.toFixed(2)}°` : '—'}</dd></div>
        <div><dt>Horizontal H</dt><dd>${f.horizontalNt != null ? `${Math.round(f.horizontalNt)} nT` : '—'}</dd></div>
      </dl>
      <p class="inspect-note">Station location is from the INTERMAGNET catalog. Vector components are modeled main-field values for this date — not a live magnetogram.</p>
      <p class="inspect-about">${esc(context.geomag ?? GLOBE_ABOUT.geomag)}</p>
      ${data.url ? `<a class="inspect-link" href="${esc(data.url)}" target="_blank" rel="noopener">Observatory page →</a>` : ''}
      <a class="inspect-link" href="https://www.ncei.noaa.gov/products/international-geomagnetic-reference-field" target="_blank" rel="noopener">IGRF-14 reference →</a>
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
    if (d?.pickType === 'radar' || d?.pickType === 'radar-ring') return { type: 'radar', data: d };
    if (d?.pickType === 'magnetometer') return { type: 'magnetometer', data: d };
    if (d?.pickType === 'magnetic-pole') return { type: 'magnetic-pole', data: d };
    if (d?.pickType === 'spin-pole') return { type: 'spin-pole', data: d };
    if (d?.pickType === 'plate') return { type: 'plate', data: d };
    if (d?.id && d.mag != null) return { type: 'earthquake', data: d };
    if (d?.volcanoNumber != null || (d?.name && d?.vei != null)) return { type: 'volcano', data: d };
    if (d?.id && d.name && d.region && d.volcano) return { type: 'hotspot', data: d };
    if (d?.code && d.speedMmYr != null) return { type: 'plate', data: d };
    obj = obj.parent;
  }
  return null;
}