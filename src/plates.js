import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const MM_YR_TO_ARROW = 0.0011;
const MIN_ARROW = 0.035;
const MAX_ARROW = 0.11;

/** Bird (2003) PB2002 step classes — kinematic type, not seismic activity. */
export const STEP_CLASS = {
  SUB: 'SUB',
  OSR: 'OSR',
  OTF: 'OTF',
  OCB: 'OCB',
  CRB: 'CRB',
  CTF: 'CTF',
  CCB: 'CCB',
};

export const BOUNDARY_FAMILY = {
  SUBDUCTION: 'subduction',
  DIVERGENT: 'divergent',
  TRANSFORM: 'transform',
  CONVERGENT: 'convergent',
};

const STEP_CLASS_META = {
  [STEP_CLASS.SUB]: {
    family: BOUNDARY_FAMILY.SUBDUCTION,
    label: 'Subduction zone',
    short: 'Subduction',
  },
  [STEP_CLASS.OSR]: {
    family: BOUNDARY_FAMILY.DIVERGENT,
    label: 'Oceanic spreading ridge',
    short: 'Spreading ridge',
  },
  [STEP_CLASS.CRB]: {
    family: BOUNDARY_FAMILY.DIVERGENT,
    label: 'Continental rift',
    short: 'Rift',
  },
  [STEP_CLASS.OTF]: {
    family: BOUNDARY_FAMILY.TRANSFORM,
    label: 'Oceanic transform fault',
    short: 'Transform',
  },
  [STEP_CLASS.CTF]: {
    family: BOUNDARY_FAMILY.TRANSFORM,
    label: 'Continental transform fault',
    short: 'Transform',
  },
  [STEP_CLASS.OCB]: {
    family: BOUNDARY_FAMILY.CONVERGENT,
    label: 'Oceanic convergent boundary',
    short: 'Convergent',
  },
  [STEP_CLASS.CCB]: {
    family: BOUNDARY_FAMILY.CONVERGENT,
    label: 'Continental convergent boundary',
    short: 'Convergent',
  },
};

const FAMILY_STYLE = {
  [BOUNDARY_FAMILY.SUBDUCTION]: {
    color: 0xff3b2e,
    tubeRadius: 0.0048,
    tubeOpacity: 0.92,
    lineOpacity: 0.9,
  },
  [BOUNDARY_FAMILY.DIVERGENT]: {
    color: 0x3ecf8e,
    opacity: 0.78,
  },
  [BOUNDARY_FAMILY.TRANSFORM]: {
    color: 0xffd166,
    opacity: 0.82,
    dashSize: 0.024,
    gapSize: 0.016,
  },
  [BOUNDARY_FAMILY.CONVERGENT]: {
    color: 0xff9a3c,
    opacity: 0.76,
  },
};

const PLATE_STEPS_ABOUT =
  'PB2002 digitization steps (Bird 2003) — color and weight encode kinematic boundary class from Euler poles, not earthquake activity. Red = subduction; green = spreading/rift; yellow dashed = transform; orange = convergent (non-subduction).';

function coordsToPoints(coords, radius) {
  return coords.map(([lon, lat]) => {
    const p = latLonToVector3(lat, lon, radius);
    return new THREE.Vector3(p.x, p.y, p.z);
  });
}

export function stepClassMeta(stepClass) {
  return STEP_CLASS_META[stepClass] || STEP_CLASS_META[STEP_CLASS.OCB];
}

export function familyForStepClass(stepClass) {
  return stepClassMeta(stepClass).family;
}

export function labelForStepClass(stepClass) {
  return stepClassMeta(stepClass).label;
}

/** @deprecated segment fallback */
export function classifyBoundaryKind(props = {}) {
  const type = (props.Type || '').trim().toLowerCase();
  if (type === 'subduction') return BOUNDARY_FAMILY.SUBDUCTION;
  if (/[\\/]/.test(props.Name || '')) return BOUNDARY_FAMILY.SUBDUCTION;
  return BOUNDARY_FAMILY.CONVERGENT;
}

export function boundaryKindLabel(kind) {
  switch (kind) {
    case BOUNDARY_FAMILY.SUBDUCTION:
      return 'Subduction zone';
    case BOUNDARY_FAMILY.DIVERGENT:
      return 'Spreading / rift';
    case BOUNDARY_FAMILY.TRANSFORM:
      return 'Transform fault';
    case BOUNDARY_FAMILY.CONVERGENT:
      return 'Convergent boundary';
    default:
      return 'Plate boundary';
  }
}

function stepEndpoints(feature) {
  const coords = feature.geometry?.coordinates;
  if (coords?.length >= 2) {
    return [coords[0], coords[coords.length - 1]];
  }
  const p = feature.properties || {};
  return [
    [p.STARTLONG, p.STARTLAT],
    [p.FINALLONG, p.FINALLAT],
  ];
}

