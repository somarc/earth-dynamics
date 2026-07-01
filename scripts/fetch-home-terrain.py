#!/usr/bin/env python3
"""Fuse CA HRDEM + US 3DEP hillshade for the home bbox (cross-border LiDAR)."""
from __future__ import annotations

import json
import math
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import rasterio
from rasterio.enums import Resampling
from rasterio.warp import reproject
from rasterio.transform import from_bounds
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HOME_JSON = ROOT / "public/data/home-region.json"
OUT_DIR = ROOT / "public/textures/home"
CA_WMS = "https://datacube.services.geo.ca/ows/elevation"
PC_STAC = "https://planetarycomputer.microsoft.com/api/stac/v1"
PC_SIGN = "https://planetarycomputer.microsoft.com/api/sas/v1/sign"
USER_AGENT = "Wobblescope/0.2 (earth-dynamics; terrain-fetch)"


def load_home_config() -> dict:
    with open(HOME_JSON) as f:
        return json.load(f)


def grid_size(bbox: dict, target_width: int = 2048) -> tuple[int, int]:
    mid_lat = (bbox["south"] + bbox["north"]) / 2
    lon_m = 111_320 * math.cos(math.radians(mid_lat))
    lat_m = 111_320
    width_m = (bbox["east"] - bbox["west"]) * lon_m
    height_m = (bbox["north"] - bbox["south"]) * lat_m
    width = target_width
    height = max(64, round(width * (height_m / width_m)))
    return width, height


def fetch_bytes(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=120) as res:
        return res.read()


def sign_pc_href(href: str) -> str:
    q = urllib.parse.urlencode({"href": href})
    data = json.loads(fetch_bytes(f"{PC_SIGN}?{q}").decode())
    return data["href"]


def stac_items(bbox: dict, *, limit: int = 24) -> list[dict]:
    params = urllib.parse.urlencode(
        {
            "bbox": f"{bbox['west']},{bbox['south']},{bbox['east']},{bbox['north']}",
            "limit": str(limit),
        }
    )
    url = f"{PC_STAC}/collections/3dep-seamless/items?{params}"
    data = json.loads(fetch_bytes(url).decode())
    return data.get("features", [])


def us_fetch_bbox(home_bbox: dict) -> dict:
    """US shore of Lake Ontario / northern NY — tight overlap with Eastern Ontario."""
    return {
        "west": max(home_bbox["west"], -76.25),
        "south": max(home_bbox["south"], 43.8),
        "east": min(home_bbox["east"], -74.5),
        "north": min(home_bbox["north"], 46.2),
    }


def filter_us_tiles(features: list[dict], us_bbox: dict, *, max_tiles: int = 8) -> list[dict]:
    """Keep border tiles only; prefer single COG per 1° cell (-13 suffix)."""
    by_cell: dict[str, dict] = {}
    for feat in features:
        tile_id = feat.get("id", "")
        b = feat.get("bbox")
        if not b:
            continue
        west, south, east, north = b
        if east < us_bbox["west"] or west > us_bbox["east"]:
            continue
        if north < us_bbox["south"] or south > us_bbox["north"]:
            continue
        cell = tile_id.rsplit("-", 1)[0]
        prev = by_cell.get(cell)
        if prev is None or tile_id.endswith("-13"):
            by_cell[cell] = feat

    kept = sorted(by_cell.values(), key=lambda f: f["id"])
    return kept[:max_tiles]


def fetch_ca_hillshade(bbox: dict, width: int, height: int) -> np.ndarray:
    params = urllib.parse.urlencode(
        {
            "SERVICE": "WMS",
            "VERSION": "1.3.0",
            "REQUEST": "GetMap",
            "BBOX": f"{bbox['south']},{bbox['west']},{bbox['north']},{bbox['east']}",
            "CRS": "EPSG:4326",
            "WIDTH": width,
            "HEIGHT": height,
            "LAYERS": "dtm-hillshade",
            "STYLES": "",
            "FORMAT": "image/png",
        }
    )
    png = fetch_bytes(f"{CA_WMS}?{params}")
    img = Image.open(__import__("io").BytesIO(png)).convert("L")
    return np.array(img, dtype=np.float32)


