#!/usr/bin/env node
/**
 * Build plate-motion.json from PB2002 Euler poles + plate polygons.
 * Sources: Bird (2003) PB2002, Peter Bird poles file.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const D2R = Math.PI / 180;
const EARTH_MM = 6371000 * 1000;

async function fetchText(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} ${res.status}`);
  return res.text();
}

function parsePoles(text) {
  const poles = new Map();
  for (const line of text.split('\n')) {
    if (!line.trim() || line.includes('PB2002_poles') || line.includes('ID, NLat')) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;
    const code = parts[0];
    const poleLat = parseFloat(parts[1]);
    const poleLon = parseFloat(parts[2]);
    const degPerMa = parseFloat(parts[3]);
    if (Number.isFinite(poleLat) && Number.isFinite(degPerMa)) {
      poles.set(code, { poleLat, poleLon, degPerMa });
    }
  }
  return poles;
}

function ringCentroid(ring) {
  let slat = 0;
  let slon = 0;
  for (const [lon, lat] of ring) {
    slat += lat;
    slon += lon;
  }
  return { lat: slat / ring.length, lon: slon / ring.length };
}

function plateCentroid(feature) {
  const geom = feature.geometry;
  const rings = geom.type === 'Polygon'
    ? [geom.coordinates[0]]
    : geom.coordinates.map((p) => p[0]);
  let best = rings[0];
  let bestLen = 0;
  for (const ring of rings) {
    if (ring.length > bestLen) {
      best = ring;
      bestLen = ring.length;
    }
  }
  return ringCentroid(best);
}

function latLonToUnit(lat, lon) {
  const phi = (90 - lat) * D2R;
  const theta = (lon + 180) * D2R;
  return {
    x: -Math.sin(phi) * Math.cos(theta),
    y: Math.cos(phi),
    z: Math.sin(phi) * Math.sin(theta),
  };
}

function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function norm(v) {
  return Math.hypot(v.x, v.y, v.z);
}

function velocityAt(lat, lon, poleLat, poleLon, degPerMa) {
  const ω = (degPerMa * D2R) / 1e6;
  const p = latLonToUnit(lat, lon);
  const e = latLonToUnit(poleLat, poleLon);
  const raw = cross(e, p);
  const sinPsi = norm(raw);
  if (sinPsi < 1e-8) return null;
  const speedMmYr = ω * EARTH_MM * sinPsi;
  return {
    dir: { x: raw.x / sinPsi, y: raw.y / sinPsi, z: raw.z / sinPsi },
    speedMmYr,
  };
}

async function main() {
  const [polesText, platesGeo] = await Promise.all([
    fetchText('http://peterbird.name/oldFTP/PB2002/PB2002_poles.dat.txt'),
    fetch('https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_plates.json').then((r) => r.json()),
  ]);

  const poles = parsePoles(polesText);
  const plates = [];

  for (const feature of platesGeo.features) {
    const code = feature.properties?.Code;
    const pole = poles.get(code);
    if (!pole) continue;
    const { lat, lon } = plateCentroid(feature);
    const vel = velocityAt(lat, lon, pole.poleLat, pole.poleLon, pole.degPerMa);
    if (!vel) continue;
    plates.push({
      code,
      name: feature.properties?.PlateName || code,
      lat,
      lon,
      poleLat: pole.poleLat,
      poleLon: pole.poleLon,
      degPerMa: pole.degPerMa,
      speedMmYr: Math.round(vel.speedMmYr * 10) / 10,
      dir: vel.dir,
    });
  }

  plates.sort((a, b) => b.speedMmYr - a.speedMmYr);
  mkdirSync(OUT, { recursive: true });
  const out = {
    source: 'PB2002 Euler poles (Bird 2003); plate centroids from PB2002 polygons',
    plates,
  };
  writeFileSync(join(OUT, 'plate-motion.json'), JSON.stringify(out, null, 2));
  console.log(`Wrote ${plates.length} plate motion vectors → public/data/plate-motion.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});