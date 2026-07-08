import * as THREE from 'three';
import { EARTH_RADIUS, latLonToVector3 } from '../../src/utils.js';
import { loadDem, sampleDem, DEM_PRESETS } from '../../src/lib/terrain-dem.js';

const DEFAULT_CENTER = { lat: 36.1, lon: -112.1, name: 'Grand Canyon' }; // dramatic default for "terrain view" visibility
const HOME_CENTER = { lat: 45.4215, lon: -75.6972, name: 'Eastern Ontario' };
const DEFAULT_ZOOM = 12;

/** Best-effort fetch of home center from static or API (used at init time). */
async function resolveHomeCenter() {
  try {
    const apiRes = await fetch((import.meta.env.VITE_API_BASE || '') + '/api/home');
    if (apiRes.ok) {
      const cfg = await apiRes.json();
      if (cfg?.center) return { ...cfg.center, name: cfg.name || 'Home' };
    }
  } catch {}
  try {
    const res = await fetch('/data/home-region.json');
    if (res.ok) {
      const cfg = await res.json();
      if (cfg?.center) return { ...cfg.center, name: cfg.name || 'Home' };
    }
  } catch {}
  return HOME_CENTER;
}
const TILES_ACROSS = 3; // 768 px coverage — good balance
const VERTICAL_EXAG = 3.2; // relief exaggeration for visibility at globe scale
const PATCH_LIFT = 0.002; // small radial lift so the 3D topo sits visibly above the base earth shell

/**
 * Build a local tangent frame at (lat, lon).
 * Returns { origin, normal, east, north } all unit or positioned vectors.
 */
function computeTangentFrame(lat, lon, radius = EARTH_RADIUS) {
  const origin = latLonToVector3(lat, lon, radius);
  const normal = new THREE.Vector3(origin.x, origin.y, origin.z).normalize();

  const worldUp = new THREE.Vector3(0, 1, 0);
  let east = new THREE.Vector3().crossVectors(worldUp, normal);
  if (east.lengthSq() < 1e-8) {
    east.set(1, 0, 0);
  } else {
    east.normalize();
  }
  const north = new THREE.Vector3().crossVectors(normal, east).normalize();

  return { origin, normal, east, north };
}

/**
 * Create a displaced plane terrain mesh from a DEM, oriented tangent to the globe.
 * The mesh is centered at the DEM sample point.
 */
