/**
 * Pure USGS FDSN GeoJSON → row mappers for earthquake ingest.
 */

export const EARTHQUAKE_MIN_MAG = 5;
export const EARTHQUAKE_OVERLAP_DAYS = 14;

export function addDaysUtc(dateStr, days) {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Map one USGS FDSN GeoJSON feature to an earthquakes table row.
 * @param {object} f — GeoJSON Feature
 */
export function parseUsgsFeature(f) {
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

/**
 * Incremental query window: overlap before maxDate through end of today (exclusive end = tomorrow).
 */
export function earthquakeIncrementalWindow(maxDate, today = new Date().toISOString().slice(0, 10)) {
  return {
    startDate: addDaysUtc(maxDate, -EARTHQUAKE_OVERLAP_DAYS),
    endDate: addDaysUtc(today, 1),
    today,
    minMagnitude: EARTHQUAKE_MIN_MAG,
  };
}

export function parseUsgsGeoJson(data) {
  return (data?.features || []).map(parseUsgsFeature);
}
