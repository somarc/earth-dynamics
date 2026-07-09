import { describe, expect, it } from 'vitest';
import { createViewTransition, updateViewTransition } from '../../src/view-transition.js';

describe('view transition', () => {
  it('creates a geo→helio transition with fixed duration', () => {
    const t = createViewTransition('geocentric', 'heliocentric');
    expect(t.fromView).toBe('geocentric');
    expect(t.toView).toBe('heliocentric');
    expect(t.duration).toBe(420);
    expect(Number.isFinite(t.start)).toBe(true);
  });

  it('eases opacities from out→in over duration', () => {
    const t = { fromView: 'geocentric', toView: 'heliocentric', start: 1000, duration: 400 };
    const mid = updateViewTransition(t, 1200);
    expect(mid.done).toBe(false);
    expect(mid.outgoingOpacity).toBeGreaterThan(0);
    expect(mid.outgoingOpacity).toBeLessThan(1);
    expect(mid.incomingOpacity).toBeCloseTo(1 - mid.outgoingOpacity, 5);

    const end = updateViewTransition(t, 1400);
    expect(end.done).toBe(true);
    expect(end.outgoingOpacity).toBe(0);
    expect(end.incomingOpacity).toBe(1);
  });

  it('clamps past duration to done', () => {
    const t = { fromView: 'a', toView: 'b', start: 0, duration: 100 };
    const over = updateViewTransition(t, 9999);
    expect(over.done).toBe(true);
    expect(over.eased).toBe(1);
  });
});
