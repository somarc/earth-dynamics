import { describe, expect, it } from 'vitest';
import {
  EARTHQUAKE_MIN_MAG,
  EARTHQUAKE_OVERLAP_DAYS,
  addDaysUtc,
  earthquakeIncrementalWindow,
  parseUsgsFeature,
  parseUsgsGeoJson,
} from '../../ingest/lib/parse-earthquakes.mjs';

describe('parseUsgsFeature', () => {
  it('maps FDSN GeoJSON feature to table row', () => {
    const t = Date.parse('2024-05-11T15:30:00Z');
    const row = parseUsgsFeature({
      id: 'us6000t8ec',
      geometry: { coordinates: [125.1, 5.9, 40.2] },
      properties: {
        time: t,
        mag: 6.5,
        place: 'Sarangani, Philippines',
        url: 'https://example.test/q',
        tsunami: 1,
      },
    });
    expect(row).toEqual({
      id: 'us6000t8ec',
      time: t,
      date: '2024-05-11',
      mag: 6.5,
      place: 'Sarangani, Philippines',
      lat: 5.9,
      lon: 125.1,
      depth: 40.2,
      url: 'https://example.test/q',
      tsunami: 1,
    });
  });

  it('coerces tsunami flag to 0/1', () => {
    const base = {
      id: 'x',
      geometry: { coordinates: [0, 0, 0] },
      properties: { time: Date.parse('2024-01-01T00:00:00Z'), mag: 5, place: 'p', url: '' },
    };
    expect(parseUsgsFeature({ ...base, properties: { ...base.properties, tsunami: 0 } }).tsunami).toBe(0);
    expect(parseUsgsFeature({ ...base, properties: { ...base.properties, tsunami: 2 } }).tsunami).toBe(0);
  });
});

describe('parseUsgsGeoJson', () => {
  it('maps features array', () => {
    const rows = parseUsgsGeoJson({
      features: [
        {
          id: 'a',
          geometry: { coordinates: [1, 2, 3] },
          properties: {
            time: Date.parse('2024-05-11T00:00:00Z'),
            mag: 5.1,
            place: 'A',
            url: '',
            tsunami: 0,
          },
        },
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('a');
  });

  it('handles missing features', () => {
    expect(parseUsgsGeoJson(null)).toEqual([]);
    expect(parseUsgsGeoJson({})).toEqual([]);
  });
});

describe('earthquakeIncrementalWindow', () => {
  it('overlaps 14 days and ends exclusive tomorrow', () => {
    const w = earthquakeIncrementalWindow('2024-05-11', '2024-05-20');
    expect(EARTHQUAKE_OVERLAP_DAYS).toBe(14);
    expect(EARTHQUAKE_MIN_MAG).toBe(5);
    expect(w.startDate).toBe(addDaysUtc('2024-05-11', -14));
    expect(w.endDate).toBe('2024-05-21');
    expect(w.today).toBe('2024-05-20');
    expect(w.minMagnitude).toBe(5);
  });
});
