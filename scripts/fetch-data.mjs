#!/usr/bin/env node
/**
 * Fetches and preprocesses verifiable geophysical datasets for Wobblescope.
 *
 * Sources:
 * - IERS EOP C04 (polar motion x,y, LOD, pole rates)
 * - USGS FDSN Event API (earthquakes M≥5)
 * - Smithsonian GVP WFS (eruptions since 1960, holocene volcanoes)
 * - NASA JPL Horizons (geocentric ecliptic ephemeris, DE441)
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'public', 'data');

const NOMINAL_OMEGA_PICORAD_S = 72921151.467064;
const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
const AU_KM = 149597870.7;
const MEAN_MOON_KM = 384400;

const HORIZONS_MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

const EPHEMERIS_BODIES = [
  { id: '301', key: 'moon', name: 'Moon' },
  { id: '10', key: 'sun', name: 'Sun' },
  { id: '199', key: 'mercury', name: 'Mercury' },
  { id: '299', key: 'venus', name: 'Venus' },
  { id: '499', key: 'mars', name: 'Mars' },
  { id: '599', key: 'jupiter', name: 'Jupiter' },
  { id: '699', key: 'saturn', name: 'Saturn' },
];

const SOURCES = {
  iersEop: {
    url: 'https://hpiers.obspm.fr/iers/eop/eopc04/eopc04.1962-now',
    name: 'IERS Earth Orientation Parameters C04',
    org: 'International Earth Rotation and Reference Systems Service (IERS)',
    citation: 'Bizouard et al., IERS EOP C04 series consistent with ITRF 2020',
    link: 'https://hpiers.obspm.fr/eop-pc/index.php?index=C04&lang=en',
  },
  usgsEarthquakes: {
    name: 'USGS Earthquake Catalog',
    org: 'U.S. Geological Survey',
    citation: 'USGS FDSN Event Web Service',
    link: 'https://earthquake.usgs.gov/fdsnws/event/1/',
  },
  gvpEruptions: {
    url: 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:E3WebApp_Eruptions1960&outputFormat=application/json',
    name: 'Smithsonian GVP Eruptions Since 1960',
    org: 'Smithsonian Institution Global Volcanism Program',
    citation: 'Global Volcanism Program, E3WebApp_Eruptions1960',
    link: 'https://volcano.si.edu/database/webservices.cfm',
  },
  gvpVolcanoes: {
    url: 'https://webservices.volcano.si.edu/geoserver/GVP-VOTW/wfs?service=WFS&version=2.0.0&request=GetFeature&typeName=GVP-VOTW:Smithsonian_VOTW_Holocene_Volcanoes&outputFormat=application/json',
    name: 'Smithsonian GVP Holocene Volcanoes',
    org: 'Smithsonian Institution Global Volcanism Program',
    citation: 'Global Volcanism Program, Holocene Volcano List',
    link: 'https://volcano.si.edu/gvp_votw.cfm',
  },
  jplHorizons: {
    name: 'JPL Horizons Ephemeris',
    org: 'NASA Jet Propulsion Laboratory',
    citation: 'Horizons API, DE441 ephemeris, geocentric ecliptic vectors',
    link: 'https://ssd.jpl.nasa.gov/horizons/',
  },
};

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function fetchJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

function parseEop(text) {
  const records = [];
  for (const line of text.split('\n')) {
    if (!line.trim() || line.startsWith('#')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 15) continue;

    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    const mjd = parseFloat(parts[4]);
    const xArcsec = parseFloat(parts[5]);
    const yArcsec = parseFloat(parts[6]);
    const lodSec = parseFloat(parts[13]);

    const date = new Date(Date.UTC(year, month - 1, day));
    const omegaPicoradS = NOMINAL_OMEGA_PICORAD_S * (1 - lodSec / 86400);
    const deltaOmegaPicoradS = omegaPicoradS - NOMINAL_OMEGA_PICORAD_S;

    records.push({
      date: date.toISOString().slice(0, 10),
      mjd,
      xArcsec,
      yArcsec,
      xMas: xArcsec * 1000,
      yMas: yArcsec * 1000,
      lodMs: lodSec * 1000,
      lodSec,
      omegaPicoradS,
      deltaOmegaPicoradS,
      xRad: xArcsec * ARCSEC_TO_RAD,
      yRad: yArcsec * ARCSEC_TO_RAD,
    });
  }
  return records;
}

async function fetchEarthquakes(startYear = 1990, minMag = 5.0) {
  const endYear = new Date().getFullYear();
  const all = [];

  for (let year = startYear; year <= endYear; year++) {
    const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
    url.searchParams.set('format', 'geojson');
    url.searchParams.set('starttime', `${year}-01-01`);
    url.searchParams.set('endtime', `${year}-12-31`);
    url.searchParams.set('minmagnitude', String(minMag));
    url.searchParams.set('orderby', 'time-asc');
    url.searchParams.set('limit', '20000');

    console.log(`  Fetching earthquakes ${year} (M≥${minMag})…`);
    const data = await fetchJson(url.toString());

    for (const f of data.features) {
      const [lon, lat, depth] = f.geometry.coordinates;
      all.push({
        id: f.id,
        time: f.properties.time,
        date: new Date(f.properties.time).toISOString().slice(0, 10),
        mag: f.properties.mag,
        place: f.properties.place,
        lat,
        lon,
        depth,
        url: f.properties.url,
        tsunami: f.properties.tsunami === 1,
      });
    }
  }

  return all;
}

function processEruptions(geojson) {
  return geojson.features.map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    const startDate = `${p.StartDateYear}-${String(p.StartDateMonth).padStart(2, '0')}-${String(p.StartDateDay).padStart(2, '0')}`;
    const endDate = p.EndDateYear
      ? `${p.EndDateYear}-${String(p.EndDateMonth).padStart(2, '0')}-${String(p.EndDateDay).padStart(2, '0')}`
      : null;

    return {
      id: p.Activity_ID,
      volcanoNumber: p.VolcanoNumber,
      name: p.VolcanoName,
      vei: p.ExplosivityIndexMax,
      startDate,
      endDate,
      continuing: p.ContinuingEruption === 'True',
      lat,
      lon,
    };
  });
}

function parseHorizonsDate(raw) {
  const match = raw.match(/(\d{4})-(\w{3})-(\d{2})/);
  if (!match) return null;
  return `${match[1]}-${HORIZONS_MONTHS[match[2]]}-${match[3]}`;
}

function parseHorizonsVectors(resultText) {
  const soe = resultText.indexOf('SOE');
  const eoe = resultText.indexOf('EOE');
  if (soe < 0 || eoe < 0) return [];

  const block = resultText.slice(soe + 3, eoe).trim();
  const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
  const records = [];

  for (let i = 0; i < lines.length; i += 3) {
    const dateLine = lines[i];
    const posLine = lines[i + 1];
    if (!dateLine || !posLine) continue;

    const date = parseHorizonsDate(dateLine);
    const coords = posLine.split(/\s+/).filter(Boolean).map(Number);
    if (!date || coords.length < 3) continue;

    const [x, y, z] = coords;
    const distAu = Math.sqrt(x * x + y * y + z * z);
    records.push({
      date,
      x,
      y,
      z,
      distAu,
      distKm: distAu * AU_KM,
    });
  }

  return records;
}

async function fetchHorizonsBody(bodyId, startDate, stopDate, center = '500@399') {
  const url = new URL('https://ssd.jpl.nasa.gov/api/horizons.api');
  url.searchParams.set('format', 'json');
  url.searchParams.set('COMMAND', `'${bodyId}'`);
  url.searchParams.set('MAKE_EPHEM', 'YES');
  url.searchParams.set('EPHEM_TYPE', 'VECTORS');
  url.searchParams.set('CENTER', center);
  url.searchParams.set('START_TIME', startDate);
  url.searchParams.set('STOP_TIME', stopDate);
  url.searchParams.set('STEP_SIZE', '1d');
  url.searchParams.set('REF_PLANE', 'ECLIPTIC');
  url.searchParams.set('VEC_TABLE', '2');
  url.searchParams.set('OUT_UNITS', 'AU-D');
  url.searchParams.set('VEC_LABELS', 'NO');

  const data = await fetchJson(url.toString());
  if (!data.result) throw new Error(`Horizons empty response for body ${bodyId}`);
  return parseHorizonsVectors(data.result);
}

function phaseName(angleDeg) {
  if (angleDeg < 22.5) return 'New Moon';
  if (angleDeg < 67.5) return 'Waxing Crescent';
  if (angleDeg < 112.5) return 'First Quarter';
  if (angleDeg < 157.5) return 'Waxing Gibbous';
  if (angleDeg < 202.5) return 'Full Moon';
  if (angleDeg < 247.5) return 'Waning Gibbous';
  if (angleDeg < 292.5) return 'Last Quarter';
  if (angleDeg < 337.5) return 'Waning Crescent';
  return 'New Moon';
}

function angleBetween(a, b) {
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  const mag = a.distAu * b.distAu;
  if (!mag) return 0;
  return (Math.acos(Math.min(1, Math.max(-1, dot / mag))) * 180) / Math.PI;
}

function eclipticLongitude(body) {
  return (Math.atan2(body.y, body.x) * 180) / Math.PI;
}

function findAlignments(bodies, thresholdDeg = 18) {
  const planets = ['mercury', 'venus', 'mars', 'jupiter', 'saturn']
    .filter((k) => bodies[k])
    .map((k) => ({ key: k, lon: eclipticLongitude(bodies[k]) }));

  const results = [];
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      let sep = Math.abs(planets[i].lon - planets[j].lon);
      if (sep > 180) sep = 360 - sep;
      if (sep <= thresholdDeg) {
        results.push({
          planets: [planets[i].key, planets[j].key].map(
            (k) => EPHEMERIS_BODIES.find((b) => b.key === k).name
          ),
          separationDeg: sep,
        });
      }
    }
  }

  return results.sort((a, b) => a.separationDeg - b.separationDeg).slice(0, 3);
}

function buildEphemeris(eopDates, bodySeries) {
  const byDate = {};
  const moonDistances = [];

  for (const date of eopDates) {
    const bodies = {};
    for (const { key } of EPHEMERIS_BODIES) {
      const rec = bodySeries[key]?.get(date);
      if (rec) bodies[key] = rec;
    }

    if (!bodies.moon || !bodies.sun) continue;

    const phaseAngle = angleBetween(bodies.sun, bodies.moon);
    const illumination = (1 - Math.cos((phaseAngle * Math.PI) / 180)) / 2;
    let syzygy = null;
    if (phaseAngle < 15) syzygy = 'new';
    else if (phaseAngle > 165) syzygy = 'full';

    moonDistances.push({ date, distKm: bodies.moon.distKm });

    byDate[date] = {
      ...Object.fromEntries(
        Object.entries(bodies).map(([k, v]) => [k, { x: v.x, y: v.y, z: v.z, distAu: v.distAu, distKm: v.distKm }])
      ),
      lunar: {
        phaseAngle,
        phaseName: phaseName(phaseAngle),
        illumination,
        moonDistanceKm: Math.round(bodies.moon.distKm),
        sunElongation: phaseAngle,
        syzygy,
        isPerigee: false,
        isApogee: false,
        tidalIndex: 0,
      },
      alignments: findAlignments(bodies),
    };
  }

  const distByDate = new Map(moonDistances.map((d) => [d.date, d.distKm]));
  const meanMoonDist =
    moonDistances.reduce((s, d) => s + d.distKm, 0) / (moonDistances.length || 1);
  const meanTidal = 1 / meanMoonDist ** 3;

  for (const date of Object.keys(byDate)) {
    const day = byDate[date];
    const moonKm = distByDate.get(date);
    const idx = moonDistances.findIndex((d) => d.date === date);
    const prev = moonDistances[idx - 1]?.distKm;
    const next = moonDistances[idx + 1]?.distKm;

    if (prev && next && moonKm <= prev && moonKm <= next) day.lunar.isPerigee = true;
    if (prev && next && moonKm >= prev && moonKm >= next) day.lunar.isApogee = true;

    const moonTide = 1 / moonKm ** 3;
    const sunKm = day.sun?.distKm || AU_KM;
    const sunTide = 1 / sunKm ** 3;
    day.lunar.tidalIndex = (moonTide + 0.46 * sunTide) / (meanTidal + 0.46 / AU_KM ** 3);
  }

  return { dates: eopDates.filter((d) => byDate[d]), byDate };
}

async function fetchEphemeris(eopDates) {
  const startDate = eopDates[0];
  const stopDate = eopDates.at(-1);
  const bodySeries = {};

  for (const body of EPHEMERIS_BODIES) {
    console.log(`  Fetching ${body.name} (${startDate} → ${stopDate})…`);
    const records = await fetchHorizonsBody(body.id, startDate, stopDate);
    bodySeries[body.key] = new Map(records.map((r) => [r.date, r]));
    console.log(`    ${records.length} vectors`);
    await new Promise((r) => setTimeout(r, 300));
  }

  const ephemeris = buildEphemeris(eopDates, bodySeries);

  console.log('  Fetching heliocentric Earth (Sun-centered)…');
  const earthHelio = await fetchHorizonsBody('399', startDate, stopDate, '500@10');
  console.log(`    ${earthHelio.length} heliocentric vectors`);
  for (const rec of earthHelio) {
    if (ephemeris.byDate[rec.date]) {
      ephemeris.byDate[rec.date].earthHelio = {
        x: rec.x,
        y: rec.y,
        z: rec.z,
        distAu: rec.distAu,
        distKm: rec.distKm,
      };
    }
  }

  return ephemeris;
}

function processVolcanoes(geojson) {
  return geojson.features.map((f) => {
    const p = f.properties;
    const [lon, lat] = f.geometry.coordinates;
    return {
      volcanoNumber: p.Volcano_Number,
      name: p.Volcano_Name,
      country: p.Country,
      region: p.Region,
      lastEruptionYear: p.Last_Eruption_Year,
      lat,
      lon,
      elevation: p.Elevation,
      type: p.Primary_Volcano_Type,
    };
  });
}

async function main() {
  await mkdir(DATA_DIR, { recursive: true });
  console.log('Fetching geophysical datasets…\n');

  console.log('1. IERS EOP C04 polar motion & LOD…');
  const eopText = await fetchText(SOURCES.iersEop.url);
  const eop = parseEop(eopText);
  console.log(`   ${eop.length} daily records (${eop[0].date} → ${eop.at(-1).date})`);

  console.log('2. USGS earthquakes…');
  const earthquakes = await fetchEarthquakes(1990, 5.0);
  console.log(`   ${earthquakes.length} events`);

  console.log('3. GVP eruptions since 1960…');
  const eruptionsRaw = await fetchJson(SOURCES.gvpEruptions.url);
  const eruptions = processEruptions(eruptionsRaw);
  console.log(`   ${eruptions.length} eruption episodes`);

  console.log('4. GVP holocene volcanoes…');
  const volcanoesRaw = await fetchJson(SOURCES.gvpVolcanoes.url);
  const volcanoes = processVolcanoes(volcanoesRaw);
  console.log(`   ${volcanoes.length} volcanoes`);

  console.log('5. JPL Horizons solar system ephemeris…');
  const ephemeris = await fetchEphemeris(eop.map((r) => r.date));
  console.log(`   ${ephemeris.dates.length} daily ephemeris records`);

  const manifest = {
    generated: new Date().toISOString(),
    sources: SOURCES,
    ranges: {
      eop: { start: eop[0].date, end: eop.at(-1).date, count: eop.length },
      earthquakes: {
        start: earthquakes[0]?.date,
        end: earthquakes.at(-1)?.date,
        count: earthquakes.length,
        minMagnitude: 5.0,
      },
      eruptions: {
        start: eruptions[0]?.startDate,
        end: eruptions.at(-1)?.startDate,
        count: eruptions.length,
      },
      volcanoes: { count: volcanoes.length },
      ephemeris: {
        start: ephemeris.dates[0],
        end: ephemeris.dates.at(-1),
        count: ephemeris.dates.length,
        bodies: EPHEMERIS_BODIES.map((b) => b.name),
      },
    },
    constants: {
      nominalOmegaPicoradS: NOMINAL_OMEGA_PICORAD_S,
      nominalDayLengthSec: 86400,
      arcsecToRad: ARCSEC_TO_RAD,
      poleMotionNote: 'IERS x,y are celestial pole offsets in arcseconds; polhode plotted as (x, -y) per IERS convention.',
    },
  };

  await writeFile(join(DATA_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));
  await writeFile(join(DATA_DIR, 'eop.json'), JSON.stringify(eop));
  await writeFile(join(DATA_DIR, 'earthquakes.json'), JSON.stringify(earthquakes));
  await writeFile(join(DATA_DIR, 'eruptions.json'), JSON.stringify(eruptions));
  await writeFile(join(DATA_DIR, 'volcanoes.json'), JSON.stringify(volcanoes));
  await writeFile(
    join(DATA_DIR, 'ephemeris.json'),
    JSON.stringify({
      meta: {
        auKm: AU_KM,
        meanMoonKm: MEAN_MOON_KM,
        frame: 'Geocentric ecliptic J2000 (JPL DE441)',
        bodies: EPHEMERIS_BODIES,
      },
      dates: ephemeris.dates,
      byDate: ephemeris.byDate,
    })
  );

  console.log('\nDone. Data written to public/data/');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});