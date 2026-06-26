import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';
import { updateIgrfFieldLines } from './igrf.js';

const SURFACE_RADIUS = EARTH_RADIUS * 1.014;

export function hasGeomagContext(geomagnetic, spaceWeather = []) {
  if (geomagnetic?.kpMax != null) return true;
  if (geomagnetic?.dstMin != null) return true;
  if (geomagnetic?.swSpeedKms != null) return true;
  if (geomagnetic?.swBzNt != null) return true;
  return (spaceWeather?.length ?? 0) > 0;
}

function localBasis(lat, lon) {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const up = new THREE.Vector3(
    -Math.sin(phi) * Math.cos(theta),
    Math.cos(phi),
    Math.sin(phi) * Math.sin(theta),
  );
  const north = new THREE.Vector3(
    -Math.cos(phi) * Math.cos(theta),
    -Math.sin(phi),
    Math.cos(phi) * Math.sin(theta),
  );
  const east = new THREE.Vector3(Math.sin(theta), 0, -Math.cos(theta));
  return { up, north, east };
}

function fieldDirectionWorld(lat, lon, field) {
  const { up, north, east } = localBasis(lat, lon);
  const dir = new THREE.Vector3()
    .addScaledVector(north, field.northNt)
    .addScaledVector(east, field.eastNt)
    .addScaledVector(up, -field.downNt);
  if (dir.lengthSq() < 1e-6) return null;
  return dir.normalize();
}

function buildObservatoryGlyphs(magnetometers, opacity) {
  const group = new THREE.Group();
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const obs of magnetometers || []) {
    if (obs.lat == null || obs.lon == null || !obs.field) continue;

    const anchorVec = new THREE.Vector3(
      ...Object.values(latLonToVector3(obs.lat, obs.lon, SURFACE_RADIUS)),
    );
    const dir = fieldDirectionWorld(obs.lat, obs.lon, obs.field);
    const payload = { ...obs, pickType: 'magnetometer' };

    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, 8, 8),
      new THREE.MeshBasicMaterial({
        color: 0xc8e8ff,
        transparent: true,
        opacity: Math.min(1, opacity + 0.35),
      }),
    );
    dot.position.copy(anchorVec);
    dot.userData = payload;
    group.add(dot);

    if (dir) {
      const arrowLen = 0.055;
      const tip = anchorVec.clone().add(dir.clone().multiplyScalar(arrowLen));
      group.add(
        new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([anchorVec, tip]),
          new THREE.LineBasicMaterial({
            color: 0xffe08a,
            transparent: true,
            opacity: Math.min(1, opacity + 0.2),
          }),
        ),
      );
    }

    const pick = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 8), pickMat);
    pick.position.copy(anchorVec);
    pick.userData = payload;
    group.add(pick);
  }

  return group;
}

/** Decorative WMM L-shell arcs — dipole frame, not geography-fixed. */
export function updateDecorativeFieldLines(group, kp, visible, data) {
  updateIgrfFieldLines(group, kp, visible, data);
  group.visible = visible && group.children.length > 0;
}

/** INTERMAGNET anchors — only when space-weather context exists for the scrub date. */
export function updateObservatoryLayer(group, magnetometers, visible, { kp = null } = {}) {
  group.clear();
  if (!visible || !magnetometers?.length) {
    group.visible = false;
    return;
  }

  const opacity = 0.4 + Math.min((kp ?? 0) * 0.04, 0.3);
  group.add(buildObservatoryGlyphs(magnetometers, opacity));
  group.visible = true;
}

export function updateGeomagLayer(
  observatoryGroup,
  fieldLineGroup,
  magnetometers,
  fieldLineData,
  visible,
  { kp = null, showObservatories = false } = {},
) {
  updateDecorativeFieldLines(fieldLineGroup, kp, visible, fieldLineData);
  updateObservatoryLayer(
    observatoryGroup,
    showObservatories ? magnetometers : [],
    visible,
    { kp },
  );
}