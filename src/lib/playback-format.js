/**
 * Pure playback / opacity label formatters — no DOM.
 */

export function formatEarthOpacityLabel(opacity) {
  const pct = Math.round(opacity * 100);
  if (pct >= 98) return 'Solid';
  if (pct <= 70) return `Depth ${pct}%`;
  return `Readable ${pct}%`;
}

/** Human rate label for simulated day length at current speed. */
export function formatPlaybackRate(dayLengthMs, speed) {
  const ms = dayLengthMs / speed;
  if (ms >= 86_400_000) {
    const days = ms / 86_400_000;
    return days >= 10 ? `${Math.round(days)}d/sim day` : `${days.toFixed(1)}d/sim day`;
  }
  if (ms >= 3_600_000) {
    const hours = ms / 3_600_000;
    return hours >= 10 ? `${Math.round(hours)}h/sim day` : `${hours.toFixed(1)}h/sim day`;
  }
  if (ms >= 60_000) {
    const minutes = ms / 60_000;
    return minutes >= 10 ? `${Math.round(minutes)}m/sim day` : `${minutes.toFixed(1)}m/sim day`;
  }
  if (ms >= 1000) return `${Math.round(ms / 1000)}s/sim day`;
  return `${Math.round(ms)}ms/sim day`;
}

export function clampEarthOpacity(opacity) {
  return Math.max(0.65, Math.min(1, opacity));
}
