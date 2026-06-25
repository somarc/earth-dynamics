-- Wobblescope local store (SQLite / Cloudflare D1 compatible)

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS ingest_log (
  source TEXT NOT NULL,
  completed_at TEXT NOT NULL,
  row_count INTEGER,
  notes TEXT,
  PRIMARY KEY (source)
);

CREATE TABLE IF NOT EXISTS eop_daily (
  date TEXT PRIMARY KEY,
  mjd REAL NOT NULL,
  x_arcsec REAL NOT NULL,
  y_arcsec REAL NOT NULL,
  lod_sec REAL NOT NULL,
  x_mas REAL NOT NULL,
  y_mas REAL NOT NULL,
  lod_ms REAL NOT NULL,
  omega_picorad_s REAL NOT NULL,
  delta_omega_picorad_s REAL NOT NULL,
  x_rad REAL NOT NULL,
  y_rad REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS earthquakes (
  id TEXT PRIMARY KEY,
  time INTEGER NOT NULL,
  date TEXT NOT NULL,
  mag REAL,
  place TEXT,
  lat REAL NOT NULL,
  lon REAL NOT NULL,
  depth REAL,
  url TEXT,
  tsunami INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_earthquakes_date ON earthquakes(date);
CREATE INDEX IF NOT EXISTS idx_earthquakes_time ON earthquakes(time);

CREATE TABLE IF NOT EXISTS eruptions (
  id INTEGER PRIMARY KEY,
  volcano_number INTEGER,
  name TEXT,
  vei INTEGER,
  start_date TEXT NOT NULL,
  end_date TEXT,
  continuing INTEGER DEFAULT 0,
  lat REAL,
  lon REAL
);
CREATE INDEX IF NOT EXISTS idx_eruptions_start ON eruptions(start_date);

CREATE TABLE IF NOT EXISTS volcanoes (
  volcano_number INTEGER PRIMARY KEY,
  name TEXT,
  country TEXT,
  region TEXT,
  last_eruption_year INTEGER,
  lat REAL,
  lon REAL,
  elevation REAL,
  volcano_type TEXT
);

CREATE TABLE IF NOT EXISTS ephemeris_daily (
  date TEXT PRIMARY KEY,
  moon_x REAL, moon_y REAL, moon_z REAL, moon_dist_km REAL,
  sun_x REAL, sun_y REAL, sun_z REAL, sun_dist_km REAL,
  mercury_x REAL, mercury_y REAL, mercury_z REAL,
  venus_x REAL, venus_y REAL, venus_z REAL,
  mars_x REAL, mars_y REAL, mars_z REAL,
  jupiter_x REAL, jupiter_y REAL, jupiter_z REAL,
  saturn_x REAL, saturn_y REAL, saturn_z REAL,
  earth_helio_x REAL, earth_helio_y REAL, earth_helio_z REAL,
  earth_helio_dist_au REAL, earth_helio_dist_km REAL,
  phase_angle REAL,
  phase_name TEXT,
  illumination REAL,
  moon_distance_km INTEGER,
  tidal_index REAL,
  syzygy TEXT,
  is_perigee INTEGER DEFAULT 0,
  is_apogee INTEGER DEFAULT 0,
  alignments_json TEXT
);

CREATE TABLE IF NOT EXISTS weather_grid (
  grid_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  lat REAL NOT NULL,
  lon REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_daily (
  date TEXT NOT NULL,
  grid_id TEXT NOT NULL,
  temp_max_c REAL,
  temp_min_c REAL,
  precip_mm REAL,
  wind_max_kmh REAL,
  PRIMARY KEY (date, grid_id),
  FOREIGN KEY (grid_id) REFERENCES weather_grid(grid_id)
);
CREATE INDEX IF NOT EXISTS idx_weather_date ON weather_daily(date);

CREATE TABLE IF NOT EXISTS storm_events (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  event_type TEXT NOT NULL,
  state TEXT,
  country TEXT,
  lat REAL,
  lon REAL,
  magnitude TEXT,
  deaths INTEGER DEFAULT 0,
  injuries INTEGER DEFAULT 0,
  damage_property TEXT,
  narrative TEXT
);
CREATE INDEX IF NOT EXISTS idx_storm_date ON storm_events(date);
CREATE INDEX IF NOT EXISTS idx_storm_type ON storm_events(event_type);

CREATE TABLE IF NOT EXISTS solar_daily (
  date TEXT PRIMARY KEY,
  sunspot_number REAL,
  kp_max REAL,
  kp_avg REAL
);

CREATE TABLE IF NOT EXISTS geomagnetic_daily (
  date TEXT PRIMARY KEY,
  kp_max REAL,
  kp_avg REAL,
  dst_min REAL,
  g_scale INTEGER,
  aurora_level INTEGER
);
CREATE INDEX IF NOT EXISTS idx_geomagnetic_kp ON geomagnetic_daily(kp_max);

CREATE TABLE IF NOT EXISTS space_weather_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  start_time TEXT NOT NULL,
  date TEXT NOT NULL,
  end_time TEXT,
  speed REAL,
  magnitude TEXT,
  kp_peak REAL,
  half_angle REAL,
  source_location TEXT,
  description TEXT,
  source_url TEXT,
  linked_events TEXT
);
CREATE INDEX IF NOT EXISTS idx_swe_date ON space_weather_events(date);
CREATE INDEX IF NOT EXISTS idx_swe_type ON space_weather_events(event_type);