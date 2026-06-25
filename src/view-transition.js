const TRANSITION_MS = 420;

export function createViewTransition(fromView, toView) {
  return {
    fromView,
    toView,
    start: performance.now(),
    duration: TRANSITION_MS,
  };
}

export function updateViewTransition(transition, now) {
  const raw = Math.min(1, (now - transition.start) / transition.duration);
  const eased = raw * raw * (3 - 2 * raw);
  return {
    eased,
    done: raw >= 1,
    outgoingOpacity: 1 - eased,
    incomingOpacity: eased,
  };
}

export function easeCameraToDefault(camera, controls, targetPosition, targetLookAt, alpha) {
  if (!camera || alpha <= 0) return;
  const startPos = camera.position.clone();
  const endPos = targetPosition.clone();
  camera.position.lerpVectors(startPos, endPos, alpha);

  if (controls?.target) {
    controls.target.lerp(targetLookAt, alpha);
    controls.update();
  } else {
    camera.lookAt(targetLookAt);
  }
}