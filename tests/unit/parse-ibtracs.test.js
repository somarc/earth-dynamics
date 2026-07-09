import { describe, expect, it } from 'vitest';
import {
  finalizeStorm,
  parseHeaderCols,
  parseNum,
  parseRow,
} from '../../ingest/lib/parse-ibtracs.mjs';

/** Minimal IBTrACS-style header covering columns the parser reads. */
const HEADER =
  'SID,SEASON,NUMBER,BASIN,SUBBASIN,NAME,ISO_TIME,NATURE,LAT,LON,WMO_WIND,WMO_PRES,WMO_AGENCY,TRACK_TYPE,DIST2LAND,USA_WIND,USA_PRES,USA_SSHS,TOKYO_WIND';

const COLS = parseHeaderCols(HEADER);

/** Build a CSV data line for the minimal header. */
function line(fields) {
  const parts = new Array(19).fill('');
  for (const [key, val] of Object.entries(fields)) {
    parts[COLS[key]] = val;
  }
  return parts.join(',');
}

describe('parseNum', () => {
  it('parses finite numbers and treats blanks as null', () => {
    expect(parseNum('25.5')).toBe(25.5);
    expect(parseNum('')).toBeNull();
    expect(parseNum(' ')).toBeNull();
    expect(parseNum(null)).toBeNull();
    expect(parseNum('x')).toBeNull();
  });
});

describe('parseHeaderCols', () => {
  it('maps header names to indices for SID, lines', () => {
    expect(COLS.SID).toBe(0);
    expect(COLS.TRACK_TYPE).toBe(13);
    expect(COLS.USA_WIND).toBe(15);
    expect(COLS.TOKYO_WIND).toBe(18);
  });

  it('returns null for non-header lines', () => {
    expect(parseHeaderCols('not,a,header')).toBeNull();
    expect(parseHeaderCols('')).toBeNull();
  });
});

describe('parseRow', () => {
  it('parses a main-track point with USA wind and SSHS', () => {
    const row = parseRow(
      line({
        SID: '1980001S13173',
        SEASON: '1980',
        BASIN: 'SP',
        NAME: 'PENI',
        ISO_TIME: '1980-01-01 00:00:00',
        LAT: '-12.5',
        LON: '172.5',
        TRACK_TYPE: 'main',
        USA_WIND: '25',
        USA_SSHS: '-1',
      }),
      COLS,
    );
    expect(row).toEqual({
      sid: '1980001S13173',
      season: 1980,
      name: 'PENI',
      basin: 'SP',
      isoTime: '1980-01-01 00:00:00',
      date: '1980-01-01',
      lat: -12.5,
      lon: 172.5,
      windKts: 25,
      sshs: -1,
    });
  });

  it('falls back WMO then TOKYO wind when USA is blank', () => {
    const wmo = parseRow(
      line({
        SID: 'S1',
        SEASON: '2000',
        BASIN: 'WP',
        NAME: 'TEST',
        ISO_TIME: '2000-08-01 12:00:00',
        LAT: '10',
        LON: '130',
        TRACK_TYPE: 'main',
        WMO_WIND: '40',
      }),
      COLS,
    );
    expect(wmo.windKts).toBe(40);

    const tokyo = parseRow(
      line({
        SID: 'S1',
        SEASON: '2000',
        BASIN: 'WP',
        NAME: 'TEST',
        ISO_TIME: '2000-08-01 12:00:00',
        LAT: '10',
        LON: '130',
        TRACK_TYPE: 'main',
        TOKYO_WIND: '55',
      }),
      COLS,
    );
    expect(tokyo.windKts).toBe(55);
  });

  it('normalizes UNNAMED and skips non-main / incomplete rows', () => {
    const unnamed = parseRow(
      line({
        SID: 'S2',
        SEASON: '1999',
        BASIN: 'NA',
        NAME: 'UNNAMED',
        ISO_TIME: '1999-09-01 00:00:00',
        LAT: '20',
        LON: '-60',
        TRACK_TYPE: 'main',
        USA_WIND: '30',
      }),
      COLS,
    );
    expect(unnamed.name).toBe('Unnamed');

    expect(
      parseRow(
        line({
          SID: 'S2',
          SEASON: '1999',
          BASIN: 'NA',
          NAME: 'X',
          ISO_TIME: '1999-09-01 00:00:00',
          LAT: '20',
          LON: '-60',
          TRACK_TYPE: 'spur',
        }),
        COLS,
      ),
    ).toBeNull();

    expect(
      parseRow(
        line({
          SID: 'S2',
          SEASON: '1999',
          BASIN: 'NA',
          NAME: 'X',
          ISO_TIME: '1999-09-01 00:00:00',
          TRACK_TYPE: 'main',
        }),
        COLS,
      ),
    ).toBeNull();

    expect(parseRow('too,few,fields', COLS)).toBeNull();
  });
});

describe('finalizeStorm', () => {
  it('sorts points, tracks date range, and max wind/sshs', () => {
    const storm = finalizeStorm('S1', [
      {
        date: '2000-08-02',
        isoTime: '2000-08-02 00:00:00',
        name: 'TEST',
        basin: 'WP',
        season: 2000,
        lat: 12,
        lon: 131,
        windKts: 80,
        sshs: 2,
      },
      {
        date: '2000-08-01',
        isoTime: '2000-08-01 12:00:00',
        name: 'TEST',
        basin: 'WP',
        season: 2000,
        lat: 10,
        lon: 130,
        windKts: 40,
        sshs: 0,
      },
      {
        date: '2000-08-01',
        isoTime: '2000-08-01 18:00:00',
        name: 'TEST',
        basin: 'WP',
        season: 2000,
        lat: 11,
        lon: 130.5,
        windKts: null,
        sshs: 1,
      },
    ]);

    expect(storm.sid).toBe('S1');
    expect(storm.name).toBe('TEST');
    expect(storm.basin).toBe('WP');
    expect(storm.season).toBe(2000);
    expect(storm.start_date).toBe('2000-08-01');
    expect(storm.end_date).toBe('2000-08-02');
    expect(storm.max_wind_kts).toBe(80);
    expect(storm.max_sshs).toBe(2);

    const track = JSON.parse(storm.track_json);
    expect(track).toHaveLength(3);
    expect(track[0]).toEqual({
      date: '2000-08-01',
      lat: 10,
      lon: 130,
      windKts: 40,
      sshs: 0,
    });
    expect(track[2].date).toBe('2000-08-02');
  });

  it('returns null for empty points', () => {
    expect(finalizeStorm('S1', [])).toBeNull();
  });
});
