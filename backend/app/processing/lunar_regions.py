"""
lunar_regions.py
Defines ~12 selectable lunar regions with pre-generated terrain data.
Each region has different terrain characteristics for varied analysis.
"""

import os
import json
import numpy as np
import cv2
from typing import List, Dict, Optional

# Base data directory for region tiles
REGIONS_DATA_DIR = "data/regions"

# ────────────────────────────────────────────────────────────────────
# Pre-defined Lunar Regions
# ────────────────────────────────────────────────────────────────────
LUNAR_REGIONS = [
    {
        "id": "shiv-shakti",
        "name": "Shiv Shakti Point",
        "terrain_type": "highland",
        "description": "Chandrayaan-3 landing site near the lunar south pole. Gentle slopes with scattered small craters.",
        "center_lat": -69.37,
        "center_lon": 32.35,
        "size_deg": 0.4,
        "features": ["gentle_slopes", "small_craters", "regolith"],
        "difficulty": "easy",
        "crater_density": 0.15,
        "boulder_density": 0.08,
        "mean_slope_deg": 4.2,
        "shadow_pct": 3.0,
        "map_x_pct": 58,
        "map_y_pct": 88
    },
    {
        "id": "aristarchus",
        "name": "Aristarchus Crater",
        "terrain_type": "crater_complex",
        "description": "One of the brightest features on the Moon. Deep crater with steep walls and bright ray system.",
        "center_lat": 23.73,
        "center_lon": -47.49,
        "size_deg": 0.5,
        "features": ["deep_crater", "steep_walls", "bright_rays", "plateau"],
        "difficulty": "hard",
        "crater_density": 0.45,
        "boulder_density": 0.25,
        "mean_slope_deg": 18.5,
        "shadow_pct": 15.0,
        "map_x_pct": 28,
        "map_y_pct": 32
    },
    {
        "id": "copernicus",
        "name": "Copernicus Crater",
        "terrain_type": "central_peak_crater",
        "description": "Prominent lunar crater with terraced walls and a prominent central peak complex.",
        "center_lat": 9.62,
        "center_lon": -20.08,
        "size_deg": 0.5,
        "features": ["terraced_walls", "central_peak", "ejecta_blanket"],
        "difficulty": "hard",
        "crater_density": 0.40,
        "boulder_density": 0.20,
        "mean_slope_deg": 15.2,
        "shadow_pct": 12.0,
        "map_x_pct": 40,
        "map_y_pct": 44
    },
    {
        "id": "mare-imbrium",
        "name": "Mare Imbrium",
        "terrain_type": "mare_basalt",
        "description": "Large basaltic lava plain. Flat terrain with wrinkle ridges and sparse craters.",
        "center_lat": 36.0,
        "center_lon": -16.0,
        "size_deg": 0.6,
        "features": ["lava_plains", "wrinkle_ridges", "sparse_craters"],
        "difficulty": "easy",
        "crater_density": 0.08,
        "boulder_density": 0.04,
        "mean_slope_deg": 2.1,
        "shadow_pct": 1.0,
        "map_x_pct": 42,
        "map_y_pct": 25
    },
    {
        "id": "tycho",
        "name": "Tycho Crater",
        "terrain_type": "young_impact",
        "description": "Young, prominent impact crater with extensive ray system visible from Earth.",
        "center_lat": -43.31,
        "center_lon": -11.36,
        "size_deg": 0.5,
        "features": ["ray_system", "steep_walls", "central_peak", "fresh_ejecta"],
        "difficulty": "hard",
        "crater_density": 0.50,
        "boulder_density": 0.30,
        "mean_slope_deg": 20.0,
        "shadow_pct": 18.0,
        "map_x_pct": 45,
        "map_y_pct": 72
    },
    {
        "id": "mare-tranq",
        "name": "Mare Tranquillitatis",
        "terrain_type": "mare",
        "description": "Apollo 11 landing site. Smooth basaltic terrain with moderate crater population.",
        "center_lat": 8.5,
        "center_lon": 31.4,
        "size_deg": 0.5,
        "features": ["smooth_basalt", "historic_site", "moderate_craters"],
        "difficulty": "easy",
        "crater_density": 0.12,
        "boulder_density": 0.06,
        "mean_slope_deg": 2.8,
        "shadow_pct": 2.0,
        "map_x_pct": 62,
        "map_y_pct": 44
    },
    {
        "id": "south-pole",
        "name": "South Pole Region",
        "terrain_type": "polar_highland",
        "description": "Permanently shadowed craters at the south pole. Extreme terrain with deep shadows.",
        "center_lat": -88.0,
        "center_lon": 0.0,
        "size_deg": 0.3,
        "features": ["permanent_shadow", "deep_craters", "ice_deposits"],
        "difficulty": "extreme",
        "crater_density": 0.55,
        "boulder_density": 0.35,
        "mean_slope_deg": 22.0,
        "shadow_pct": 45.0,
        "map_x_pct": 50,
        "map_y_pct": 96
    },
    {
        "id": "mare-seren",
        "name": "Mare Serenitatis",
        "terrain_type": "mare",
        "description": "Large, smooth basaltic plain on the Moon's near side. Ideal for safe landings.",
        "center_lat": 28.0,
        "center_lon": 17.5,
        "size_deg": 0.5,
        "features": ["smooth_basalt", "wrinkle_ridges", "low_roughness"],
        "difficulty": "easy",
        "crater_density": 0.06,
        "boulder_density": 0.03,
        "mean_slope_deg": 1.8,
        "shadow_pct": 0.5,
        "map_x_pct": 56,
        "map_y_pct": 30
    },
    {
        "id": "clavius",
        "name": "Clavius Crater",
        "terrain_type": "large_crater",
        "description": "One of the largest craters visible from Earth. Contains floor craters of decreasing size.",
        "center_lat": -58.4,
        "center_lon": -14.4,
        "size_deg": 0.6,
        "features": ["floor_craters", "varied_terrain", "chain_craters"],
        "difficulty": "medium",
        "crater_density": 0.35,
        "boulder_density": 0.15,
        "mean_slope_deg": 8.5,
        "shadow_pct": 8.0,
        "map_x_pct": 44,
        "map_y_pct": 80
    },
    {
        "id": "oceanus-proc",
        "name": "Oceanus Procellarum",
        "terrain_type": "large_mare",
        "description": "The largest dark area on the Moon. Extensive lava flows with very flat terrain.",
        "center_lat": 18.4,
        "center_lon": -57.4,
        "size_deg": 0.6,
        "features": ["extensive_lava", "very_flat", "volcanic_domes"],
        "difficulty": "easy",
        "crater_density": 0.05,
        "boulder_density": 0.02,
        "mean_slope_deg": 1.5,
        "shadow_pct": 0.3,
        "map_x_pct": 24,
        "map_y_pct": 38
    },
    {
        "id": "humboldt",
        "name": "Humboldt Crater",
        "terrain_type": "floor_fractured",
        "description": "Floor-fractured crater with rille systems. Flat interior with fracture patterns.",
        "center_lat": -27.0,
        "center_lon": 80.9,
        "size_deg": 0.5,
        "features": ["fracture_patterns", "flat_floor", "rilles"],
        "difficulty": "medium",
        "crater_density": 0.20,
        "boulder_density": 0.10,
        "mean_slope_deg": 6.0,
        "shadow_pct": 5.0,
        "map_x_pct": 80,
        "map_y_pct": 62
    },
    {
        "id": "malapert",
        "name": "Malapert Mountain",
        "terrain_type": "polar_peak",
        "description": "Mountain near the south pole with persistent sunlit ridges. Candidate for solar power station.",
        "center_lat": -86.0,
        "center_lon": 0.0,
        "size_deg": 0.3,
        "features": ["sunlit_ridge", "polar_location", "high_elevation"],
        "difficulty": "hard",
        "crater_density": 0.30,
        "boulder_density": 0.25,
        "mean_slope_deg": 14.0,
        "shadow_pct": 25.0,
        "map_x_pct": 50,
        "map_y_pct": 93
    }
]


