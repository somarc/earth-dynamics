export const DB_PATH = new URL('../data/ecdo.db', import.meta.url).pathname;

export const NOMINAL_OMEGA_PICORAD_S = 72921151.467064;
export const ARCSEC_TO_RAD = Math.PI / (180 * 3600);
export const AU_KM = 149597870.7;

export const WEATHER_GRID = [
  { id: 'nyc', label: 'New York', lat: 40.7, lon: -74.0 },
  { id: 'miami', label: 'Miami', lat: 25.8, lon: -80.2 },
  { id: 'la', label: 'Los Angeles', lat: 34.1, lon: -118.2 },
  { id: 'anchorage', label: 'Anchorage', lat: 61.2, lon: -149.9 },
  { id: 'london', label: 'London', lat: 51.5, lon: -0.1 },
  { id: 'paris', label: 'Paris', lat: 48.9, lon: 2.3 },
  { id: 'moscow', label: 'Moscow', lat: 55.8, lon: 37.6 },
  { id: 'cairo', label: 'Cairo', lat: 30.0, lon: 31.2 },
  { id: 'nairobi', label: 'Nairobi', lat: -1.3, lon: 36.8 },
  { id: 'mumbai', label: 'Mumbai', lat: 19.1, lon: 72.9 },
  { id: 'beijing', label: 'Beijing', lat: 39.9, lon: 116.4 },
  { id: 'tokyo', label: 'Tokyo', lat: 35.7, lon: 139.7 },
  { id: 'sydney', label: 'Sydney', lat: -33.9, lon: 151.2 },
  { id: 'saopaulo', label: 'São Paulo', lat: -23.5, lon: -46.6 },
  { id: 'equator_pacific', label: 'Equator Pacific', lat: 0, lon: -160 },
  { id: 'equator_africa', label: 'Equator Africa', lat: 0, lon: 20 },
];

export const STORM_EVENT_TYPES = new Set([
  'Tornado',
  'Hurricane',
  'Typhoon',
  'Tropical Storm',
  'Tropical Depression',
  'Flash Flood',
  'Flood',
  'Hail',
  'Winter Storm',
  'Blizzard',
  'Ice Storm',
  'Heavy Rain',
  'High Wind',
  'Thunderstorm Wind',
  'Dust Storm',
  'Wildfire',
  'Extreme Cold/Wind Chill',
  'Excessive Heat',
]);

export const EPHEMERIS_BODIES = [
  { id: '301', key: 'moon', name: 'Moon' },
  { id: '10', key: 'sun', name: 'Sun' },
  { id: '199', key: 'mercury', name: 'Mercury' },
  { id: '299', key: 'venus', name: 'Venus' },
  { id: '499', key: 'mars', name: 'Mars' },
  { id: '599', key: 'jupiter', name: 'Jupiter' },
  { id: '699', key: 'saturn', name: 'Saturn' },
];

