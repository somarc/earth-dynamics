export function evaluateSpaceWeatherChain(frame, { ovationMode = false } = {}) {
  const g = frame?.geomagnetic;
  const events = frame?.spaceWeather || [];

  const cme = events.some((e) => e.eventType === 'CME');
  const gst = events.some((e) => e.eventType === 'GST');
  const flare = events.some(
    (e) => e.eventType === 'FLR' && /^[XM]/i.test(e.magnitude || ''),
  );
  const dstStorm = g?.dstMin != null && g.dstMin <= -50;
  const kpStorm = g?.kpMax != null && g.kpMax >= 5;
  const aurora = ovationMode || (g?.kpMax != null && g.kpMax >= 4);
  const strongWind = g?.swBzNt != null && g.swBzNt < -8;

  const steps = [];
  if (cme) steps.push('cme');
  if (flare) steps.push('flare');
  if (gst || dstStorm || kpStorm) steps.push('storm');
  if (aurora) steps.push('aurora');

  return {
    cme,
    flare,
    gst,
    dstStorm,
    kpStorm,
    aurora,
    strongWind,
    steps,
    active: steps.length >= 2,
  };
}

export function applySpaceWeatherChainHighlight(chain) {
  const panel = document.getElementById('space-weather-panel');
  const kp = document.getElementById('kp-chart');
  const dst = document.getElementById('dst-chart');
  const metrics = document.getElementById('space-weather-metrics');

  panel?.classList.toggle('panel--chain-active', chain.active);
  kp?.classList.toggle('chart--chain-step', chain.kpStorm || chain.aurora);
  dst?.classList.toggle('chart--chain-step', chain.dstStorm || chain.gst);
  metrics?.classList.toggle('chart--chain-step', chain.cme || chain.strongWind);

  if (!panel) return;

  let badge = panel.querySelector('.chain-badge');
  if (!chain.active) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = 'chain-badge';
    panel.querySelector('h2')?.appendChild(badge);
  }

  const labels = [];
  if (chain.cme) labels.push('CME');
  if (chain.gst || chain.dstStorm) labels.push('Dst');
  if (chain.kpStorm) labels.push('Kp');
  if (chain.aurora) labels.push('Aurora');
  badge.textContent = `linked · ${labels.join(' → ')}`;
}