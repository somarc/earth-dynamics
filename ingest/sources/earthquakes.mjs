import { getDb, logIngest } from '../db.mjs';

const MIN_MAG = 5;
const OVERLAP_DAYS = 14;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function parseFeature(f) {
  const [lon, lat, depth] = f.geometry.coordinates;
  return {
    id: f.id,
    time: f.properties.time,
    date: new Date(f.properties.time).toISOString().slice(0, 10),
    mag: f.properties.mag,
    place: f.properties.place,
    lat,
    lon,
    depth,
    url: f.properties.url,
    tsunami: f.properties.tsunami === 1 ? 1 : 0,
  };
}

export async function ingestEarthquakes({ force = false } = {}) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
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
  const startDate = addDays(maxDate, -OVERLAP_DAYS);

  const url = new URL('https://earthquake.usgs.gov/fdsnws/event/1/query');
  url.searchParams.set('format', 'geojson');
  url.searchParams.set('starttime', startDate);
  url.searchParams.set('endtime', today);
  url.searchParams.set('minmagnitude', String(MIN_MAG));
  url.searchParams.set('orderby', 'time-asc');
  url.searchParams.set('limit', '20000');

  console.log(`  earthquakes: incremental ${startDate} → ${today}…`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USGS ${res.status}`);

  const data = await res.json();
  const rows = (data.features || []).map(parseFeature);
  const ins = db.prepare(`
    INSERT OR REPLACE INTO earthquakes VALUES (
      @id, @time, @date, @mag, @place, @lat, @lon, @depth, @url, @tsunami
    )
  `);

  const tx = db.transaction(() => rows.forEach((r) => ins.run(r)));
  tx();

  const total = db.prepare('SELECT COUNT(*) AS c FROM earthquakes').get().c;
  logIngest('earthquakes-incremental', rows.length, `${startDate}–${today}, total ${total}`);
  console.log(`  earthquakes: +${rows.length} rows (${total} total)`);
}