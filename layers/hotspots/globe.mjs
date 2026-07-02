import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from '../../src/utils.js';

export async function loadHotspots(url = '/data/hotspots.json') {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Hotspots ${res.status}`);
  return res.json();
}

export function buildHotspotGroup(data, radius = EARTH_RADIUS * 1.017) {
  const group = new THREE.Group();
  group.userData.about = data.about || null;
  const ringGeo = new THREE.RingGeometry(0.008, 0.014, 16);
  const coreGeo = new THREE.SphereGeometry(0.007, 12, 12);
  const pickGeo = new THREE.SphereGeometry(0.028, 10, 10);
  const pickMat = new THREE.MeshBasicMaterial({ visible: false });

  for (const hs of data.hotspots || []) {
    const pos = latLonToVector3(hs.lat, hs.lon, radius);
    const normal = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();

    const ring = new THREE.Mesh(
      ringGeo,
      new THREE.MeshBasicMaterial({
        color: 0xff5533,
        transparent: true,
        opacity: 0.75,
        side: THREE.DoubleSide,
      }),
    );
    ring.position.set(pos.x, pos.y, pos.z);
    ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    ring.userData = { ...hs, pickType: 'hotspot' };

    const core = new THREE.Mesh(
      coreGeo,
      new THREE.MeshBasicMaterial({ color: 0xffaa66 }),
    );
    core.position.set(pos.x, pos.y, pos.z);
    core.userData = { ...hs, pickType: 'hotspot' };

    const pick = new THREE.Mesh(pickGeo, pickMat);
    pick.position.set(pos.x, pos.y, pos.z);
    pick.userData = { ...hs, pickType: 'hotspot' };

    group.add(ring);
    group.add(core);
    group.add(pick);
  }

  return group;
}