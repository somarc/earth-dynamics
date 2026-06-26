import { GLOBE_ABOUT } from './globe-inspect.js';

const DEFAULT_HELP = 'Hover a legend chip to see what it represents on the globe.';

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const LEGEND_GEO = [
  {
    id: 'pole',
    class: 'pole',
    label: '● Spin',
    title: 'Rotation (spin) pole',
    help:
      'IERS instantaneous pole — where Earth’s spin axis pierces the surface on this date (~meters of polar wander; see Polhode panel). Not the same as the magnetic pole.',
  },
  {
    id: 'magpole',
    class: 'magpole',
    label: '◆ Mag',
    title: 'Magnetic dip poles',
    help:
      'IGRF-14 modeled north (bright) and south (dim) dip poles where the main field is vertical. Hundreds of km from the spin pole and drifting on the order of km per year — contrast with the yellow spin marker.',
  },
  {
    id: 'axis',
    class: 'axis',
    label: '— Axis',
    title: 'Rotation axis',
    help: "Earth's mean spin axis on the globe — the reference direction everything rotates around.",
  },
  {
    id: 'quake',
    class: 'quake',
    label: '◉ M≥',
    title: 'Earthquakes',
    help:
      'USGS catalog events at or above the magnitude floor in the footer. Size and color reflect magnitude; click or hover markers on the globe for depth and place.',
  },
  {
    id: 'volcano',
    class: 'volcano',
    label: '▲ GVP',
    title: 'Active eruptions (GVP)',
    help: GLOBE_ABOUT.volcano,
  },
  {
    id: 'storm',
    class: 'storm',
    label: '◈ Storm',
    title: 'US storm events',
    help:
      'NOAA NCEI significant storm events (tornado, hurricane, flood, etc.) in the events panel for the selected window — list layer, not always on the globe.',
  },
  {
    id: 'moon',
    class: 'moon',
    label: '◯ Moon',
    title: 'Moon',
    help: 'JPL DE441 geocentric Moon position, scaled on the globe for orientation with tides and syzygy in the orbital panels.',
  },
  {
    id: 'sun',
    class: 'sun',
    label: '☀ Sun',
    title: 'Sun direction',
    help:
      'Direction toward the Sun from ephemeris — drives lighting, terminator, and the space-weather coupling story (not a sized disc at true distance).',
  },
  {
    id: 'plates',
    class: 'plates',
    label: '— Plates',
    title: 'Plate boundaries',
    help: GLOBE_ABOUT.plateBoundary,
  },
  {
    id: 'motion',
    class: 'motion',
    label: '→ Motion',
    title: 'Plate motion',
    help: GLOBE_ABOUT.plate,
  },
  {
    id: 'hotspot',
    class: 'hotspot',
    label: '◎ Hotspot',
    title: 'Mantle hotspots',
    help: GLOBE_ABOUT.hotspot,
  },
  {
    id: 'aurora',
    class: 'aurora',
    label: '◌ Aurora',
    title: 'Aurora oval',
    help:
      'Auroral oval from OVATION nowcast when near real time, otherwise Kp-derived rings — where energetic particles meet the upper atmosphere during geomagnetic activity.',
  },
  {
    id: 'field',
    class: 'field',
    label: '⌇ Geomag',
    title: 'Geomagnetic field',
    help:
      'Default WMM dipole field-line arcs for orientation (pedagogical). When the scrub date has space-weather context (Kp, Dst, solar wind, or DONKI events), INTERMAGNET observatory dots and IGRF-14 declination ticks appear — modeled vectors at measured station sites, not live magnetograms.',
  },
  {
    id: 'cyclone',
    class: 'cyclone',
    label: '〰 Cyclone',
    title: 'Tropical cyclones',
    help: GLOBE_ABOUT.cyclone,
  },
  {
    id: 'weather',
    class: 'weather',
    label: '◌ Weather',
    title: 'Weather grid',
    help: GLOBE_ABOUT.weather,
  },
];

export const LEGEND_HELIO = [
  {
    id: 'sun',
    class: 'sun',
    label: '☀ Sun',
    title: 'Sun',
    help: 'Heliocentric view: the Sun sits at the origin. Planets and CME markers are placed from JPL vectors.',
  },
  {
    id: 'axis',
    class: 'axis',
    label: '— Axis',
    title: "Earth's spin axis",
    help: "Earth's spin axis shown at 23.44° obliquity — ties heliocentric geometry back to seasons and pole motion.",
  },
  {
    id: 'ecliptic',
    class: 'ecliptic',
    label: '— Ecliptic',
    title: 'Ecliptic north',
    help: 'Normal to the ecliptic plane — the fundamental reference for planetary orbits and the helical chart.',
  },
  {
    id: 'pole',
    class: 'pole',
    label: '● Pole',
    title: 'Instantaneous pole',
    help: 'Same IERS pole marker carried into heliocentric view for continuity with the rotation panels.',
  },
  {
    id: 'moon',
    class: 'moon',
    label: '◯ Moon',
    title: 'Moon',
    help: "Moon in the heliocentric frame when enabled — Earth's companion in the ecliptic plane.",
  },
  {
    id: 'cme',
    class: 'cme',
    label: '▷ CME',
    title: 'CME markers',
    help:
      'NASA DONKI coronal mass ejections with Earth-directed components — markers in the heliocentric scene, linked to Dst/Kp in space-weather panels.',
  },
  {
    id: 'quake',
    class: 'quake',
    label: '◉ M≥',
    title: 'Earthquakes',
    help:
      'Earthquakes still plotted on the embedded Earth globe in this view — same USGS catalog and magnitude floor as geocentric mode.',
  },
];

function legendItems(view) {
  return view === 'heliocentric' ? LEGEND_HELIO : LEGEND_GEO;
}

function itemLabel(item, quakeMinMag) {
  if (item.id === 'quake') return `◉ M≥${quakeMinMag}`;
  return item.label;
}

export function renderLegendHtml(view, quakeMinMag = 5) {
  return legendItems(view)
    .map(
      (item) =>
        `<span class="legend__item legend__item--${item.class}" data-legend-id="${item.id}" tabindex="0">${esc(itemLabel(item, quakeMinMag))}</span>`,
    )
    .join('');
}

export function bindLegendHelp(legendEl, helpEl) {
  if (!legendEl || !helpEl) return;

  const lookup = new Map(
    [...LEGEND_GEO, ...LEGEND_HELIO].map((item) => [item.id, item]),
  );

  const show = (id) => {
    const item = lookup.get(id);
    if (!item) return;
    helpEl.innerHTML = `<strong>${esc(item.title)}</strong> — ${esc(item.help)}`;
  };

  const reset = () => {
    helpEl.textContent = DEFAULT_HELP;
  };

  legendEl.addEventListener('mouseover', (e) => {
    const chip = e.target.closest('[data-legend-id]');
    if (chip) show(chip.dataset.legendId);
  });

  legendEl.addEventListener('focusin', (e) => {
    const chip = e.target.closest('[data-legend-id]');
    if (chip) show(chip.dataset.legendId);
  });

  legendEl.addEventListener('mouseleave', reset);
  legendEl.addEventListener('focusout', (e) => {
    if (!legendEl.contains(e.relatedTarget)) reset();
  });

  reset();
}