def get_region_list() -> List[Dict]:
    """Returns all available lunar regions for frontend display."""
    regions = []
    for r in LUNAR_REGIONS:
        region_dir = os.path.join(REGIONS_DATA_DIR, r["id"])
        has_data = os.path.exists(os.path.join(region_dir, "tmc_tile.png"))

        regions.append({
            "id": r["id"],
            "name": r["name"],
            "terrain_type": r["terrain_type"],
            "description": r["description"],
            "center_lat": r["center_lat"],
            "center_lon": r["center_lon"],
            "difficulty": r["difficulty"],
            "features": r["features"],
            "crater_density": r["crater_density"],
            "mean_slope_deg": r["mean_slope_deg"],
            "shadow_pct": r["shadow_pct"],
            "has_data": has_data,
            "map_x_pct": r["map_x_pct"],
            "map_y_pct": r["map_y_pct"]
        })
    return regions


def get_region_by_id(region_id: str) -> Optional[Dict]:
    """Returns a single region definition by ID."""
    for r in LUNAR_REGIONS:
        if r["id"] == region_id:
            return r.copy()
    return None


def get_region_data_paths(region_id: str) -> Dict:
    """Returns file paths for a region's data tiles."""
    region_dir = os.path.join(REGIONS_DATA_DIR, region_id)
    return {
        "tmc_path": os.path.join(region_dir, "tmc_tile.png"),
        "dem_path": os.path.join(region_dir, "dem_tile.png"),
        "ohrc_path": os.path.join(region_dir, "ohrc_tile.png"),
        "metadata_path": os.path.join(region_dir, "metadata.json"),
        "region_dir": region_dir
    }


