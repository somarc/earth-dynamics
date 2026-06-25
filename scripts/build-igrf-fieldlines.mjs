#!/usr/bin/env node
/**
 * Precompute IGRF/WMM dipole field lines for Wobblescope.
 * WMM2020 north geomagnetic pole; analytic dipole L-shell traces.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
const D2R = Math.PI / 180;
const MAG_POLE = { lat: 80.65, lon: -72.68 };

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

function add(a, b, sa = 1, sb = 1) {
  return { x: sa * a.x + sb * b.x, y: sa * a.y + sb * b.y, z: sa * a.z + sb * b.z };
}

function scale(v, s) {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

function normalize(v) {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return scale(v, 1 / n);
}

function traceFieldLine(L, azimuthDeg, segments = 80) {
  const m = normalize(latLonToUnit(MAG_POLE.lat, MAG_POLE.lon));
  const up = { x: 0, y: 1, z: 0 };
  let east = normalize(cross(up, m));
  if (Math.hypot(east.x, east.y, east.z) < 1e-6) east = { x: 1, y: 0, z: 0 };
  const north = normalize(cross(m, east));
  const az = azimuthDeg * D2R;
  const u = normalize(add(east, north, Math.cos(az), Math.sin(az)));

  const points = [];
  for (let i = 0; i <= segments; i++) {
    const theta = 0.05 + (Math.PI - 0.1) * (i / segments);
    const r = L * Math.sin(theta) ** 2;
    const alongM = Math.cos(theta) * r;
    const alongU = Math.sin(theta) * r;
    const v = add(m, u, alongM, alongU);
    points.push(v);
  }
  return points;
}

const L_VALUES = [1.12, 1.3, 1.55, 1.9, 2.4, 3.2];
const AZIMUTHS = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
const lines = L_VALUES.flatMap((L) =>
  AZIMUTHS.map((azimuth) => ({ L, azimuth, points: traceFieldLine(L, azimuth) })),
);

mkdirSync(OUT, { recursive: true });
writeFileSync(
  join(OUT, 'field-lines-igrf.json'),
  JSON.stringify({
    source: 'WMM2020 dipole axis; analytic L-shell field lines',
    magneticPole: MAG_POLE,
    lines,
  }),
);
console.log(`Wrote ${lines.length} IGRF field lines → public/data/field-lines-igrf.json`);