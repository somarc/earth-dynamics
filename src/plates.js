import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const MM_YR_TO_ARROW = 0.0011;
const MIN_ARROW = 0.035;
const MAX_ARROW = 0.11;

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
    const props = feature.properties;

    if (type === 'subduction' && points.length >= 4) {
      const curve = new THREE.CatmullRomCurve3(points);
      const tube = new THREE.Mesh(
        new THREE.TubeGeometry(curve, Math.min(points.length * 3, 120), 0.0045, 6, false),
        new THREE.MeshBasicMaterial({
          color: 0xff4422,
          transparent: true,
          opacity: 0.88,
        }),
      );
      tube.userData = props;
      group.add(tube);
      continue;
    }

    const mat = new THREE.LineBasicMaterial({
      color: boundaryColor(type),
      transparent: true,
      opacity: 0.55,
    });
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      mat,
    );
    line.userData = props;
    group.add(line);
  }

  return group;
}

export async function loadPlateMotion(url = '/data/plate-motion.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Plate motion ${res.status}`);
  return res.json();
}

function speedColor(speedMmYr) {
  const t = Math.min(speedMmYr / 80, 1);
  return new THREE.Color().setHSL(0.52 - t * 0.38, 0.75, 0.55);
}

export function buildMotionGroup(motionData, radius = EARTH_RADIUS * 1.018) {
  const group = new THREE.Group();

  for (const plate of motionData.plates || []) {
    const origin = latLonToVector3(plate.lat, plate.lon, radius);
    const dir = new THREE.Vector3(plate.dir.x, plate.dir.y, plate.dir.z).normalize();
    const length = Math.min(
      MAX_ARROW,
      Math.max(MIN_ARROW, plate.speedMmYr * MM_YR_TO_ARROW),
    );

    const arrow = new THREE.ArrowHelper(
      dir,
      new THREE.Vector3(origin.x, origin.y, origin.z),
      length,
      speedColor(plate.speedMmYr),
      length * 0.35,
      length * 0.22,
    );
    arrow.userData = plate;
    group.add(arrow);
  }

  return group;
}