export function createTerrainMeshFromDem(dem, centerLat, centerLon, { exaggeration = VERTICAL_EXAG } = {}) {
  const { data, size, metersPerPixel, extentMeters, meanM } = dem;

  // Physical size of the patch in globe units (approx)
  // We map the real extent (meters) to a small arc length on unit sphere.
  // For local patches this is close enough to a flat tangent plane.
  const physicalSize = (extentMeters / 1_000_000) * 1.15;
  // Target a clearly visible regional patch on the globe (larger so "terrain view" is obvious even at moderate zoom)
  const targetSize = Math.min(0.45, Math.max(0.18, physicalSize));
  const half = targetSize * 0.5;

  const res = Math.min(320, Math.max(96, Math.floor(size / 2.6))); // vertex resolution
  const geo = new THREE.PlaneGeometry(targetSize, targetSize, res, res);
  geo.rotateX(-Math.PI / 2); // plane faces +Y in local

  const posAttr = geo.attributes.position;
  const arr = posAttr.array;

  // DEM sampler: x,z in [-half, half] → height in scene units
  const scale = (targetSize / extentMeters) * exaggeration;
  const sample = (x, z) => {
    // map local plane coords to pixel coords in DEM
    const px = (x / targetSize + 0.5) * (size - 1);
    const py = (z / targetSize + 0.5) * (size - 1);
    const hMeters = sampleDem(dem, px, py) - meanM;
    return hMeters * scale;
  };

  let minH = Infinity;
  let maxH = -Infinity;

  for (let i = 0; i < posAttr.count; i++) {
    const x = arr[i * 3 + 0];
    const z = arr[i * 3 + 2];
    const h = sample(x, z);
    arr[i * 3 + 1] = h;
    if (h < minH) minH = h;
    if (h > maxH) maxH = h;
  }
  geo.computeVertexNormals();

  // Vertex colors: simple hypsometric tint (low → high) — USGS topo flavor
  const colors = new Float32Array(posAttr.count * 3);
  const span = Math.max(1e-5, maxH - minH);
  for (let i = 0; i < posAttr.count; i++) {
    const h = arr[i * 3 + 1];
    const t = Math.max(0, Math.min(1, (h - minH) / span));
    // low: greenish, mid: tan, high: pale / reddish peaks
    let r, g, b;
    if (t < 0.35) {
      const s = t / 0.35;
      r = 0.28 + s * 0.22;
      g = 0.48 + s * 0.18;
      b = 0.26 + s * 0.06;
    } else if (t < 0.72) {
      const s = (t - 0.35) / 0.37;
      r = 0.50 + s * 0.32;
      g = 0.66 - s * 0.18;
      b = 0.32 - s * 0.08;
    } else {
      const s = (t - 0.72) / 0.28;
      r = 0.82 + s * 0.14;
      g = 0.48 - s * 0.12;
      b = 0.24 + s * 0.08;
    }
    colors[i * 3 + 0] = r;
    colors[i * 3 + 1] = g;
    colors[i * 3 + 2] = b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  // Base material with vertex colors (hypsometric). For full monolith-terrain styling
  // (contour lines + custom hypsometric ramp in fragment via onBeforeCompile) see
  // the Terrain class + shader injection in kaolti/monolith-terrain/src/terrain.js.
  // We can layer that on later without changing the DEM or geometry pipeline.
  const mat = new THREE.MeshPhongMaterial({
    vertexColors: true,
    flatShading: false,
    shininess: 5,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'terrain-dem-mesh';
  mesh.userData = {
    demMeta: {
      lat: centerLat,
      lon: centerLon,
      zoom: dem.zoom,
      minM: dem.minM,
      maxM: dem.maxM,
      meanM,
      metersPerPixel: dem.metersPerPixel,
      exaggeration,
    },
    about: dem.about,
  };

  // Position + orient in world so the plane is tangent at the center point
  const frame = computeTangentFrame(centerLat, centerLon, EARTH_RADIUS + PATCH_LIFT);
  const group = new THREE.Group();
  group.add(mesh);

  // Align local +Y (after rotateX) with globe normal
  // PlaneGeometry after rotateX has +Y "up" as the normal we want.
  group.position.copy(frame.origin);

  // Build orthonormal basis: right=east, up=normal, fwd=-north? Adjust so mesh +Z points "north-ish"
  const m = new THREE.Matrix4();
  // columns: right, up, -forward (so that +Z after rotation points "along north" on tangent)
  const right = frame.east;
  const up = frame.normal;
  const fwd = frame.north.clone().negate(); // flip so typical "north up" on the plane reads nicely
  m.makeBasis(right, up, fwd);
  group.quaternion.setFromRotationMatrix(m);

  group.userData.dem = dem;
  group.userData.mesh = mesh;
  group.userData.center = { lat: centerLat, lon: centerLon };
  group.userData.about = dem.about;

  return group;
}

/**
 * Load a DEM for the given center and return a ready-to-add group containing the terrain mesh.
 */
export async function loadTerrainPatch({
  lat = DEFAULT_CENTER.lat,
  lon = DEFAULT_CENTER.lon,
  zoom = DEFAULT_ZOOM,
  exaggeration = VERTICAL_EXAG,
} = {}) {
  const dem = await loadDem({ lat, lon, zoom, tilesAcross: TILES_ACROSS });
  const group = createTerrainMeshFromDem(dem, lat, lon, { exaggeration });
  group.name = 'terrain-patch';
  return group;
}

/**
 * Layer init entry point (called by LayerController).
 * Creates a group that will hold the terrain when loaded.
 * Loading is lazy — the actual DEM fetch happens on first setVisible(true) or explicit load.
 */
export async function initTerrainGlobe(ctx) {
  const group = new THREE.Group();
  group.name = 'terrain';
  group.visible = false;

  group.userData = {
    about:
      'Real topographic surface (3D mesh) from public AWS Terrain Tiles (Terrarium DEM). ' +
      'Leverages the same live DEM loading + displaced terrain technique as https://github.com/kaolti/monolith-terrain. ' +
      'Live-fetched in browser (no key). Exaggeration applied for legibility on the Wobblescope globe. ' +
      'Data attribution: Mapzen/Tilezen, SRTM, USGS 3DEP, ETOPO1, etc.',
    load: async (opts = {}) => {
      // Remove previous
      group.clear();

      // UX: show loading state on the chip while fetching DEM tiles
      const chip = document.getElementById('chip-terrain');
      const originalTitle = chip ? chip.title : '';
      if (chip) {
        chip.style.opacity = '0.6';
        chip.title = 'Terrain (loading 3D DEM tiles…)';
      }

      const center = opts.center || DEFAULT_CENTER;
      let patch;
      try {
        patch = await loadTerrainPatch({
          lat: center.lat,
          lon: center.lon,
          zoom: opts.zoom ?? DEFAULT_ZOOM,
          exaggeration: opts.exaggeration ?? VERTICAL_EXAG,
        });
      } finally {
        if (chip) {
          chip.style.opacity = '';
          chip.title = originalTitle || chip.title;
        }
      }

      group.add(patch);
      group.userData.patch = patch;
      group.userData.loadedCenter = center;
      return patch;
    },
    setExaggeration: (exag) => {
      const patch = group.userData.patch;
      if (!patch?.userData?.mesh) return;
      // For a quick live tweak we could rebuild, but for MVP just note it.
      // Rebuild on demand via load() for now.
      console.info('[terrain] setExaggeration would require reload for full effect');
    },
  };

  // Auto-load a scenic default patch so the "Terrain" layer is immediately visible and recognizable
  // as a 3D topo view when toggled (Grand Canyon area by default). "Home" button will swap to local.
  // Layer starts hidden until the user enables the chip.
  try {
    const patch = await loadTerrainPatch({ lat: DEFAULT_CENTER.lat, lon: DEFAULT_CENTER.lon, zoom: DEFAULT_ZOOM });
    group.add(patch);
    group.userData.patch = patch;
    group.userData.loadedCenter = DEFAULT_CENTER;
  } catch (err) {
    console.warn('[terrain] Initial DEM load failed (will retry on demand):', err);
  }

  return group;
}

export function setTerrainVisible(group, visible) {
  if (!group) return;
  const v = !!visible;
  group.visible = v;

  // Lazy load on first show if we don't have a patch yet (scenic default)
  if (v && !group.userData?.patch && group.userData?.load) {
    group.userData
      .load({ center: DEFAULT_CENTER })
      .then(() => {
        // patch is now inside the group
      })
      .catch((e) => console.warn('[terrain] lazy load on show failed', e));
  }
}

export function getTerrainAbout(group) {
  return group?.userData?.about ?? null;
}