def load_region_data(region_id: str) -> Optional[Dict]:
    """
    Loads pre-generated terrain data for a region.
    Returns images and metadata needed for the processing pipeline.
    """
    paths = get_region_data_paths(region_id)

    if not os.path.exists(paths["tmc_path"]):
        return None

    tmc_img = cv2.imread(paths["tmc_path"], cv2.IMREAD_GRAYSCALE)
    dem_16 = cv2.imread(paths["dem_path"], cv2.IMREAD_UNCHANGED)
    ohrc_img = cv2.imread(paths["ohrc_path"], cv2.IMREAD_GRAYSCALE)

    with open(paths["metadata_path"], "r") as f:
        metadata = json.load(f)

    # Scale DEM to meters
    dem_scaled = dem_16.astype(np.float32) / 65535.0 * 50.0

    region_def = get_region_by_id(region_id)

    return {
        "tmc_img": tmc_img,
        "dem_img": dem_16,
        "dem_scaled": dem_scaled,
        "ohrc_img": ohrc_img,
        "metadata": metadata,
        "region": region_def,
        "has_dem": True,
        "tmc_meta": {
            "name": f"TMC2_{region_id}",
            "resolution_m": 5.0,
            "width": tmc_img.shape[1],
            "height": tmc_img.shape[0],
            "crs": "LUNAR_GEOGRAPHIC",
            "origin_lat": region_def["center_lat"],
            "origin_lon": region_def["center_lon"],
            "has_dem": True
        },
        "ohrc_meta": {
            "name": f"OHRC_{region_id}",
            "resolution_m": 0.25,
            "width": ohrc_img.shape[1] if ohrc_img is not None else 0,
            "height": ohrc_img.shape[0] if ohrc_img is not None else 0,
            "crs": "LUNAR_GEOGRAPHIC",
            "origin_lat": region_def["center_lat"],
            "origin_lon": region_def["center_lon"]
        }
    }


# ────────────────────────────────────────────────────────────────────
# Terrain Generation Utilities
# ────────────────────────────────────────────────────────────────────

def _perlin_noise_2d(shape, scale=10.0, octaves=4, seed=0):
    """Simple multi-octave noise generator for terrain."""
    rng = np.random.RandomState(seed)
    result = np.zeros(shape, dtype=np.float32)
    amplitude = 1.0
    frequency = 1.0

    for _ in range(octaves):
        # Generate random smooth noise
        small = rng.rand(
            max(2, int(shape[0] / (scale / frequency))),
            max(2, int(shape[1] / (scale / frequency)))
        ).astype(np.float32)
        upscaled = cv2.resize(small, (shape[1], shape[0]), interpolation=cv2.INTER_CUBIC)
        result += upscaled * amplitude
        amplitude *= 0.5
        frequency *= 2.0

    # Normalize to [0, 1]
    result = (result - result.min()) / (result.max() - result.min() + 1e-8)
    return result


