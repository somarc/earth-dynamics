import { getDb, logIngest, wasIngested } from '../db.mjs';

const INTERMAGNET_GEOJSON =
  'https://wdcapi.bgs.ac.uk/metadata/epos-geojson/?provider=intermagnet';

function parseInstitutes(value) {
  if (Array.isArray(value)) return value.join('; ');
  if (typeof value === 'string') return value;
  return null;
}

function parseOpened(value) {
  if (!value) return null;
  return String(value).slice(0, 10);
}

export async function ingestGeomag({ force = false } = {}) {
  if (!force && wasIngested('geomag')) {
    const count = getDb().prepare('SELECT COUNT(*) AS c FROM mag_observatories').get().c;
    console.log(`  geomag: skipped (${count} observatories already ingested)`);
    return;
  }

  const res = await fetch(INTERMAGNET_GEOJSON);
  if (!res.ok) throw new Error(`INTERMAGNET metadata ${res.status}`);

  const geojson = await res.json();
  const features = geojson?.features || [];

  const db = getDb();
  db.prepare('DELETE FROM mag_observatories').run();

  const insert = db.prepare(`
    INSERT INTO mag_observatories (
      iaga_code, name, lat, lon, elevation_m, institute, url, opened, closed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const tx = db.transaction((rows) => {
    for (const feature of rows) {
      const props = feature.properties || {};
      const [lon, lat] = feature.geometry?.coordinates || [];
      if (lat == null || lon == null || !props.iaga_code) continue;

      insert.run(
        props.iaga_code,
        props.name || props.iaga_code,
        lat,
        lon,
        props.elevation ?? null,
        parseInstitutes(props.institutes),
        props.url || props.data_availability || null,
        parseOpened(props.opened),
        parseOpened(props.closed),
      );
      count += 1;
    }
  });

  tx(features);
  logIngest('geomag', count, 'INTERMAGNET observatory catalog via BGS WDC EPOS GeoJSON');
  console.log(`  geomag: ${count} INTERMAGNET observatories`);
}