def mosaic_us_elevation(home_bbox: dict, width: int, height: int) -> np.ndarray:
    dst_transform = from_bounds(
        home_bbox["west"],
        home_bbox["south"],
        home_bbox["east"],
        home_bbox["north"],
        width,
        height,
    )
    dst = np.full((height, width), np.nan, dtype=np.float32)
    us_bbox = us_fetch_bbox(home_bbox)
    items = filter_us_tiles(stac_items(us_bbox), us_bbox)
    if not items:
        print("  No US 3DEP seamless tiles in US overlap — US side will use CA fallback only", flush=True)
        return dst

    print(f"  Reading {len(items)} US 3DEP tile(s) for {us_bbox}…", flush=True)
    for i, item in enumerate(items, 1):
        href = item["assets"]["data"]["href"]
        signed = sign_pc_href(href)
        print(f"    [{i}/{len(items)}] {item['id']}…", flush=True)
        temp = np.full((height, width), np.nan, dtype=np.float32)
        with rasterio.open(signed) as src:
            reproject(
                source=rasterio.band(src, 1),
                destination=temp,
                src_transform=src.transform,
                src_crs=src.crs,
                dst_transform=dst_transform,
                dst_crs="EPSG:4326",
                resampling=Resampling.bilinear,
                src_nodata=src.nodata,
                dst_nodata=np.nan,
            )
        valid = np.isfinite(temp) & (temp > -1000)
        dst[valid] = temp[valid]

    return dst


def compute_hillshade(
    elev: np.ndarray,
    cell_x_m: float,
    cell_y_m: float,
    azimuth: float = 315.0,
    altitude: float = 45.0,
) -> np.ndarray:
    """Horn hillshade in meters."""
    out = np.full(elev.shape, 128.0, dtype=np.float32)
    zenith = math.radians(90.0 - altitude)
    az = math.radians(azimuth)
    valid = np.isfinite(elev)
    z = np.where(valid, elev, np.nanmean(elev[valid]) if np.any(valid) else 0.0)

    dzdy, dzdx = np.gradient(z, cell_y_m, cell_x_m)
    slope = np.arctan(np.hypot(dzdx, dzdy))
    aspect = np.arctan2(dzdy, -dzdx)
    aspect = np.where(aspect < 0, aspect + 2 * math.pi, aspect)
    hs = 255.0 * (
        np.cos(zenith) * np.cos(slope)
        + np.sin(zenith) * np.sin(slope) * np.cos(az - aspect)
    )
    hs = np.clip(hs, 0, 255)
    out[valid] = hs[valid]
    return out


def border_weight(lon: np.ndarray, border_lon: float = -75.35, feather: float = 0.35) -> np.ndarray:
    """0 = Canada west, 1 = US east."""
    t = (lon - (border_lon - feather)) / (2 * feather)
    return np.clip(t, 0, 1)


