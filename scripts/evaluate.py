import os
import json
import time
import numpy as np
import cv2
from backend.app.processing.preprocessing import radiometric_normalization, denoise_image, align_and_resample
from backend.app.processing.super_resolution import super_resolve_image
from backend.app.processing.terrain import process_dem_terrain
from backend.app.processing.hazards import (
    detect_shadows, detect_craters_ml, detect_boulders_dem,
    generate_crater_hazard_map, generate_boulder_hazard_map, calculate_slope_risk, fuse_hazards
)
from backend.app.processing.uncertainty import calculate_uncertainty_map
from backend.app.processing.landing import detect_landing_candidates
from backend.app.processing.navigation import plan_route

def run_evaluation():
    print("====================================================")
    # Scientific Header
    print("LunarSafe AI — Comparative Scientific Evaluation")
    print("====================================================")
    
    # Load files
    tmc_path = "data/demo/synthetic_tmc.png"
    dem_path = "data/demo/synthetic_dem.png"
    ohrc_path = "data/demo/synthetic_ohrc.png"
    dem_meta_path = "data/demo/synthetic_dem_metadata.json"
    
    if not os.path.exists(tmc_path):
        print("Demo data not found. Please run 'python scripts/generate_demo_data.py' first.")
        return
        
    tmc_img = cv2.imread(tmc_path, cv2.IMREAD_GRAYSCALE)
    dem_16 = cv2.imread(dem_path, cv2.IMREAD_UNCHANGED)
    ohrc_img = cv2.imread(ohrc_path, cv2.IMREAD_GRAYSCALE)
    
    with open(dem_meta_path, "r") as f:
        dem_meta = json.load(f)
        
    dem_scaled = dem_16.astype(np.float32) / 65535.0 * 50.0
    
    # Preprocess
    tmc_norm = radiometric_normalization(tmc_img)
    tmc_denoised = denoise_image(tmc_norm)
    no_data_mask_lr = np.ones_like(tmc_denoised, dtype=bool)
    
    # Preprocess reference OHRC
    ref_norm = radiometric_normalization(ohrc_img)
    ohrc_meta = {"resolution_m": 0.25}
    tmc_meta = {"resolution_m": 5.0}
    ref_resampled = align_and_resample(tmc_img, ref_norm, tmc_meta, ohrc_meta)
    
    # Standard settings
    config = {
        "landing": {"footprint_size_m": 20, "safety_margin_m": 2, "max_slope_deg": 10.0, "max_shadow_percent": 5.0, "max_roughness": 0.4, "max_hazard": 0.4},
        "hazards": {"slope_weight": 0.3, "crater_weight": 0.2, "boulder_weight": 0.15, "shadow_weight": 0.1, "roughness_weight": 0.15, "elevation_weight": 0.10},
        "navigation": {"algorithm": "astar", "hazard_penalty": 5.0, "uncertainty_penalty": 5.0, "slope_penalty": 3.0, "roughness_penalty": 2.0, "shadow_penalty": 2.0, "unknown_blocked": True, "extreme_blocked": True}
    }
    
    models = ["bicubic", "edsr", "swinir", "lunarsr"]
    results = {}
    
    for model_name in models:
        print(f"Evaluating upscaling model: {model_name.upper()}...")
        
        # Super resolve
        sr_img, sr_conf, sr_unc, sr_time = super_resolve_image(tmc_denoised, model_name=model_name)
        
        # Calculate image metrics (PSNR)
        mse = np.mean((sr_img - ref_resampled) ** 2)
        psnr = 10 * np.log10(1.0 / (mse + 1e-10))
        
        # Terrain analysis (Horn's slope)
        terrain = process_dem_terrain(dem_scaled, has_dem=True, resolution_m=1.0)
        
        # Shadow, craters, boulders
        shadow_risk, shadow_conf = detect_shadows(sr_img)
        craters = detect_craters_ml(sr_img, synthetic_craters=dem_meta["craters"])
        crater_risk, crater_conf = generate_crater_hazard_map(sr_img.shape, craters)
        boulders = detect_boulders_dem(dem_scaled)
        boulder_risk, boulder_conf = generate_boulder_hazard_map(sr_img.shape, boulders)
        
        # Normalised risks
        slope_risk = calculate_slope_risk(terrain["slope"])
        slope_conf = np.ones_like(slope_risk) * 0.95
        rough_risk = np.clip(terrain["roughness"] / 0.5, 0.0, 1.0)
        rough_conf = np.ones_like(rough_risk) * 0.95
        relief_risk = np.clip(terrain["local_relief"] / 1.5, 0.0, 1.0)
        relief_conf = np.ones_like(relief_risk) * 0.95
        
        slope_layer = {"risk": slope_risk, "conf": slope_conf, "status": "DERIVED"}
        crater_layer = {"risk": crater_risk, "conf": crater_conf, "status": "ESTIMATED"}
        boulder_layer = {"risk": boulder_risk, "conf": boulder_conf, "status": "DERIVED"}
        shadow_layer = {"risk": shadow_risk, "conf": shadow_conf, "status": "ESTIMATED"}
        roughness_layer = {"risk": rough_risk, "conf": rough_conf, "status": "DERIVED"}
        relief_layer = {"risk": relief_risk, "conf": relief_conf, "status": "DERIVED"}
        
        no_data_mask = np.ones_like(sr_img, dtype=bool)
        
        fused_risk, fused_conf, fused_class = fuse_hazards(
            slope_layer, crater_layer, boulder_layer, shadow_layer, roughness_layer, relief_layer,
            config["hazards"], no_data_mask
        )
        
        # Uncertainty
        unc_map, unc_class = calculate_uncertainty_map(sr_unc, sr_img, shadow_risk, has_dem=True, no_data_mask=no_data_mask)
        
        # False-Safe Rate
        dangerous_gt = (terrain["slope"] > 10.0) | (boulder_risk > 0.0) | (crater_risk > 0.0)
        predicted_safe = fused_risk < 0.20
        false_safe_mask = dangerous_gt & predicted_safe
        false_safe_rate = np.sum(false_safe_mask) / max(1, np.sum(dangerous_gt))
        
        # Landing selection
        candidates, best_cand, _ = detect_landing_candidates(
            fused_risk, fused_conf, unc_map, terrain["slope"], shadow_risk, terrain["roughness"],
            craters, boulders, config
        )
        
        # Route
        if best_cand:
            start_pt = (50, 450)
            goal_pt = (best_cand["x"], best_cand["y"])
            nav_res = plan_route(
                start_pt, goal_pt, fused_risk, unc_map, terrain["slope"], terrain["roughness"],
                shadow_risk, no_data_mask, config, algorithm="astar"
            )
            path_cost = nav_res.get("metrics", {}).get("total_cost", 999.0)
        else:
            path_cost = 999.0
            
        results[model_name] = {
            "psnr": float(psnr),
            "false_safe_rate_pct": float(false_safe_rate * 100.0),
            "candidates_found": len(candidates),
            "best_suitability": float(best_cand["score"]) if best_cand else 0.0,
            "path_cost": float(path_cost),
            "inference_time_ms": float(sr_time * 1000.0)
        }

    print("\n====================================================")
    print("EVALUATION MATRIX SUMMARY")
    print("====================================================")
    print(f"{'MODEL':<12} | {'PSNR (dB)':<10} | {'FALSE-SAFE (%)':<15} | {'BEST SITE SUIT.':<16} | {'PATH COST':<10}")
    print("-" * 65)
    for model_name, res in results.items():
        print(f"{model_name.upper():<12} | {res['psnr']:<10.2f} | {res['false_safe_rate_pct']:<15.2f} | {res['best_suitability']:<16.2f} | {res['path_cost']:<10.2f}")
    print("====================================================")

if __name__ == "__main__":
    run_evaluation()
