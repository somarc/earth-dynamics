export const GLOBE_ABOUT = {
  earthquake:
    'Earthquakes are sudden fault ruptures that release stored tectonic stress. Marker size and color reflect magnitude. Hypocenters are embedded below the surface by depth (pedagogically exaggerated so shallow vs deep subduction foci are visible inside the globe). Lower Globe opacity for hybrid x-ray mode — solid continents, transparent oceans.',
  volcano:
    'Each orange cone is one Smithsonian GVP eruption episode whose activity dates overlap the date you selected — not the full holocene volcano list, and not every eruption since 1960 at once. Cone size reflects VEI; brighter orange means GVP still lists the episode as continuing.',
  hotspot:
    'Mantle hotspots are long-lived upwellings of unusually hot rock from the deep mantle. Tectonic plates drift over them, leaving chains of volcanoes and seamounts while the source stays relatively fixed.',
  plate:
    'Plate motion arrows show how fast each tectonic plate moves over the mantle, derived from PB2002 Euler poles. Longer arrows mean faster motion toward the arrowhead.',
  plateBoundary:
    'PB2002 digitization steps (Bird 2003) — kinematic class from Euler poles, not earthquake activity. Red tubes = subduction; green = spreading ridge or rift; yellow dashed = transform; orange = convergent (non-subduction). Use the Quakes layer for seismicity.',
  cyclone:
    'Tropical cyclone tracks from NOAA IBTrACS. Line color reflects intensity; the head marker is the storm position on or before the selected date.',
  weather:
    'ERA5 grid glyphs at 16 reference cities. Color encodes daily max temperature; size reflects max wind. Open-Meteo historical archive.',
  radar:
    'US NOAA NEXRAD/TDWR and Canada MSC S-band radar sites. Dashed rings show nominal low-level reflectivity reach — overlapping circles, not seamless coverage. Gaps exist between sites and in complex terrain.',
  geomag:
    'Default WMM dipole field-line arcs for orientation. When space-weather data exists for the scrub date, INTERMAGNET observatory sites appear with IGRF-14 declination ticks — modeled vectors at measured station locations.',
  spinPole:
    'IERS instantaneous rotation pole — where the spin axis meets the surface. Polar wander is on the order of meters (exaggerated in the Polhode panel), not the same as magnetic north.',
  magneticPole:
    'IGRF-14 geomagnetic dip pole — where the modeled main field is vertical. Drifts on the order of km per year, typically hundreds of km from the spin pole.',
};

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function depthLabel(depthKm) {
  if (depthKm == null || Number.isNaN(depthKm)) return null;
  if (depthKm < 70) return 'Shallow focus (< 70 km)';
  if (depthKm < 300) return 'Intermediate depth (70–300 km)';
  return 'Deep focus (≥ 300 km)';
}

function magLabel(mag) {
  if (mag == null) return null;
  if (mag >= 8) return 'Great earthquake — widespread damage / tsunami potential';
  if (mag >= 7) return 'Major earthquake — regional destruction possible';
  if (mag >= 6) return 'Strong earthquake — significant local shaking';
  if (mag >= 5) return 'Moderate earthquake — felt over a wide area';
  return 'Smaller earthquake in catalog window';
}

export function earthquakeNote(q) {
  const parts = [magLabel(q.mag), depthLabel(q.depth)].filter(Boolean);
  if (q.tsunami) parts.push('Tsunami flag in USGS catalog');
  return parts.join('. ');
}

export function volcanoNote(v) {
  const vei = v.vei;
  const parts = [];
  if (vei == null) parts.push('VEI not reported');
  else if (vei >= 5) parts.push(`VEI ${vei} — very large eruption`);
  else if (vei >= 4) parts.push(`VEI ${vei} — large eruption`);
  else if (vei >= 3) parts.push(`VEI ${vei} — moderate eruption`);
  else parts.push(`VEI ${vei} — relatively small eruption`);
  if (v.continuing) parts.push('Listed as ongoing in GVP');
  else if (v.endDate) parts.push(`Ended ${v.endDate}`);
  return parts.join('. ');
}

export function plateNote(p) {
  const speed = p.speedMmYr;
  let speedText = 'Motion speed unavailable';
  if (speed != null) {
    if (speed >= 80) speedText = `${speed.toFixed(1)} mm/yr — very fast plate`;
    else if (speed >= 50) speedText = `${speed.toFixed(1)} mm/yr — fast plate`;
    else if (speed >= 20) speedText = `${speed.toFixed(1)} mm/yr — moderate motion`;
    else speedText = `${speed.toFixed(1)} mm/yr — relatively slow plate`;
  }
  return `${speedText}. Rotation about Euler pole at ${p.poleLat?.toFixed(1) ?? '—'}°N, ${p.poleLon?.toFixed(1) ?? '—'}°E.`;
}

