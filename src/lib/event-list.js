/**
 * Pure event-list builders for the events panel — no DOM.
 */

import { filterQuakesByMinMag } from '../utils.js';

export function pluralCount(n, singular, pluralForm = `${singular}s`) {
  return `${n} ${n === 1 ? singular : pluralForm}`;
}

export function formatGlobeTally(counts) {
  if (!counts) return null;
  const parts = [];
  if (counts.quakes != null) parts.push(pluralCount(counts.quakes, 'quake'));
  if (counts.eruptions != null) {
    parts.push(pluralCount(counts.eruptions, 'active GVP eruption', 'active GVP eruptions'));
  }
  if (counts.cyclones != null) parts.push(pluralCount(counts.cyclones, 'cyclone'));
  if (counts.weather != null) {
    parts.push(pluralCount(counts.weather, 'weather grid point', 'weather grid points'));
  }
  if (counts.storms) parts.push(pluralCount(counts.storms, 'storm'));
  return parts.join(', ');
}

/**
 * Empty-state message when the events list has no items.
 * @param {{ recentOnly?: boolean, quakeMinMag?: number }} opts
 * @returns {string} single <li class="empty">…</li> HTML fragment
 */
export function emptyEventListMessage({ recentOnly = true, quakeMinMag = 5 } = {}) {
  const magNote = quakeMinMag > 5 ? ` at M≥${quakeMinMag}` : '';
  return `<li class="empty">No events in ${recentOnly ? 'past 7 days' : 'window'}${magNote}</li>`;
}

/**
 * Build HTML list-item fragments for the events panel from a day frame.
 * @param {object} frame — loadFrame result (geomagnetic, spaceWeather, storms, …)
 * @param {{ recentOnly?: boolean, quakeMinMag?: number, date?: string }} [opts]
 *   `recentOnly` / `date` accepted for call-site parity; filtering uses frame + quakeMinMag.
 * @returns {string[]} array of <li>…</li> HTML strings
 */
export function buildEventListItems(frame, { recentOnly: _recentOnly, quakeMinMag = 5, date: _date } = {}) {
  if (!frame) return [];

  const items = [];
  const ephemerisDay = frame.ephemerisDay;

  if (frame.geomagnetic?.kpMax != null) {
    const g = frame.geomagnetic.gScale ? ` G${frame.geomagnetic.gScale}` : '';
    items.push(
      `<li><span class="geomag">Kp</span> ${frame.geomagnetic.kpMax.toFixed(1)}${g}${frame.geomagnetic.kpMax >= 5 ? ' — auroral activity' : ''}</li>`,
    );
  }
  if (frame.geomagnetic?.dstMin != null && frame.geomagnetic.dstMin <= -30) {
    items.push(`<li><span class="dst">Dst</span> ${frame.geomagnetic.dstMin} nT</li>`);
  }
  if (frame.geomagnetic?.swSpeedKms != null) {
    const bz =
      frame.geomagnetic.swBzNt != null
        ? `, Bz ${frame.geomagnetic.swBzNt.toFixed(1)} nT`
        : '';
    items.push(
      `<li><span class="wind">Wind</span> ${frame.geomagnetic.swSpeedKms.toFixed(0)} km/s${bz}</li>`,
    );
  }
  if (!frame.geomagnetic?.kpMax && frame.solar?.sunspot_number != null) {
    items.push(
      `<li><span class="solar">☀</span> Sunspot ${frame.solar.sunspot_number.toFixed(1)}${frame.solar.kp_max ? `, Kp ${frame.solar.kp_max.toFixed(0)}` : ''}</li>`,
    );
  }

  for (const ev of (frame.spaceWeather || []).slice(0, 4)) {
    if (ev.eventType === 'CME' && ev.speed) {
      items.push(`<li><span class="cme">CME</span> ${Math.round(ev.speed)} km/s</li>`);
    } else if (ev.eventType === 'GST') {
      items.push(
        `<li><span class="gst">Storm</span> ${ev.magnitude || `Kp ${ev.kpPeak?.toFixed(1) ?? '—'}`}</li>`,
      );
    } else if (ev.eventType === 'FLR' && /^[XM]/i.test(ev.magnitude || '')) {
      items.push(
        `<li><span class="flare">${ev.magnitude}</span> flare ${ev.sourceLocation || ''}</li>`,
      );
    }
  }

  if (ephemerisDay?.lunar) {
    const l = ephemerisDay.lunar;
    const tags = [];
    if (l.syzygy) tags.push(l.syzygy === 'new' ? 'New Moon' : 'Full Moon');
    if (l.isPerigee) tags.push('Perigee');
    if (ephemerisDay.alignments?.length) {
      tags.push(
        `${ephemerisDay.alignments[0].planets.join('/')} ${ephemerisDay.alignments[0].separationDeg.toFixed(0)}°`,
      );
    }
    items.push(
      `<li><span class="orbital">☽</span> ${l.phaseName}, ${l.moonDistanceKm?.toLocaleString()} km${tags.length ? ` — ${tags.join(', ')}` : ''}</li>`,
    );
  }

  for (const s of (frame.storms || []).slice(0, 4)) {
    items.push(
      `<li><span class="storm">${s.eventType}</span> ${s.state || ''} ${s.magnitude ? `(${s.magnitude})` : ''}</li>`,
    );
  }

  for (const c of (frame.cyclones || []).slice(0, 4)) {
    const wind = c.maxWindKts != null ? `${Math.round(c.maxWindKts)} kt` : '—';
    items.push(
      `<li><span class="cyclone">${c.name || 'Cyclone'}</span> ${c.basin || ''} ${c.season || ''} · ${wind}</li>`,
    );
  }

  for (const w of (frame.weather || []).slice(0, 3)) {
    items.push(
      `<li><span class="weather">${w.label}</span> ${w.tempMaxC?.toFixed(0)}°C, wind ${w.windMaxKmh?.toFixed(0)} km/h</li>`,
    );
  }

  const quakes = filterQuakesByMinMag(frame.earthquakes, quakeMinMag);
  for (const q of quakes.slice(0, 6)) {
    items.push(
      `<li><span class="mag">M${q.mag?.toFixed(1)}</span> ${q.place} — <a href="${q.url}" target="_blank" rel="noopener">USGS</a></li>`,
    );
  }

  for (const v of (frame.eruptions || []).slice(0, 4)) {
    const status = v.continuing
      ? `ongoing since ${v.startDate || '—'}`
      : `${v.startDate || '—'} → ${v.endDate || '—'}`;
    items.push(
      `<li><span class="vei">GVP VEI ${v.vei ?? '—'}</span> ${v.name} <span class="event-range">(${status})</span></li>`,
    );
  }

  return items;
}