def _add_craters(dem: np.ndarray, num_craters: int, seed: int = 0) -> tuple:
    """Adds realistic crater depressions to a DEM. Returns (dem, craters_list)."""
    rng = np.random.RandomState(seed)
    h, w = dem.shape
    craters = []

    for i in range(num_craters):
        cx = rng.randint(30, w - 30)
        cy = rng.randint(30, h - 30)
        radius = rng.randint(8, 50)
        depth = rng.uniform(2.0, 8.0) * (radius / 30.0)

        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((x - cx) ** 2 + (y - cy) ** 2).astype(np.float32)

        # Bowl shape
        bowl_mask = dist < radius
        rim_mask = (dist >= radius) & (dist < radius * 1.3)

        bowl_depth = depth * (1.0 - (dist / radius) ** 2)
        bowl_depth = np.clip(bowl_depth, 0, depth)

        dem[bowl_mask] -= bowl_depth[bowl_mask]
        dem[rim_mask] += depth * 0.2 * (1.0 - (dist[rim_mask] - radius) / (radius * 0.3))

        craters.append({
            "x": int(cx),
            "y": int(cy),
            "radius_m": int(radius),
            "depth_m": round(float(depth), 1)
        })

    return dem, craters


def _add_boulders(dem: np.ndarray, num_boulders: int, seed: int = 0) -> tuple:
    """Adds boulder-like features to a DEM. Returns (dem, boulders_list)."""
    rng = np.random.RandomState(seed)
    h, w = dem.shape
    boulders = []

    for i in range(num_boulders):
        bx = rng.randint(10, w - 10)
        by = rng.randint(10, h - 10)
        b_radius = rng.randint(2, 6)
        b_height = rng.uniform(0.8, 3.0)

        y, x = np.ogrid[:h, :w]
        dist = np.sqrt((x - bx) ** 2 + (y - by) ** 2).astype(np.float32)
        mask = dist < b_radius
        bump = b_height * (1.0 - (dist / b_radius) ** 2)
        dem[mask] += np.clip(bump[mask], 0, b_height)

        boulders.append({
            "x": int(bx),
            "y": int(by),
            "radius_m": int(b_radius),
            "height_m": round(float(b_height), 1)
        })

    return dem, boulders


