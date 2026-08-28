"""
generate_regions.py
Pre-generates terrain data for all 12 lunar regions.
"""
import sys
import os

# Add project root and backend to python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../..")))
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

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
        data = generate_region_terrain(region)
        save_region_data(region["id"], data)
        print(f"     [OK] Saved region tile {region['id']}")

    print("\n" + "=" * 60)
    print("  All regions generated successfully!")
    print("=" * 60)

if __name__ == "__main__":
    main()
