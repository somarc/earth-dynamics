import { getDb, logIngest } from '../db.mjs';
import {
  EARTHQUAKE_MIN_MAG,
  earthquakeIncrementalWindow,
  parseUsgsGeoJson,
} from '../lib/parse-earthquakes.mjs';

export async function ingestEarthquakes({ force = false } = {}) {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM earthquakes').get().c;

  if (force) {
    console.log('  earthquakes: skipped on --force (use npm run fetch-data + ingest --only=json for full reload)');
    return;
  }

  if (!count) {
    console.log('  earthquakes: no rows yet — run npm run ingest -- --only=json first');
    return;
  }

  const { maxDate } = db.prepare('SELECT MAX(date) AS maxDate FROM earthquakes').get();
  const { startDate, endDate, today, minMagnitude } = earthquakeIncrementalWindow(maxDate);

  const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', startDate);
  url.searchParams.set('endtime', endDate);
  url.searchParams.set('minmagnitude', String(minMagnitude ?? EARTHQUAKE_MIN_MAG));
  url.searchParams.set('orderby', 'time-asc');
  url.searchParams.set('limit', '20000');

  console.log(`  earthquakes: incremental ${startDate} → ${today} (through end of day)…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS ${res.status}`);

  const data = await res.json();
  const rows = parseUsgsGeoJson(data);
  const ins = db.prepare(`
    INSERT OR REPLACE INTO earthquakes VALUES (
      @id, @time, @date, @mag, @place, @lat, @lon, @depth, @url, @tsunami
    )
  `);

  const tx = db.transaction(() => rows.forEach((r) => ins.run(r)));
  tx();

  const total = db.prepare('SELECT COUNT(*) AS c FROM earthquakes').get().c;
  logIngest('earthquakes-incremental', rows.length, `${startDate}–${endDate}, total ${total}`);
  console.log(`  earthquakes: +${rows.length} rows (${total} total)`);
}