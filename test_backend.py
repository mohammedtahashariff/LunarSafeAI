"""
test_backend.py
Tests backend region list API, region details, and region analysis execution.
"""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "."))

from backend.app.processing.lunar_regions import get_region_list, get_region_by_id
from backend.app.processing.tmc_ohrc_intersection import generate_region_coverage
from backend.app.services.jobs import BackgroundJobExecutor

def test():
    print("Testing region listing...")
    regions = get_region_list()
    print(f"Loaded {len(regions)} regions.")
    assert len(regions) == 12, f"Expected 12 regions, got {len(regions)}"

    print("\nTesting region details for Shiv Shakti Point...")
    r = get_region_by_id("shiv-shakti")
    assert r is not None
    coverage = generate_region_coverage(r)
    print(f"Coverage: TMC={coverage['tmc_scene']['scene_id']} vs OHRC={coverage['ohrc_scene']['scene_id']}")
    print(f"Overlap: TMC {coverage['tmc_overlap_pct']}% | OHRC {coverage['ohrc_overlap_pct']}%")

    print("\nTesting region pipeline execution for 'shiv-shakti'...")
    payload = {
        "mode": "region",
        "region_id": "shiv-shakti",
        "sr_model": "lunarsr",
        "config": {
            "resolution": {"tmc": 5.0, "target_grid": 1.0, "ohrc": 0.25},
            "hazards": {"slope_weight": 0.30, "crater_weight": 0.20, "boulder_weight": 0.15, "shadow_weight": 0.10, "roughness_weight": 0.15, "elevation_weight": 0.10}
        },
        "start_point": [50, 450]
    }
    job_id = BackgroundJobExecutor.create_job(payload)
    print(f"Created job {job_id}. Running pipeline synchronously...")
    BackgroundJobExecutor._execute_pipeline(job_id)

    job = BackgroundJobExecutor.get_job(job_id)
    print(f"Job Status: {job['status']}")
    assert job['status'] == 'COMPLETED', f"Job failed: {job.get('error_message')}"

    res = job['results']
    print(f"Analysis complete!")
    print(f"Detected Craters: {res['hazard_stats']['detected_craters']}")
    print(f"Detected Boulders: {res['hazard_stats']['detected_boulders']}")
    print(f"Best Candidate: {res['best_candidate']['id'] if res['best_candidate'] else 'None'} Score: {res['best_candidate']['score'] if res['best_candidate'] else 'N/A'}")
    print(f"Hazard Map PNG: {res['files']['hazard_map_png']}")
    print(f"Report HTML: {res['files']['report_html']}")
    print("\n[OK] ALL BACKEND TESTS PASSED!")

if __name__ == '__main__':
    test()
