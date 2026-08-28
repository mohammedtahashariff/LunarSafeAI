"""
generate_regions.py
Pre-generates terrain data for all 12 lunar regions.
Run this script once to create data/regions/ tiles.
"""

import sys
import os

# Add project root to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from backend.app.processing.lunar_regions import (
    LUNAR_REGIONS, generate_region_terrain, save_region_data
)


def main():
    print("=" * 60)
    print("  NEXORA - Lunar Region Data Generator")
    print("  Generating terrain tiles for 12 lunar regions...")
    print("=" * 60)

    for i, region in enumerate(LUNAR_REGIONS):
        print(f"\n[{i+1:02d}/{len(LUNAR_REGIONS)}] Generating: {region['name']}")
        print(f"     Type: {region['terrain_type']} | Difficulty: {region['difficulty']}")
        print(f"     Location: {region['center_lat']:.2f}N, {region['center_lon']:.2f}E")

        data = generate_region_terrain(region)
        save_region_data(region["id"], data)

        meta = data["metadata"]
        print(f"     TMC: {meta['tmc_size_px']} px | DEM: {meta['dem_size_px']} px | OHRC: {meta['ohrc_size_px']} px")
        print(f"     Craters: {len(meta['craters'])} | Boulders: {len(meta['boulders'])}")
        print(f"     Elevation: {meta['elevation_range_m'][0]:.1f}m - {meta['elevation_range_m'][1]:.1f}m")
        print(f"     [OK] Saved to data/regions/{region['id']}/")

    print("\n" + "=" * 60)
    print("  All regions generated successfully!")
    print("=" * 60)


if __name__ == "__main__":
    main()
