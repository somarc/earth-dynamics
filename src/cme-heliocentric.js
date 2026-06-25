import * as THREE from 'three';

const AU_SCALE = 12;
const DAY_SEC = 86400;

function parseTime(iso) {
  return iso ? new Date(iso).getTime() : null;
}

function daysBetween(startMs, endMs) {
  if (!startMs || !endMs) return null;
  return Math.max(0, (endMs - startMs) / (DAY_SEC * 1000));
}

export function buildCmeMarkers(cmes, viewDate, earthPos) {
  const group = new THREE.Group();
  if (!cmes?.length || !earthPos) return group;

  const viewMs = parseTime(`${viewDate}T12:00:00Z`);
  const sunToEarth = earthPos.clone().normalize();

  for (const cme of cmes) {
    const startMs = parseTime(cme.startTime);
    if (startMs == null || startMs > viewMs) continue;

    const ageDays = daysBetween(startMs, viewMs);
    if (ageDays == null || ageDays > 5) continue;

    const speed = cme.speed || 500;
    const travelAu = (speed * ageDays * DAY_SEC) / 149597870.7;
    const dist = Math.min(travelAu * AU_SCALE, AU_SCALE * 1.15);
    const halfAngle = ((cme.halfAngle || 30) * Math.PI) / 180;

    const origin = new THREE.Vector3(0, 0, 0);
    const tip = sunToEarth.clone().multiplyScalar(dist);
    const coneGeo = new THREE.ConeGeometry(
      Math.tan(halfAngle) * dist * 0.35 + 0.08,
      dist,
      16,
      1,
      true,
    );
    const opacity = Math.max(0.2, 0.85 - ageDays * 0.12);
    const mat = new THREE.MeshBasicMaterial({
      color: speed >= 1000 ? 0xff4466 : speed >= 600 ? 0xff8844 : 0xffbb55,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const cone = new THREE.Mesh(coneGeo, mat);
    cone.position.copy(tip.clone().multiplyScalar(0.5));
    cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), sunToEarth);
    cone.userData = cme;
    group.add(cone);

    const lineGeo = new THREE.BufferGeometry().setFromPoints([origin, tip]);
    const line = new THREE.Line(
      lineGeo,
      new THREE.LineBasicMaterial({
        color: 0xffaa66,
        transparent: true,
        opacity: opacity * 0.6,
      }),
    );
    line.userData = cme;
    group.add(line);
  }

  return group;
}