export const SOURCES = {
  iersEop: {
    name: 'IERS Earth Orientation Parameters C04',
    org: 'IERS',
    citation: 'Bizouard et al., IERS EOP C04 ITRF 2020',
    link: 'https://hpiers.obspm.fr/eop-pc/index.php?index=C04&lang=en',
  },
  usgsEarthquakes: {
    name: 'USGS Earthquake Catalog',
    org: 'U.S. Geological Survey',
    citation: 'USGS FDSN Event Web Service',
    link: 'https://earthquake.usgs.gov/fdsnws/event/1/',
  },
  gvpEruptions: {
    name: 'Smithsonian GVP Eruptions Since 1960',
    org: 'Smithsonian GVP',
    citation: 'GVP E3WebApp_Eruptions1960',
    link: 'https://volcano.si.edu/database/webservices.cfm',
  },
  gvpVolcanoes: {
    name: 'Smithsonian GVP Holocene Volcanoes',
    org: 'Smithsonian GVP',
    citation: 'GVP Holocene Volcano List',
    link: 'https://volcano.si.edu/gvp_votw.cfm',
  },
  jplHorizons: {
    name: 'JPL Horizons Ephemeris',
    org: 'NASA JPL',
    citation: 'Horizons API, DE441',
    link: 'https://ssd.jpl.nasa.gov/horizons/',
  },
  openMeteo: {
    name: 'Open-Meteo Historical Weather',
    org: 'Open-Meteo',
    citation: 'ERA5 reanalysis archive API',
    link: 'https://open-meteo.com/en/docs/historical-weather-api',
  },
  noaaStorms: {
    name: 'NOAA Storm Events Database',
    org: 'NOAA NCEI',
    citation: 'NCEI Storm Events CSV',
    link: 'https://www.ncei.noaa.gov/stormevents/',
  },
  nasaSunspot: {
    name: 'International Sunspot Number',
    org: 'NASA MSFC / SILSO',
    citation: 'Monthly sunspot (expanded to daily)',
    link: 'https://solarscience.msfc.nasa.gov/greenwch/',
  },
  nasaDonki: {
    name: 'NASA DONKI Space Weather',
    org: 'NASA CCMC',
    citation: 'CME, flare, and geomagnetic storm catalog',
    link: 'https://api.nasa.gov/DONKI/docs',
  },
  plateBoundaries: {
    name: 'PB2002 Plate Boundaries',
    org: 'Bird (2003) / NOAA NGDC',
    citation: 'Global tectonic plate boundary model PB2002',
    link: 'https://www.ngdc.noaa.gov/mgg/ocean/plate_boundary/',
  },
  igrfWmm: {
    name: 'IGRF / WMM Magnetic Field',
    org: 'NOAA NCEI',
    citation: 'WMM2020 dipole field line model',
    link: 'https://www.ncei.noaa.gov/products/world-magnetic-model',
  },
  mantleHotspots: {
    name: 'Wilson Mantle Hotspots',
    org: 'Smithsonian GVP / plate tectonic synthesis',
    citation: 'Reference hotspot surface positions',
    link: 'https://volcano.si.edu/glossary/Hotspot/',
  },
  plateMotion: {
    name: 'PB2002 Plate Motion (Euler poles)',
    org: 'Peter Bird / DeMets et al.',
    citation: 'PB2002 angular velocities in deg/Ma',
    link: 'http://peterbird.name/oldFTP/PB2002/PB2002_poles.dat.txt',
  },
  noaaSwpc: {
    name: 'NOAA Space Weather Prediction Center',
    org: 'NOAA SWPC',
    citation: 'Planetary K-index and daily geomagnetic indices',
    link: 'https://www.swpc.noaa.gov/products/planetary-k-index',
  },
  kyotoDst: {
    name: 'Dst Geomagnetic Index',
    org: 'WDC for Geomagnetism, Kyoto',
    citation: 'Hourly equatorial Dst (storm-time ring current)',
    link: 'https://wdc.kugi.kyoto-u.ac.jp/dstae/index.html',
  },
  omniSolarWind: {
    name: 'OMNI Near-Earth Solar Wind',
    org: 'NASA GSFC SPDF',
    citation: 'OMNI2 hourly IMF and plasma parameters',
    link: 'https://omniweb.gsfc.nasa.gov/',
  },
  noaaDscovr: {
    name: 'DSCOVR Real-Time Solar Wind',
    org: 'NOAA SWPC',
    citation: 'ACE/DSCOVR L1 magnetic field and plasma (1-day)',
    link: 'https://www.swpc.noaa.gov/products/real-time-solar-wind',
  },
  ovationAurora: {
    name: 'OVATION Aurora Forecast',
    org: 'NOAA SWPC',
    citation: 'Auroral oval probability model (nowcast)',
    link: 'https://www.swpc.noaa.gov/products/aurora-30-minute-forecast',
  },
  gfzAam: {
    name: 'Atmospheric Angular Momentum (AAM)',
    org: 'GFZ Potsdam',
    citation: 'ESMGFZ operational AAM v1.0 (ECMWF analysis, 3h)',
    link: 'https://www.gfz.de/en/sektion/erdsystem-modellierung/esmdata/esmdata/eam/',
  },
};