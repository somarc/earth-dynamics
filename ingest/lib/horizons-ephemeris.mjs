import { AU_KM, EPHEMERIS_BODIES } from '../constants.mjs';

const HORIZONS_MONTHS = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

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
    records.push({ date, x, y, z, distAu, distKm: distAu * AU_KM });
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

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Horizons ${bodyId} HTTP ${res.status}`);
  const data = await res.json();
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
            (k) => EPHEMERIS_BODIES.find((b) => b.key === k).name,
          ),
          separationDeg: sep,
        });
      }
    }
  }

  return results.sort((a, b) => a.separationDeg - b.separationDeg).slice(0, 3);
}

export function buildEphemeris(eopDates, bodySeries) {
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
        Object.entries(bodies).map(([k, v]) => [
          k,
          { x: v.x, y: v.y, z: v.z, distAu: v.distAu, distKm: v.distKm },
        ]),
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

export async function fetchEphemerisForDates(dates) {
  if (!dates.length) return { dates: [], byDate: {} };

  const startDate = dates[0];
  const stopDate = dates.at(-1);
  const bodySeries = {};

  for (const body of EPHEMERIS_BODIES) {
    console.log(`  Horizons ${body.name} (${startDate} → ${stopDate})…`);
    const records = await fetchHorizonsBody(body.id, startDate, stopDate);
    bodySeries[body.key] = new Map(records.map((r) => [r.date, r]));
    console.log(`    ${records.length} vectors`);
    await new Promise((r) => setTimeout(r, 350));
  }

  const ephemeris = buildEphemeris(dates, bodySeries);

  console.log('  Horizons Earth heliocentric…');
  const earthHelio = await fetchHorizonsBody('399', startDate, stopDate, '500@10');
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