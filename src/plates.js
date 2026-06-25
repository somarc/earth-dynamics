import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const BOUNDARY_COLORS = {
  subduction: 0xff6b4a,
  default: 0xffd166,
};

function boundaryColor(type) {
  return BOUNDARY_COLORS[type] ?? BOUNDARY_COLORS.default;
}

function coordsToPoints(coords, radius) {
  return coords.map(([lon, lat]) => {
    const p = latLonToVector3(lat, lon, radius);
    return new THREE.Vector3(p.x, p.y, p.z);
  });
}

export async function loadPlateBoundaries(url = '/data/plate-boundaries.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Plate boundaries ${res.status}`);
  return res.json();
}

export function buildPlateGroup(geojson, radius = EARTH_RADIUS * 1.012) {
  const group = new THREE.Group();

  for (const feature of geojson.features || []) {
    const coords = feature.geometry?.coordinates;
    if (!coords?.length) continue;

    const points = coordsToPoints(coords, radius);
    if (points.length < 2) continue;

    const type = feature.properties?.Type || '';
    const mat = new THREE.LineBasicMaterial({
      color: boundaryColor(type),
      transparent: true,
      opacity: type === 'subduction' ? 0.85 : 0.65,
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      mat,
    );
    line.userData = feature.properties;
    group.add(line);
  }

  return group;
}