def main() -> None:
    target_width = 2048
    ca_only = "--ca-only" in sys.argv
    for arg in sys.argv:
        if arg.startswith("--width="):
            target_width = int(arg.split("=", 1)[1])

    config = load_home_config()
    bbox = config["bbox"]
    width, height = grid_size(bbox, target_width)
    mid_lat = (bbox["south"] + bbox["north"]) / 2
    m = 111_320 * math.cos(math.radians(mid_lat))
    cell_x_m = (bbox["east"] - bbox["west"]) * m / max(1, width - 1)
    cell_y_m = (bbox["north"] - bbox["south"]) * 111_320 / max(1, height - 1)

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Fetching CA HRDEM DTM hillshade ({width}×{height})…", flush=True)
    ca = fetch_ca_hillshade(bbox, width, height)

    if ca_only:
        print("Skipping US 3DEP (--ca-only)", flush=True)
        us_elev = np.full((height, width), np.nan, dtype=np.float32)
    else:
        print("Fetching US 3DEP seamless elevation…", flush=True)
        us_elev = mosaic_us_elevation(bbox, width, height)
    us_valid = np.isfinite(us_elev)
    us_hs = compute_hillshade(us_elev, cell_x_m, cell_y_m) if np.any(us_valid) else us_elev

    lons = np.linspace(bbox["west"], bbox["east"], width)
    lon_grid = np.tile(lons, (height, 1))
    w_us = border_weight(lon_grid)
    w_ca = 1.0 - w_us

    fused = np.full((height, width), 128.0, dtype=np.float32)
    has_ca = ca > 0
    has_us = us_valid

    for y in range(height):
        for x in range(width):
            if has_us[y, x] and has_ca[y, x]:
                fused[y, x] = ca[y, x] * w_ca[y, x] + us_hs[y, x] * w_us[y, x]
            elif has_us[y, x]:
                fused[y, x] = us_hs[y, x]
            elif has_ca[y, x]:
                fused[y, x] = ca[y, x]

    # Coverage: 0=none, 128=CA, 255=US, 192=blend
    coverage = np.zeros((height, width), dtype=np.uint8)
    coverage[has_ca & ~has_us] = 128
    coverage[has_us & ~has_ca] = 255
    overlap = has_ca & has_us
    coverage[overlap] = np.where(w_us[overlap] > 0.5, 192, 128).astype(np.uint8)

    hill_path = OUT_DIR / "hillshade.png"
    cov_path = OUT_DIR / "terrain-coverage.png"
    Image.fromarray(fused.astype(np.uint8), mode="L").save(hill_path, optimize=True)
    Image.fromarray(coverage, mode="L").save(cov_path, optimize=True)

    config["terrain"] = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "resolution": f"{width}x{height}",
        "borderLon": -75.35,
        "featherDeg": 0.35,
        "about": (
            "Cross-border LiDAR hillshade: Canada HRDEM DTM (WMS) feathered into US "
            "USGS 3DEP Seamless 1 m DEM. Fixes the hard project-edge cutoff in federal viewers."
        ),
        "assets": {
            "hillshade": "/textures/home/hillshade.png",
            "coverage": "/textures/home/terrain-coverage.png",
        },
        "sources": [
            {
                "id": "hrdem-dtm-hillshade",
                "role": "ca-hillshade",
                "name": "HRDEM DTM hillshade",
                "org": "NRCan / CCMEO Datacube",
                "link": "https://datacube.services.geo.ca/",
                "epistemic": "measured",
            },
            {
                "id": "usgs-3dep-seamless-1m",
                "role": "us-dem",
                "name": "USGS 3DEP Seamless 1 m DEM",
                "org": "USGS / Microsoft Planetary Computer",
                "link": "https://planetarycomputer.microsoft.com/dataset/3dep-seamless",
                "epistemic": "measured",
            },
            {
                "id": "wobblescope-terrain-blend",
                "role": "fusion",
                "name": "Cross-border hillshade fusion",
                "org": "Wobblescope",
                "epistemic": "derived",
            },
        ],
    }
    if "assets" not in config:
        config["assets"] = {}
    config["assets"]["hillshade"] = config["terrain"]["assets"]["hillshade"]
    config["assets"]["terrainCoverage"] = config["terrain"]["assets"]["coverage"]

    with open(HOME_JSON, "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")

    us_pct = 100.0 * np.sum(has_us) / has_us.size
    blend_pct = 100.0 * np.sum(has_ca & has_us) / has_us.size
    print(f"Wrote {hill_path}\n     {cov_path}\n     {HOME_JSON}")
    print(f"  US 3DEP coverage: {us_pct:.1f}% of grid · overlap blend: {blend_pct:.1f}%")

    import subprocess

    sync = ROOT / "scripts" / "sync-home-to-db.mjs"
    if sync.exists():
        print("  → SQLite…", flush=True)
        subprocess.run(["node", str(sync)], cwd=ROOT, check=True)


if __name__ == "__main__":
    main()