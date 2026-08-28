"""
tmc_ohrc_intersection.py
Adapted from: Check_for_Intersection.ipynb (components/)
Finds overlapping TMC-2 + OHRC scenes for super-resolution training.
"""

import numpy as np
from typing import List, Dict, Tuple, Optional


def compute_bbox_intersection(
    bbox_a: Dict[str, float],
    bbox_b: Dict[str, float]
) -> Optional[Dict[str, float]]:
    """
    Computes the intersection of two axis-aligned bounding boxes.
    Each bbox: {"min_lat", "max_lat", "min_lon", "max_lon"}
    Returns intersection bbox or None if no overlap.
    """
    min_lat = max(bbox_a["min_lat"], bbox_b["min_lat"])
    max_lat = min(bbox_a["max_lat"], bbox_b["max_lat"])
    min_lon = max(bbox_a["min_lon"], bbox_b["min_lon"])
    max_lon = min(bbox_a["max_lon"], bbox_b["max_lon"])

    if min_lat >= max_lat or min_lon >= max_lon:
        return None

    return {
        "min_lat": min_lat,
        "max_lat": max_lat,
        "min_lon": min_lon,
        "max_lon": max_lon
    }


def compute_overlap_percentage(
    bbox_a: Dict[str, float],
    intersection: Dict[str, float]
) -> float:
    """
    Computes the percentage of bbox_a covered by the intersection.
    """
    area_a = (bbox_a["max_lat"] - bbox_a["min_lat"]) * (bbox_a["max_lon"] - bbox_a["min_lon"])
    if area_a <= 0:
        return 0.0
    area_inter = (intersection["max_lat"] - intersection["min_lat"]) * (intersection["max_lon"] - intersection["min_lon"])
    return (area_inter / area_a) * 100.0


def find_overlapping_scenes(
    tmc_scenes: List[Dict],
    ohrc_scenes: List[Dict]
) -> List[Dict]:
    """
    Finds all overlapping TMC-2 + OHRC scene pairs.

    Each scene dict has: {
        "scene_id": str,
        "bbox": {"min_lat", "max_lat", "min_lon", "max_lon"},
        "resolution_m": float,
        ...
    }

    Returns list of intersection records with metadata.
    Adapted from Check_for_Intersection.ipynb logic.
    """
    overlaps = []

    for tmc in tmc_scenes:
        for ohrc in ohrc_scenes:
            intersection = compute_bbox_intersection(tmc["bbox"], ohrc["bbox"])
            if intersection is not None:
                tmc_overlap_pct = compute_overlap_percentage(tmc["bbox"], intersection)
                ohrc_overlap_pct = compute_overlap_percentage(ohrc["bbox"], intersection)

                # Compute intersection area in km² (approximate at lunar surface)
                # 1 degree latitude ≈ 30.3 km on Moon
                # 1 degree longitude ≈ 30.3 * cos(lat) km on Moon
                center_lat = (intersection["min_lat"] + intersection["max_lat"]) / 2.0
                km_per_deg_lat = 30.3
                km_per_deg_lon = 30.3 * np.cos(np.radians(center_lat))

                width_km = (intersection["max_lon"] - intersection["min_lon"]) * km_per_deg_lon
                height_km = (intersection["max_lat"] - intersection["min_lat"]) * km_per_deg_lat
                area_km2 = width_km * height_km

                overlaps.append({
                    "tmc_scene_id": tmc["scene_id"],
                    "ohrc_scene_id": ohrc["scene_id"],
                    "intersection_bbox": intersection,
                    "tmc_overlap_pct": round(tmc_overlap_pct, 1),
                    "ohrc_overlap_pct": round(ohrc_overlap_pct, 1),
                    "intersection_area_km2": round(area_km2, 3),
                    "tmc_resolution_m": tmc.get("resolution_m", 5.0),
                    "ohrc_resolution_m": ohrc.get("resolution_m", 0.25),
                    "scale_factor": tmc.get("resolution_m", 5.0) / ohrc.get("resolution_m", 0.25)
                })

    # Sort by intersection area (largest first)
    overlaps.sort(key=lambda x: x["intersection_area_km2"], reverse=True)
    return overlaps


def generate_region_coverage(region: Dict) -> Dict:
    """
    Generates TMC-2 and OHRC coverage metadata for a pre-defined lunar region.
    Simulates the intersection detection that would occur with real data.

    Returns coverage info including scene IDs, bounding boxes, and overlap stats.
    """
    lat = region["center_lat"]
    lon = region["center_lon"]
    size = region.get("size_deg", 0.5)

    # Simulate TMC-2 coverage (wider, lower resolution)
    tmc_bbox = {
        "min_lat": lat - size * 1.2,
        "max_lat": lat + size * 1.2,
        "min_lon": lon - size * 1.2,
        "max_lon": lon + size * 1.2
    }

    # Simulate OHRC coverage (narrower strip, higher resolution)
    ohrc_bbox = {
        "min_lat": lat - size * 0.6,
        "max_lat": lat + size * 0.6,
        "min_lon": lon - size * 0.3,
        "max_lon": lon + size * 0.3
    }

    intersection = compute_bbox_intersection(tmc_bbox, ohrc_bbox)
    tmc_overlap_pct = compute_overlap_percentage(tmc_bbox, intersection) if intersection else 0.0
    ohrc_overlap_pct = compute_overlap_percentage(ohrc_bbox, intersection) if intersection else 0.0

    return {
        "region_id": region["id"],
        "tmc_scene": {
            "scene_id": f"TMC2_{region['id'].upper().replace('-', '_')}",
            "bbox": tmc_bbox,
            "resolution_m": 5.0,
            "image_size_px": [100, 100],
            "coverage_area_km2": round(
                (tmc_bbox["max_lat"] - tmc_bbox["min_lat"]) * 30.3 *
                (tmc_bbox["max_lon"] - tmc_bbox["min_lon"]) * 30.3 * np.cos(np.radians(lat)),
                2
            )
        },
        "ohrc_scene": {
            "scene_id": f"OHRC_{region['id'].upper().replace('-', '_')}",
            "bbox": ohrc_bbox,
            "resolution_m": 0.25,
            "image_size_px": [2000, 2000],
            "coverage_area_km2": round(
                (ohrc_bbox["max_lat"] - ohrc_bbox["min_lat"]) * 30.3 *
                (ohrc_bbox["max_lon"] - ohrc_bbox["min_lon"]) * 30.3 * np.cos(np.radians(lat)),
                2
            )
        },
        "intersection": intersection,
        "tmc_overlap_pct": round(tmc_overlap_pct, 1),
        "ohrc_overlap_pct": round(ohrc_overlap_pct, 1),
        "scale_factor": 20  # TMC 5m / OHRC 0.25m = 20x
    }
