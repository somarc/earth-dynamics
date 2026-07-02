import { EARTH_RADIUS } from './utils.js';

/** ~8 km above surface at EARTH_RADIUS = 1 (6371 km scale). */
export const GLOBE_MIN_DISTANCE = EARTH_RADIUS * 1.0012;

/** Continental / full-disk retreat. */
export const GLOBE_MAX_DISTANCE = 8;

/**
 * Orbit setup for close regional inspection (radar rings, events, coastlines).
 * zoomToCursor keeps scroll zoom anchored under the pointer instead of the globe center.
 */
export function configureGlobeControls(controls, { earthRadius = EARTH_RADIUS } = {}) {
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = earthRadius * 1.0012;
  controls.maxDistance = GLOBE_MAX_DISTANCE;
  controls.zoomSpeed = 0.85;
  controls.zoomToCursor = true;
  // Pan + zoomToCursor drifts the orbit target off the globe center on scroll/click.
  controls.enablePan = false;
  controls.screenSpacePanning = false;
  controls.rotateSpeed = 0.55;
  controls.maxPolarAngle = Math.PI;
}

/** Tighten clip planes when the camera hugs the surface so layers do not z-fight. */
export function updateGlobeCameraClip(camera, target, { earthRadius = EARTH_RADIUS } = {}) {
  const dist = Math.max(camera.position.distanceTo(target), earthRadius * 1.0005);
  const altitude = Math.max(dist - earthRadius, 0.0001);
  camera.near = Math.max(0.00008, altitude * 0.04);
  camera.far = Math.max(120, dist * 80);
  camera.updateProjectionMatrix();
}