export function plateBoundaryNote(props) {
  const stepClass = props?.stepClass || props?.STEPCLASS;
  if (stepClass === 'SUB') {
    return 'Subduction (red) — convergent with Benioff-zone criteria in PB2002. Arc volcanoes and deep quakes are common here; color is kinematic class, not recent seismicity.';
  }
  if (stepClass === 'OSR' || stepClass === 'CRB') {
    return 'Divergent (green) — plates moving apart (spreading ridge or continental rift). New crust or extension; not ranked by quake count.';
  }
  if (stepClass === 'OTF' || stepClass === 'CTF') {
    return 'Transform (yellow dashed) — strike-slip motion along the boundary step. San Andreas–style margins; dashed style marks shear, not activity level.';
  }
  if (stepClass === 'OCB' || stepClass === 'CCB') {
    return 'Convergent (orange) — plates colliding without PB2002 subduction classification (e.g. continent–continent). Distinct from red subduction tubes.';
  }

  const kind = props?.boundaryKind;
  if (kind === 'subduction') {
    return 'Subduction zone (red tube) — oceanic plate dives beneath another. Important for arc volcanoes and deep quakes, but line weight is not a seismicity scale.';
  }
  if (kind === 'divergent') {
    return 'Spreading or rift boundary (green) — divergent motion in PB2002.';
  }
  if (kind === 'transform') {
    return 'Transform boundary (yellow dashed) — strike-slip motion in PB2002.';
  }
  if (kind === 'convergent') {
    return 'Convergent boundary (orange) — collision without subduction class in PB2002.';
  }

  const type = (props?.Type || '').toLowerCase();
  if (type.includes('subduction')) {
    return 'Subduction zone — oceanic plate dives beneath another plate, fueling arcs, volcanoes, and deep quakes.';
  }
  if (type.includes('ridge')) {
    return 'Spreading ridge — new oceanic crust forms as plates move apart.';
  }
  if (type.includes('transform')) {
    return 'Transform fault — plates slide past each other horizontally.';
  }
  if (type.includes('collision')) {
    return 'Collision zone — continents or arcs collide, building mountains.';
  }
  return 'Plate interaction boundary from the PB2002 global model — style shows type, not quake rate.';
}

export function gvpVolcanoUrl(volcanoNumber) {
  if (!volcanoNumber) return 'https://volcano.si.edu/';
  return `https://volcano.si.edu/volcano/${volcanoNumber}`;
}

export function getGlobeInspectContext(scene) {
  return {
    ...GLOBE_ABOUT,
    hotspotAbout: scene?.getHotspotAbout?.() ?? GLOBE_ABOUT.hotspot,
    plateAbout: scene?.getPlateMotionAbout?.() ?? GLOBE_ABOUT.plate,
    radarAbout: scene?.getRadarAbout?.() ?? GLOBE_ABOUT.radar,
    radarCoverageNote: scene?.getRadarCoverageNote?.() ?? null,
  };
}

