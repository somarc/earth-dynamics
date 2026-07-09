import {
  EARTH_RADIUS,
  sunOrbitRadiusScene,
  SUN_MEAN_DIST_KM,
} from './utils.js';

/** ~8 km above surface at EARTH_RADIUS = 1 (6371 km scale). */
export const GLOBE_MIN_DISTANCE = EARTH_RADIUS * 1.0012;

/**
 * Pull back far enough to frame the true-scale Sun (~1 AU ≈ 23k Earth radii).
 * Default entry camera stays close on Earth; this only raises the zoom-out ceiling.
 */
export const GLOBE_MAX_DISTANCE = sunOrbitRadiusScene(SUN_MEAN_DIST_KM) * 1.12;

/**
 * Orbit setup for close regional inspection (radar rings, events, coastlines).
 * zoomToCursor keeps scroll zoom anchored under the pointer instead of the globe center.
 */
export function configureGlobeControls(controls, { earthRadius = EARTH_RADIUS } = {}) {
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = earthRadius * 1.0012;
  controls.maxDistance = GLOBE_MAX_DISTANCE;
  // Slightly snappier so the long haul out to 1 AU is still usable.
  controls.zoomSpeed = 1.15;
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
  const sunFar = sunOrbitRadiusScene(SUN_MEAN_DIST_KM, earthRadius) * 1.25;
  camera.near = Math.max(0.00008, altitude * 0.04);
  // Always keep the true-scale Sun inside the far plane from Earth orbit.
  camera.far = Math.max(sunFar, dist * 80, 120);
  camera.updateProjectionMatrix();
}