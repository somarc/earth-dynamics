/**
 * Cyclone slice for /api/day/:date — owned by the cyclones layer.
 */
export function contributeCyclonesToDay(db, date, { pastDays = null } = {}) {
  const past = Number.isFinite(pastDays) && pastDays > 0
    ? Math.min(30, Math.floor(pastDays))
    : null;

  const cycloneRows = past
    ? db.prepare(`
        SELECT sid, name, basin, season, start_date AS startDate, end_date AS endDate,
               max_wind_kts AS maxWindKts, max_sshs AS maxSshs, track_json AS trackJson
        FROM cyclone_storms
        WHERE start_date <= date(?) AND end_date >= date(?, ?)
        ORDER BY max_wind_kts DESC
        LIMIT 20
      `).all(date, date, `-${past} days`)
    : db.prepare(`
        SELECT sid, name, basin, season, start_date AS startDate, end_date AS endDate,
               max_wind_kts AS maxWindKts, max_sshs AS maxSshs, track_json AS trackJson
        FROM cyclone_storms
        WHERE start_date <= date(?, '+7 days') AND end_date >= date(?, '-7 days')
        ORDER BY max_wind_kts DESC
        LIMIT 20
      `).all(date, date);

  return cycloneRows.map((row) => {
    const track = JSON.parse(row.trackJson || '[]').filter((p) => p.date <= date);
    return {
      sid: row.sid,
      name: row.name,
      basin: row.basin,
      season: row.season,
      startDate: row.startDate,
      endDate: row.endDate,
      maxWindKts: row.maxWindKts,
      maxSshs: row.maxSshs,
      track,
    };
  }).filter((c) => c.track.length >= 2);
}