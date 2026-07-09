import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { frameHelioSunEarth } from '../../src/heliocentric.js';

describe('frameHelioSunEarth', () => {
  // True-scale 1 AU is huge; framing must stay Earth-local, not a fraction of AU.
  const earthPos = new THREE.Vector3(6575, 0, 0);

  it('places camera outside Earth looking roughly sunward', () => {
    const { position, target } = frameHelioSunEarth(earthPos);

    // Camera further from origin than Earth
    expect(position.length()).toBeGreaterThan(earthPos.length());
    // Target near sun (origin bias) — Sun is compositional focus
    expect(target.length()).toBeLessThan(earthPos.length() * 0.05);
    // Earth sits between camera radial projection and sun (camera beyond Earth)
    const radial = earthPos.clone().normalize();
    const camRadial = position.dot(radial);
    expect(camRadial).toBeGreaterThan(earthPos.length());
  });

  it('keeps camera close enough that Earth is large in the foreground', () => {
    const earthR = 0.28;
    const { position } = frameHelioSunEarth(earthPos, { earthRadius: earthR });
    const camToEarth = position.distanceTo(earthPos);
    // ~4–6 Earth radii — globe should dominate the near field even at true 1 AU
    expect(camToEarth).toBeLessThan(earthR * 8);
    expect(camToEarth).toBeGreaterThan(earthR * 2.5);
  });

  it('offsets camera off the Sun–Earth line so the planet does not occult the star', () => {
    const { position, target } = frameHelioSunEarth(earthPos);
    const los = target.clone().sub(position).normalize();
    const toEarth = earthPos.clone().sub(position).normalize();
    // Line of sight should not be perfectly aligned with Earth center
    const align = Math.abs(los.dot(toEarth));
    expect(align).toBeLessThan(0.995);
  });

  it('handles near-polar ecliptic positions', () => {
    const polar = new THREE.Vector3(0.01, 6575, 0);
    const { position, target } = frameHelioSunEarth(polar);
    expect(Number.isFinite(position.x + position.y + position.z)).toBe(true);
    expect(Number.isFinite(target.x + target.y + target.z)).toBe(true);
  });
});