export function renderGlobeTooltip(selection) {
  if (!selection) return null;

  const { type, data } = selection;

  if (type === 'earthquake') {
    const note = earthquakeNote(data);
    return {
      className: 'globe-tooltip--quake',
      html: `
        <strong>M${data.mag?.toFixed(1) ?? '—'}</strong>
        <span class="globe-tooltip__kind">earthquake</span><br />
        <span class="globe-tooltip__detail">${esc(data.place || 'Unknown location')}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">
          ${data.depth != null ? `${data.depth.toFixed(1)} km depth` : 'Depth —'} · ${data.date || '—'}
          ${data.tsunami ? ' · tsunami' : ''}
        </span>
        ${note ? `<span class="globe-tooltip__note">${esc(note)}</span>` : ''}
      `,
    };
  }

  if (type === 'volcano') {
    const status = data.continuing ? 'ongoing' : `ended ${data.endDate || '—'}`;
    return {
      className: 'globe-tooltip--volcano',
      html: `
        <strong>${esc(data.name || 'Volcano')}</strong>
        <span class="globe-tooltip__kind">GVP episode</span><br />
        <span class="globe-tooltip__detail">VEI ${data.vei ?? '—'} · ${status}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">${data.startDate || '—'}${data.endDate && !data.continuing ? ` → ${data.endDate}` : ''}</span>
        <span class="globe-tooltip__note">${esc(volcanoNote(data))}</span>
      `,
    };
  }

  if (type === 'hotspot') {
    return {
      className: 'globe-tooltip--hotspot',
      html: `
        <strong>${esc(data.name)}</strong>
        <span class="globe-tooltip__kind">mantle hotspot</span><br />
        <span class="globe-tooltip__detail">${esc(data.volcano || '—')}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">${esc(data.chain || data.region || '')}</span>
      `,
    };
  }

  if (type === 'plate') {
    return {
      className: 'globe-tooltip--motion',
      html: `
        <strong>${esc(data.name)}</strong>
        <span class="globe-tooltip__kind">plate motion</span><br />
        <span class="globe-tooltip__detail">${data.speedMmYr?.toFixed(1) ?? '—'} mm/yr toward arrow</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">Code ${esc(data.code)} · ω ${data.degPerMa?.toFixed(2) ?? '—'} °/Ma</span>
      `,
    };
  }

  if (type === 'cyclone') {
    const wind = data.maxWindKts != null ? `${Math.round(data.maxWindKts)} kt` : '—';
    return {
      className: 'globe-tooltip--cyclone',
      html: `
        <strong>${esc(data.name || 'Cyclone')}</strong>
        <span class="globe-tooltip__kind">IBTrACS</span><br />
        <span class="globe-tooltip__detail">${esc(data.basin || '')} ${data.season || ''} · max ${wind}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">${data.startDate || '—'} → ${data.endDate || '—'}</span>
      `,
    };
  }

  if (type === 'weather') {
    return {
      className: 'globe-tooltip--weather',
      html: `
        <strong>${esc(data.label || data.gridId)}</strong>
        <span class="globe-tooltip__kind">ERA5 grid</span><br />
        <span class="globe-tooltip__detail">${data.tempMaxC != null ? `${data.tempMaxC.toFixed(0)}°C max` : '—'} · wind ${data.windMaxKmh != null ? `${data.windMaxKmh.toFixed(0)} km/h` : '—'}</span>
      `,
    };
  }

  if (type === 'radar') {
    const range = data.rangeKmNominal != null ? `${data.rangeKmNominal} km nominal` : '—';
    return {
      className: 'globe-tooltip--radar',
      html: `
        <strong>${esc(data.siteId)}</strong>
        <span class="globe-tooltip__kind">${esc(data.network)} ${esc(data.stationType || 'radar')}</span><br />
        <span class="globe-tooltip__detail">${esc(data.name || '—')} · ${esc(data.country || '')}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">Coverage ring ${range}</span>
      `,
    };
  }

  if (type === 'spin-pole') {
    return {
      className: 'globe-tooltip--pole',
      html: `
        <strong>Spin pole</strong>
        <span class="globe-tooltip__kind">IERS measured</span><br />
        <span class="globe-tooltip__detail">${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(2)}°</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">x ${data.xArcsec?.toFixed(1) ?? '—'}″ · y ${data.yArcsec?.toFixed(1) ?? '—'}″</span>
      `,
    };
  }

  if (type === 'magnetic-pole') {
    const hemi = data.hemisphere === 'south' ? 'South' : 'North';
    return {
      className: 'globe-tooltip--magpole',
      html: `
        <strong>${hemi} magnetic pole</strong>
        <span class="globe-tooltip__kind">IGRF-14 modeled</span><br />
        <span class="globe-tooltip__detail">${data.lat?.toFixed(2)}°, ${data.lon?.toFixed(1)}°</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">I ≈ ${data.inclinationDeg?.toFixed(1) ?? '—'}°</span>
      `,
    };
  }

  if (type === 'magnetometer') {
    const f = data.field;
    return {
      className: 'globe-tooltip--geomag',
      html: `
        <strong>${esc(data.name || data.iagaCode)}</strong>
        <span class="globe-tooltip__kind">INTERMAGNET · IGRF-14</span><br />
        <span class="globe-tooltip__detail">F ${f?.totalNt != null ? `${Math.round(f.totalNt)} nT` : '—'} · D ${f?.declDeg != null ? `${f.declDeg.toFixed(1)}°` : '—'} · I ${f?.inclDeg != null ? `${f.inclDeg.toFixed(1)}°` : '—'}</span><br />
        <span class="globe-tooltip__detail globe-tooltip__detail--muted">${esc(data.institute || '')}</span>
      `,
    };
  }

  if (type === 'plate-boundary') {
    const kindLabel = data.boundaryLabel || data.type || 'Plate boundary';
    const velocity =
      data.velocityMmYr != null ? `${data.velocityMmYr.toFixed(1)} mm/yr` : null;
    const meta = [
      velocity,
      data.stepLengthKm != null ? `${data.stepLengthKm.toFixed(0)} km step` : null,
      data.oceanic != null ? (data.oceanic ? 'oceanic' : 'continental') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    return {
      className: 'globe-tooltip--boundary',
      html: `
        <strong>${esc(data.name)}</strong>
        <span class="globe-tooltip__kind">${esc(kindLabel)}</span><br />
        <span class="globe-tooltip__detail">${esc(data.plates)}</span><br />
        ${meta ? `<span class="globe-tooltip__detail globe-tooltip__detail--muted">${esc(meta)}</span><br />` : ''}
        <span class="globe-tooltip__note">${esc(plateBoundaryNote(data))}</span>
      `,
    };
  }

  return null;
}