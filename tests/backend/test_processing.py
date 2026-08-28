import numpy as np
import pytest

from backend.app.processing.terrain import calculate_slope_horn, calculate_roughness
from backend.app.processing.hazards import calculate_slope_risk, fuse_hazards
from backend.app.processing.landing import evaluate_landing_zone
from backend.app.processing.navigation import plan_route

def test_slope_horn_flat():
    """Assert Horn's slope of a flat elevation grid is exactly 0 degrees."""
    dem = np.ones((10, 10), dtype=np.float32) * 22.0
    slope = calculate_slope_horn(dem, resolution_m=1.0)
    assert np.allclose(slope, 0.0)

def test_slope_horn_gradient():
    """Assert Horn's slope calculation for a uniform 45-degree slope."""
    # A 45-degree slope rises 1m for every 1m run.
    # Elevation rises along x axis: z = x
    x = np.arange(10)
    _, dem = np.meshgrid(x, x)
    slope = calculate_slope_horn(dem.astype(np.float32), resolution_m=1.0)
    
    # Horn's method estimates inner pixels correctly
    inner_slope = slope[2:-2, 2:-2]
    # For z = x, dz/dx = 1, dz/dy = 0. slope = arctan(1) = 45 degrees
    assert np.allclose(inner_slope, 45.0, atol=1e-1)

def test_roughness_flat():
    """Assert moving standard deviation roughness of flat grid is 0."""
    dem = np.ones((10, 10), dtype=np.float32) * 15.0
    rough = calculate_roughness(dem, window_size=3)
    # Inner pixels should be zero
    assert np.allclose(rough[1:-1, 1:-1], 0.0)

def test_slope_risk_mapping():
    """Assert slope angle mapped correctly to [0, 1] risk spectrum."""
    # 0 deg slope -> 0.0 risk
    assert calculate_slope_risk(np.array([0.0]))[0] == 0.0
    # 10 deg slope -> 0.2 risk (threshold boundary)
    assert np.allclose(calculate_slope_risk(np.array([10.0]))[0], 0.2)
    # 15 deg slope -> 1.0 extreme risk
    assert np.allclose(calculate_slope_risk(np.array([15.0]))[0], 1.0)

def test_hazard_fuser_obstruction():
    """Assert fuser correctly overrides extreme risks (slope > 15 deg) to 1.0."""
    shape = (5, 5)
    # All layers safe except slope which is extreme (risk 1.0) at cell (2, 2)
    slope_risk = np.zeros(shape)
    slope_risk[2, 2] = 1.0 # extreme slope
    
    slope_layer = {"risk": slope_risk, "conf": np.ones(shape), "status": "DERIVED"}
    crater_layer = {"risk": np.zeros(shape), "conf": np.ones(shape), "status": "ESTIMATED"}
    boulder_layer = {"risk": np.zeros(shape), "conf": np.ones(shape), "status": "DERIVED"}
    shadow_layer = {"risk": np.zeros(shape), "conf": np.ones(shape), "status": "ESTIMATED"}
    roughness_layer = {"risk": np.zeros(shape), "conf": np.ones(shape), "status": "DERIVED"}
    relief_layer = {"risk": np.zeros(shape), "conf": np.ones(shape), "status": "DERIVED"}
    
    weights = {"slope": 0.3, "crater": 0.2, "boulder": 0.15, "shadow": 0.1, "roughness": 0.15, "elevation": 0.1}
    no_data_mask = np.ones(shape, dtype=bool)
    
    fused_risk, _, _ = fuse_hazards(
        slope_layer, crater_layer, boulder_layer, shadow_layer, roughness_layer, relief_layer,
        weights, no_data_mask
    )
    
    # Assert fuser overrides (2, 2) to 1.0 EXTREME
    assert fused_risk[2, 2] == 1.0

def test_landing_footprint_rejection():
    """Assert candidate selector rejects landing centers overlapping craters."""
    # Footprint size = 5 (representing 5m / 5px)
    shape = (20, 20)
    fused_hazard = np.zeros(shape, dtype=np.float32)
    fused_conf = np.ones(shape, dtype=np.float32)
    uncertainty = np.zeros(shape, dtype=np.float32)
    slope = np.zeros(shape, dtype=np.float32)
    shadow = np.zeros(shape, dtype=np.float32)
    roughness = np.zeros(shape, dtype=np.float32)
    
    # Crater centered at (10, 10) with radius 3m
    craters = [{"x": 10.0, "y": 10.0, "radius_m": 3.0, "confidence": 0.95}]
    boulders = []
    
    # Evaluate landing zone directly at (10, 10)
    res = evaluate_landing_zone(
        center_y=10, center_x=10, fused_hazard=fused_hazard, fused_conf=fused_conf,
        uncertainty=uncertainty, slope=slope, shadow=shadow, roughness=roughness,
        craters=craters, boulders=boulders, footprint_px=5, buffer_px=1,
        max_slope=10.0, max_shadow_pct=5.0, max_rough=0.4, max_haz=0.4
    )
    
    # Must be classified UNSAFE due to crater overlap
    assert res["decision"] == "UNSAFE"
    assert "Crater" in res["reason"]

def test_navigation_astar_path():
    """Assert A* path planning successfully finds an obstacle-free route."""
    shape = (10, 10)
    fused_hazard = np.zeros(shape, dtype=np.float32)
    uncertainty = np.zeros(shape, dtype=np.float32)
    slope = np.zeros(shape, dtype=np.float32)
    roughness = np.zeros(shape, dtype=np.float32)
    shadow = np.zeros(shape, dtype=np.float32)
    no_data_mask = np.ones(shape, dtype=bool)
    
    # Place an extreme hazard wall in column 4 (blocking direct path)
    # except at row 5 (creating a gateway gap)
    fused_hazard[:, 4] = 1.0
    fused_hazard[5, 4] = 0.0 # gateway
    
    config = {
        "navigation": {
            "hazard_penalty": 5.0, "uncertainty_penalty": 5.0, "slope_penalty": 3.0,
            "roughness_penalty": 2.0, "shadow_penalty": 2.0, "unknown_blocked": True, "extreme_blocked": True
        }
    }
    
    # Navigate from column 1 to column 8
    res = plan_route(
        start=(1, 5), goal=(8, 5), fused_hazard=fused_hazard, uncertainty=uncertainty,
        slope=slope, roughness=roughness, shadow=shadow, no_data_mask=no_data_mask,
        config=config, algorithm="astar"
    )
    
    assert res["status"] == "SUCCESS"
    path = res["path"]
    # Path must contain coordinates and pass through the gateway at x=4, y=5
    assert len(path) > 0
    assert (4, 5) in path