def generate_region_terrain(region: Dict, size_tmc: int = 100, seed: int = None) -> Dict:
    """
    Generates realistic synthetic terrain for a given lunar region.

    Args:
        region: Region definition dict
        size_tmc: TMC tile size in pixels (100 = 500m at 5m/px)
        seed: Random seed (derived from region_id if None)

    Returns:
        Dictionary with tmc_img, dem_img, ohrc_img, and metadata
    """
    if seed is None:
        seed = hash(region["id"]) % (2 ** 31)

    size_hr = size_tmc * 5  # 500px for 1m resolution

    # Base terrain from noise
    terrain_base = _perlin_noise_2d((size_hr, size_hr), scale=8.0, octaves=5, seed=seed)

    # Scale to elevation range based on terrain type
    terrain_type = region["terrain_type"]

    if terrain_type in ["mare_basalt", "mare", "large_mare"]:
        # Flat with subtle variations
        dem = terrain_base * 5.0 + 20.0
        # Add wrinkle ridges
        ridge_noise = _perlin_noise_2d((size_hr, size_hr), scale=3.0, octaves=2, seed=seed + 1)
        ridge_mask = ridge_noise > 0.65
        dem[ridge_mask] += 1.5
    elif terrain_type in ["crater_complex", "central_peak_crater", "young_impact"]:
        # More varied terrain
        dem = terrain_base * 25.0 + 10.0
    elif terrain_type in ["highland", "polar_highland", "polar_peak"]:
        # Rolling highlands
        dem = terrain_base * 15.0 + 15.0
    elif terrain_type in ["large_crater"]:
        dem = terrain_base * 20.0 + 12.0
    elif terrain_type in ["floor_fractured"]:
        dem = terrain_base * 10.0 + 18.0
        # Add fracture lines
        frac_noise = _perlin_noise_2d((size_hr, size_hr), scale=2.0, octaves=2, seed=seed + 2)
        fractures = (frac_noise > 0.48) & (frac_noise < 0.52)
        dem[fractures] -= 3.0
    else:
        dem = terrain_base * 12.0 + 18.0

    # Add craters based on density
    num_craters = max(1, int(region["crater_density"] * 25))
    dem, craters = _add_craters(dem, num_craters, seed=seed + 10)

    # Add boulders
    num_boulders = max(0, int(region["boulder_density"] * 40))
    dem, boulders = _add_boulders(dem, num_boulders, seed=seed + 20)

    # Add shadow regions for polar locations
    shadow_mask = np.zeros((size_hr, size_hr), dtype=bool)
    if region["shadow_pct"] > 10.0:
        shadow_noise = _perlin_noise_2d((size_hr, size_hr), scale=6.0, octaves=3, seed=seed + 30)
        threshold = 1.0 - (region["shadow_pct"] / 100.0)
        shadow_mask = shadow_noise > threshold
        # Shadows in crater bowls
        for c in craters:
            y, x = np.ogrid[:size_hr, :size_hr]
            dist = np.sqrt((x - c["x"]) ** 2 + (y - c["y"]) ** 2)
            shadow_mask[dist < c["radius_m"] * 0.7] = True

    # Clamp DEM
    dem = np.clip(dem, 0, 50)

    # Generate TMC image (5m resolution, 100x100)
    tmc_float = cv2.resize(dem, (size_tmc, size_tmc), interpolation=cv2.INTER_AREA)
    # Add noise and normalize to 0-255
    rng = np.random.RandomState(seed + 50)
    tmc_float = (tmc_float - tmc_float.min()) / (tmc_float.max() - tmc_float.min() + 1e-8)
    tmc_float = tmc_float * 200 + 20  # Range ~20-220
    tmc_float += rng.normal(0, 3, tmc_float.shape)
    # Darken shadow areas
    shadow_tmc = cv2.resize(shadow_mask.astype(np.float32), (size_tmc, size_tmc), interpolation=cv2.INTER_NEAREST)
    tmc_float[shadow_tmc > 0.5] *= 0.15
    tmc_img = np.clip(tmc_float, 0, 255).astype(np.uint8)

    # Generate OHRC image (0.25m resolution, 2000x2000)
    size_ohrc = size_tmc * 20  # 20x TMC resolution ratio
    ohrc_float = cv2.resize(dem, (size_ohrc, size_ohrc), interpolation=cv2.INTER_CUBIC)
    ohrc_float = (ohrc_float - ohrc_float.min()) / (ohrc_float.max() - ohrc_float.min() + 1e-8)
    ohrc_float = ohrc_float * 210 + 15
    # Add fine detail noise for high-res
    ohrc_float += rng.normal(0, 2, ohrc_float.shape)
    shadow_ohrc = cv2.resize(shadow_mask.astype(np.float32), (size_ohrc, size_ohrc), interpolation=cv2.INTER_NEAREST)
    ohrc_float[shadow_ohrc > 0.5] *= 0.12
    ohrc_img = np.clip(ohrc_float, 0, 255).astype(np.uint8)

    # Convert DEM to 16-bit
    dem_norm = (dem - dem.min()) / (dem.max() - dem.min() + 1e-8)
    dem_16 = (dem_norm * 65535).astype(np.uint16)

    metadata = {
        "region_id": region["id"],
        "region_name": region["name"],
        "terrain_type": region["terrain_type"],
        "center_lat": region["center_lat"],
        "center_lon": region["center_lon"],
        "tmc_resolution_m": 5.0,
        "ohrc_resolution_m": 0.25,
        "target_resolution_m": 1.0,
        "tmc_size_px": [size_tmc, size_tmc],
        "ohrc_size_px": [size_ohrc, size_ohrc],
        "dem_size_px": [size_hr, size_hr],
        "area_m": size_tmc * 5,
        "elevation_range_m": [float(dem.min()), float(dem.max())],
        "craters": craters,
        "boulders": boulders,
        "shadow_pct": region["shadow_pct"],
        "seed": seed
    }

    return {
        "tmc_img": tmc_img,
        "dem_16": dem_16,
        "ohrc_img": ohrc_img,
        "metadata": metadata,
        "shadow_mask": shadow_mask
    }


def save_region_data(region_id: str, data: Dict):
    """Saves generated region data to disk."""
    region_dir = os.path.join(REGIONS_DATA_DIR, region_id)
    os.makedirs(region_dir, exist_ok=True)

    cv2.imwrite(os.path.join(region_dir, "tmc_tile.png"), data["tmc_img"])
    cv2.imwrite(os.path.join(region_dir, "dem_tile.png"), data["dem_16"])
    cv2.imwrite(os.path.join(region_dir, "ohrc_tile.png"), data["ohrc_img"])

    with open(os.path.join(region_dir, "metadata.json"), "w") as f:
        json.dump(data["metadata"], f, indent=2)