function enrichStepProps(props) {
  const stepClass = props.STEPCLASS || STEP_CLASS.OCB;
  const meta = stepClassMeta(stepClass);
  const plateBound = props.PLATEBOUND || '?';
  const [plateA, plateB] = plateBound.split('-');
  return {
    ...props,
    pickType: 'plate-step',
    stepClass,
    boundaryKind: meta.family,
    boundaryLabel: meta.label,
    Name: plateBound,
    PlateA: plateA || '?',
    PlateB: plateB || '?',
    plates: plateBound.replace('-', '–'),
    velocityMmYr: Math.max(props.VELOCITYLE ?? 0, props.VELOCITYRI ?? 0) || null,
  };
}

function addSubductionStep(group, points, props) {
  const style = FAMILY_STYLE[BOUNDARY_FAMILY.SUBDUCTION];
  const payload = enrichStepProps(props);

  if (points.length >= 4) {
    const curve = new THREE.CatmullRomCurve3(points);
    const tube = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 8, style.tubeRadius, 5, false),
      new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: style.tubeOpacity,
      }),
    );
    tube.userData = payload;
    group.add(tube);
    return;
  }

  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: style.lineOpacity,
    }),
  );
  line.userData = payload;
  group.add(line);
}

function addSolidStep(group, points, props, family) {
  const style = FAMILY_STYLE[family];
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({
      color: style.color,
      transparent: true,
      opacity: style.opacity,
    }),
  );
  line.userData = enrichStepProps(props);
  group.add(line);
}

function addDashedStep(group, points, props) {
  const style = FAMILY_STYLE[BOUNDARY_FAMILY.TRANSFORM];
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  const line = new THREE.Line(
    geo,
    new THREE.LineDashedMaterial({
      color: style.color,
      transparent: true,
      opacity: style.opacity,
      dashSize: style.dashSize,
      gapSize: style.gapSize,
    }),
  );
  line.computeLineDistances();
  line.userData = enrichStepProps(props);
  group.add(line);
}

export async function loadPlateSteps(url = '/data/plate-boundary-steps.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Plate boundary steps ${res.status}`);
  return res.json();
}

export async function loadPlateBoundaries(url = '/data/plate-boundaries.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Plate boundaries ${res.status}`);
  return res.json();
}

export function buildPlateStepsGroup(geojson, radius = EARTH_RADIUS * 1.012) {
  const group = new THREE.Group();
  group.userData.about = PLATE_STEPS_ABOUT;

  for (const feature of geojson.features || []) {
    const props = feature.properties || {};
    const stepClass = props.STEPCLASS;
    if (!stepClass) continue;

    const endpoints = stepEndpoints(feature);
    const points = coordsToPoints(endpoints, radius);
    if (points.length < 2) continue;

    const family = familyForStepClass(stepClass);

    if (family === BOUNDARY_FAMILY.SUBDUCTION) {
      addSubductionStep(group, points, props);
    } else if (family === BOUNDARY_FAMILY.TRANSFORM) {
      addDashedStep(group, points, props);
    } else {
      addSolidStep(group, points, props, family);
    }
  }

  return group;
}

/** Legacy segment renderer — fallback if steps file unavailable. */
export function buildPlateGroup(geojson, radius = EARTH_RADIUS * 1.012) {
  const group = new THREE.Group();
  group.userData.about = PLATE_STEPS_ABOUT;

  for (const feature of geojson.features || []) {
    const coords = feature.geometry?.coordinates;
    if (!coords?.length) continue;

    const points = coordsToPoints(coords, radius);
    if (points.length < 2) continue;

    const props = feature.properties || {};
    const kind = classifyBoundaryKind(props);
    const stepProps = {
      ...props,
      PLATEBOUND: props.Name || `${props.PlateA}-${props.PlateB}`,
      STEPCLASS: kind === BOUNDARY_FAMILY.SUBDUCTION ? STEP_CLASS.SUB : STEP_CLASS.OCB,
    };

    if (kind === BOUNDARY_FAMILY.SUBDUCTION) {
      addSubductionStep(group, points, stepProps);
    } else {
      addSolidStep(group, points, stepProps, BOUNDARY_FAMILY.CONVERGENT);
    }
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
    const payload = { ...plate, pickType: 'plate' };
    arrow.userData = payload;

    const pick = new THREE.Mesh(
      new THREE.SphereGeometry(0.03, 8, 8),
      new THREE.MeshBasicMaterial({ visible: false }),
    );
    pick.position.set(origin.x, origin.y, origin.z);
    pick.userData = payload;

    group.add(arrow);
    group.add(pick);
  }

  group.userData.about = motionData.about ?? null;
  return group;
}