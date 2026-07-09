import { describe, expect, it } from 'vitest';
import {
  buildEventListItems,
  emptyEventListMessage,
  formatGlobeTally,
  pluralCount,
} from '../../src/lib/event-list.js';

const fixtureFrame = {
  geomagnetic: {
    kpMax: 6.3,
    gScale: 2,
    dstMin: -85,
    swSpeedKms: 520.4,
    swBzNt: -8.2,
  },
  spaceWeather: [
    { eventType: 'CME', speed: 812.6 },
    { eventType: 'GST', magnitude: 'G2' },
    { eventType: 'FLR', magnitude: 'X1.2', sourceLocation: 'N15E45' },
  ],
  storms: [{ eventType: 'Tornado', state: 'OK', magnitude: 'EF2' }],
  cyclones: [
    { name: 'Hurricane Milton', basin: 'AL', season: 2024, maxWindKts: 155.4 },
  ],
  weather: [{ label: 'NYC', tempMaxC: 28.4, windMaxKmh: 42.1 }],
  earthquakes: [
    { mag: 6.2, place: '15 km NE of Foo', url: 'https://earthquake.usgs.gov/1' },
    { mag: 4.9, place: 'below floor', url: 'https://earthquake.usgs.gov/2' },
    { mag: 5.5, place: 'Bar', url: 'https://earthquake.usgs.gov/3' },
  ],
  eruptions: [
    {
      name: 'Kilauea',
      vei: 0,
      continuing: true,
      startDate: '2024-01-01',
    },
  ],
  ephemerisDay: {
    lunar: {
      phaseName: 'Full Moon',
      moonDistanceKm: 365000,
      syzygy: 'full',
      isPerigee: true,
    },
    alignments: [{ planets: ['Venus', 'Jupiter'], separationDeg: 3.4 }],
  },
};

describe('buildEventListItems', () => {
  it('renders Kp, Dst, wind, space weather, cyclone, quake, and more', () => {
    const items = buildEventListItems(fixtureFrame, { quakeMinMag: 5 });
    const html = items.join('\n');

    expect(html).toContain('class="geomag">Kp</span> 6.3 G2 — auroral activity');
    expect(html).toContain('class="dst">Dst</span> -85 nT');
    expect(html).toContain('class="wind">Wind</span> 520 km/s, Bz -8.2 nT');
    expect(html).toContain('class="cme">CME</span> 813 km/s');
    expect(html).toContain('class="gst">Storm</span> G2');
    expect(html).toContain('class="flare">X1.2</span> flare N15E45');
    expect(html).toContain('class="orbital">☽</span>');
    expect(html).toContain('Full Moon');
    expect(html).toContain('Perigee');
    expect(html).toContain('class="storm">Tornado</span> OK (EF2)');
    expect(html).toContain('class="cyclone">Hurricane Milton</span> AL 2024 · 155 kt');
    expect(html).toContain('class="weather">NYC</span> 28°C, wind 42 km/h');
    expect(html).toContain('class="mag">M6.2</span> 15 km NE of Foo');
    expect(html).toContain('class="mag">M5.5</span> Bar');
    expect(html).not.toContain('below floor');
    expect(html).toContain('class="vei">GVP VEI 0</span> Kilauea');
    expect(html).toContain('ongoing since 2024-01-01');
  });

  it('filters quakes by quakeMinMag', () => {
    const items = buildEventListItems(fixtureFrame, { quakeMinMag: 6 });
    const html = items.join('\n');
    expect(html).toContain('M6.2');
    expect(html).not.toContain('M5.5');
  });

  it('falls back to solar when no kpMax', () => {
    const items = buildEventListItems({
      solar: { sunspot_number: 42.5, kp_max: 3 },
    });
    expect(items.join('')).toContain('Sunspot 42.5, Kp 3');
  });

  it('returns empty array for null/empty frame', () => {
    expect(buildEventListItems(null)).toEqual([]);
    expect(buildEventListItems({})).toEqual([]);
  });
});

describe('emptyEventListMessage', () => {
  it('describes past 7 days vs window and mag floor', () => {
    expect(emptyEventListMessage({ recentOnly: true, quakeMinMag: 5 })).toBe(
      '<li class="empty">No events in past 7 days</li>',
    );
    expect(emptyEventListMessage({ recentOnly: false, quakeMinMag: 5 })).toBe(
      '<li class="empty">No events in window</li>',
    );
    expect(emptyEventListMessage({ recentOnly: true, quakeMinMag: 6 })).toBe(
      '<li class="empty">No events in past 7 days at M≥6</li>',
    );
  });
});

describe('formatGlobeTally / pluralCount', () => {
  it('pluralizes counts', () => {
    expect(pluralCount(1, 'quake')).toBe('1 quake');
    expect(pluralCount(2, 'quake')).toBe('2 quakes');
    expect(pluralCount(1, 'active GVP eruption', 'active GVP eruptions')).toBe(
      '1 active GVP eruption',
    );
  });

  it('joins globe tallies', () => {
    expect(
      formatGlobeTally({
        quakes: 2,
        eruptions: 1,
        cyclones: 0,
        weather: 3,
        storms: 1,
      }),
    ).toBe(
      '2 quakes, 1 active GVP eruption, 0 cyclones, 3 weather grid points, 1 storm',
    );
    expect(formatGlobeTally(null)).toBe(null);
  });
});
