import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from './utils.js';

const SURFACE = EARTH_RADIUS * 1.018;

function placeMarker(group, pole, { color, size, pickType }) {
  if (pole?.lat == null || pole?.lon == null) return;
  const pos = latLonToVector3(pole.lat, pole.lon, SURFACE);
  const mesh = new THREE.Mesh(
    new THREE.OctahedronGeometry(size, 0),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.set(pos.x, pos.y, pos.z);
  const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
  const payload = { ...pole, pickType };
  mesh.userData = payload;
  group.add(mesh);

  const pick = new THREE.Mesh(
    new THREE.SphereGeometry(size * 2.4, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  );
  pick.position.copy(mesh.position);
  pick.userData = payload;
  group.add(pick);
}

export function updateMagneticPoleMarkers(group, magneticPoles, visible) {
  group.clear();
  if (!visible || !magneticPoles) {
    group.visible = false;
    return;
  }

  placeMarker(group, magneticPoles.north, {
    color: 0xb388ff,
    size: 0.022,
    pickType: 'magnetic-pole',
  });
  placeMarker(group, magneticPoles.south, {
    color: 0x7c5cbf,
    size: 0.016,
    pickType: 'magnetic-pole',
  });

  group.visible = group.children.length > 0;
}