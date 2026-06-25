export function renderEventInspect(container, selection) {
  if (!selection) {
    container.innerHTML = '<p class="inspect-empty">Click a quake, volcano, hotspot, or plate motion arrow on the globe.</p>';
    return;
  }

  const { type, data } = selection;

  if (type === 'earthquake') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Earthquake</dd></div>
        <div><dt>Magnitude</dt><dd>M${data.mag?.toFixed(1) ?? '—'}</dd></div>
        <div><dt>Location</dt><dd>${data.place || '—'}</dd></div>
        <div><dt>Depth</dt><dd>${data.depth != null ? `${data.depth.toFixed(1)} km` : '—'}</dd></div>
        <div><dt>Date</dt><dd>${data.date || '—'}</dd></div>
      </dl>
      ${data.url ? `<a class="inspect-link" href="${data.url}" target="_blank" rel="noopener">USGS event page →</a>` : ''}
    `;
    return;
  }

  if (type === 'volcano') {
    const status = data.continuing ? 'Ongoing eruption' : `Ended ${data.endDate || '—'}`;
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Volcanic eruption</dd></div>
        <div><dt>Name</dt><dd>${data.name || '—'}</dd></div>
        <div><dt>VEI</dt><dd>${data.vei ?? '—'}</dd></div>
        <div><dt>Status</dt><dd>${status}</dd></div>
        <div><dt>Start</dt><dd>${data.startDate || '—'}</dd></div>
      </dl>
      <a class="inspect-link" href="https://volcano.si.edu/" target="_blank" rel="noopener">Smithsonian GVP →</a>
    `;
    return;
  }

  if (type === 'hotspot') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Mantle hotspot</dd></div>
        <div><dt>Name</dt><dd>${data.name}</dd></div>
        <div><dt>Region</dt><dd>${data.region || '—'}</dd></div>
        <div><dt>Position</dt><dd>${data.lat?.toFixed(1)}°, ${data.lon?.toFixed(1)}°</dd></div>
      </dl>
      <a class="inspect-link" href="https://volcano.si.edu/glossary/Hotspot/" target="_blank" rel="noopener">GVP hotspot reference →</a>
    `;
    return;
  }

  if (type === 'plate') {
    container.innerHTML = `
      <dl class="inspect-card">
        <div><dt>Type</dt><dd>Tectonic plate</dd></div>
        <div><dt>Plate</dt><dd>${data.name} (${data.code})</dd></div>
        <div><dt>Speed</dt><dd>${data.speedMmYr?.toFixed(1) ?? '—'} mm/yr</dd></div>
        <div><dt>Euler pole</dt><dd>${data.poleLat?.toFixed(1)}°N, ${data.poleLon?.toFixed(1)}°E</dd></div>
        <div><dt>ω</dt><dd>${data.degPerMa?.toFixed(2) ?? '—'} °/Ma</dd></div>
      </dl>
      <a class="inspect-link" href="https://www.ngdc.noaa.gov/mgg/ocean/plate_boundary/" target="_blank" rel="noopener">PB2002 reference →</a>
    `;
  }
}

export function classifyPick(hit) {
  let obj = hit.object;
  while (obj) {
    const d = obj.userData;
    if (d?.id && d.mag != null) return { type: 'earthquake', data: d };
    if (d?.volcanoNumber != null || (d?.name && d?.vei != null)) return { type: 'volcano', data: d };
    if (d?.id && d.name && d.region) return { type: 'hotspot', data: d };
    if (d?.code && d.speedMmYr != null) return { type: 'plate', data: d };
    obj = obj.parent;
  }
  return null;
}