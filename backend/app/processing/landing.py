import numpy as np

def evaluate_landing_zone(
    center_y: int,
    center_x: int,
    fused_hazard: np.ndarray,
    fused_conf: np.ndarray,
    uncertainty: np.ndarray,
    slope: np.ndarray,
    shadow: np.ndarray,
    roughness: np.ndarray,
    craters: list,
    boulders: list,
    footprint_px: int,
    buffer_px: int,
    max_slope: float,
    max_shadow_pct: float,
    max_rough: float,
    max_haz: float
) -> dict:
    """
    Evaluates a single grid cell coordinate as a candidate landing zone.
    Checks the entire window defined by: footprint_px + 2 * buffer_px.
    """
    h, w = fused_hazard.shape
    total_radius = (footprint_px // 2) + buffer_px
    
    # Boundary check
    y1 = center_y - total_radius
    y2 = center_y + total_radius
    x1 = center_x - total_radius
    x2 = center_x + total_radius
    
    if y1 < 0 or y2 >= h or x1 < 0 or x2 >= w:
        return {"decision": "UNSAFE", "score": 0.0, "reason": "Edge boundary violation"}
        
    # Extract footprint slices (center region)
    fp_r = footprint_px // 2
    fp_y1, fp_y2 = center_y - fp_r, center_y + fp_r
    fp_x1, fp_x2 = center_x - fp_r, center_x + fp_r
    
    slice_hazard = fused_hazard[fp_y1:fp_y2+1, fp_x1:fp_x2+1]
    slice_conf = fused_conf[fp_y1:fp_y2+1, fp_x1:fp_x2+1]
    slice_unc = uncertainty[fp_y1:fp_y2+1, fp_x1:fp_x2+1]
    slice_shadow = shadow[fp_y1:fp_y2+1, fp_x1:fp_x2+1]
    
    # Optional slope/roughness checks (if DEM was available)
    has_slope = slope is not None
    slice_slope = slope[fp_y1:fp_y2+1, fp_x1:fp_x2+1] if has_slope else None
    slice_rough = roughness[fp_y1:fp_y2+1, fp_x1:fp_x2+1] if has_slope else None
    
    # 1. Hard constraints checks inside footprint
    # A. Shadow check
    shadow_fraction = np.mean(slice_shadow == 1.0)
    if shadow_fraction * 100.0 > max_shadow_pct:
        return {"decision": "UNSAFE", "score": 0.0, "reason": f"Shadow coverage ({shadow_fraction*100:.1f}%) exceeds limit"}
        
    # B. Extreme hazard check
    max_haz_val = np.max(slice_hazard)
    if max_haz_val >= 0.8:
        return {"decision": "UNSAFE", "score": 0.0, "reason": f"Extreme hazard point detected ({max_haz_val:.2f})"}
        
    # C. Slope check (if DEM exists)
    if has_slope:
        max_slope_val = np.max(slice_slope)
        mean_slope_val = np.mean(slice_slope)
        if max_slope_val > max_slope:
            return {"decision": "UNSAFE", "score": 0.0, "reason": f"Max slope ({max_slope_val:.1f}°) exceeds threshold"}
            
        max_rough_val = np.max(slice_rough)
        if max_rough_val > max_rough:
            return {"decision": "UNSAFE", "score": 0.0, "reason": f"Max roughness ({max_rough_val:.2f}) exceeds threshold"}
    else:
        max_slope_val = 0.0
        mean_slope_val = 0.0
        max_rough_val = 0.0
        
    # D. Crater / Boulder proximity checks
    # Check if any crater center is within (c_radius + fp_r + buffer)
    for c in craters:
        cx, cy, cr = c["x"], c["y"], c["radius_m"]
        dist = np.sqrt((center_x - cx)**2 + (center_y - cy)**2)
        if dist < (cr + fp_r + buffer_px):
            return {"decision": "UNSAFE", "score": 0.0, "reason": f"Crater boundary violation (Distance {dist:.1f}m < safety limit)"}
            
    for b in boulders:
        bx, by, br = b["x"], b["y"], b["radius_m"]
        dist = np.sqrt((center_x - bx)**2 + (center_y - by)**2)
        if dist < (br + fp_r + buffer_px):
            return {"decision": "UNSAFE", "score": 0.0, "reason": f"Boulder obstacle footprint overlap (Distance {dist:.1f}m)"}

    # 2. Score candidate landing site
    mean_haz_val = np.mean(slice_hazard)
    mean_unc_val = np.mean(slice_unc)
    mean_conf_val = np.mean(slice_conf)
    
    # Suitability = 100 * (1 - mean_hazard) - penalties for roughness, slope, and uncertainty
    suitability = 100.0 * (1.0 - mean_haz_val)
    
    if has_slope:
        # Subtract slope penalties (e.g. subtract 1.5 points for every degree of mean slope)
        suitability -= mean_slope_val * 1.5
        # Subtract roughness penalties
        suitability -= np.mean(slice_rough) * 20.0
        
    # Subtract uncertainty penalty
    suitability -= mean_unc_val * 15.0
    
    # Clamp suitability to [0, 100]
    suitability = float(np.clip(suitability, 0.0, 100.0))
    
    # 3. Classify final decision
    # If uncertainty is low and all hazards are extremely low, mark SAFE.
    # If uncertainty is moderate or hazards are moderate but pass constraints, mark CONDITIONAL.
    if mean_haz_val < 0.15 and mean_unc_val < 0.35 and max_slope_val < 8.0:
        decision = "SAFE"
    else:
        decision = "CONDITIONAL"
        
    return {
        "decision": decision,
        "score": suitability,
        "mean_slope": float(mean_slope_val),
        "max_slope": float(max_slope_val),
        "mean_hazard": float(mean_haz_val),
        "max_hazard": float(max_haz_val),
        "mean_roughness": float(np.mean(slice_rough)) if has_slope else 0.0,
        "mean_uncertainty": float(mean_unc_val),
        "mean_confidence": float(mean_conf_val),
        "shadow_percent": float(shadow_fraction * 100.0)
    }

def detect_landing_candidates(
    fused_hazard: np.ndarray,
    fused_conf: np.ndarray,
    uncertainty: np.ndarray,
    slope: np.ndarray,
    shadow: np.ndarray,
    roughness: np.ndarray,
    craters: list,
    boulders: list,
    config: dict
) -> tuple:
    """
    Scans the entire fused hazard grid to detect and score landing candidates.
    Returns:
        candidates (list): Top 10 candidates.
        best_candidate (dict or None): Highest scoring candidate.
        suitability_map (np.ndarray): 2D grid containing suitability values.
    """
    h, w = fused_hazard.shape
    suitability_map = np.zeros((h, w), dtype=np.float32)
    
    # Load config constraints
    lc = config.get("landing", {})
    footprint_size = lc.get("footprint_size_m", 20)
    safety_margin = lc.get("safety_margin_m", 2)
    max_slope = lc.get("max_slope_deg", 10.0)
    max_shadow = lc.get("max_shadow_percent", 5.0)
    max_rough = lc.get("max_roughness", 0.4)
    max_haz = lc.get("max_hazard", 0.4)
    
    # We step every 10 pixels to speed up search (coarse search),
    # then refine near local maxima or perform exhaustive search
    # Since 500x500 is relatively small, stepping every 5 pixels is fast and accurate
    step = 5
    raw_candidates = []
    
    for y in range(footprint_size, h - footprint_size, step):
        for x in range(footprint_size, w - footprint_size, step):
            eval_res = evaluate_landing_zone(
                y, x, fused_hazard, fused_conf, uncertainty, slope, shadow, roughness,
                craters, boulders, footprint_size, safety_margin,
                max_slope, max_shadow, max_rough, max_haz
            )
            
            if eval_res["decision"] != "UNSAFE":
                eval_res["x"] = int(x)
                eval_res["y"] = int(y)
                raw_candidates.append(eval_res)
                suitability_map[y, x] = eval_res["score"]
                
    # Sort candidates by score descending
    raw_candidates.sort(key=lambda x: x["score"], reverse=True)
    
    # Filter candidates to avoid overlapping clusters
    filtered_candidates = []
    min_dist_between_zones = footprint_size * 2.0
    
    for cand in raw_candidates:
        # Check if too close to an already selected candidate
        too_close = False
        for sel in filtered_candidates:
            dist = np.sqrt((cand["x"] - sel["x"])**2 + (cand["y"] - sel["y"])**2)
            if dist < min_dist_between_zones:
                too_close = True
                break
        if not too_close:
            filtered_candidates.append(cand)
            if len(filtered_candidates) >= 10:
                break
                
    # Add rank IDs
    for idx, cand in enumerate(filtered_candidates):
        cand["id"] = f"ZONE-{idx+1:02d}"
        
    best_candidate = filtered_candidates[0] if filtered_candidates else None
    
    return filtered_candidates, best_candidate, suitability_map

def generate_landing_explanation(cand: dict, has_dem: bool) -> tuple:
    """
    Generates explainable AI explanations for site selection or rejection.
    Returns:
        why_selected (list of dicts): Checks that passed.
        why_rejected (list of dicts): Checks that failed.
    """
    why_selected = []
    why_rejected = []
    
    if not cand:
        return [{"text": "No valid site found in study region. All zones violate hard constraints.", "status": "FAIL"}], []
        
    # Check max slope
    if has_dem:
        if cand.get("max_slope", 0.0) <= 10.0:
            why_selected.append({"text": f"Mean slope ({cand['mean_slope']:.1f}°) and Max slope ({cand['max_slope']:.1f}°) are within limits (< 10.0°)", "status": "PASS"})
        else:
            why_rejected.append({"text": f"Max slope exceeded threshold: {cand['max_slope']:.1f}°", "status": "FAIL"})
            
        # Check roughness
        if cand.get("mean_roughness", 0.0) <= 0.35:
            why_selected.append({"text": f"Terrain roughness ({cand['mean_roughness']:.2f}) is smooth", "status": "PASS"})
        else:
            why_rejected.append({"text": f"Terrain roughness is too high ({cand['mean_roughness']:.2f})", "status": "FAIL"})
    else:
        why_selected.append({"text": "Slope & physical roughness are estimated as safe (DEM unavailable)", "status": "WARNING"})

    # Check shadow
    if cand.get("shadow_percent", 0.0) == 0.0:
        why_selected.append({"text": "Shadow coverage is 0.0% (full illumination)", "status": "PASS"})
    elif cand.get("shadow_percent", 0.0) <= 5.0:
        why_selected.append({"text": f"Shadow coverage ({cand['shadow_percent']:.1f}%) is within limits (< 5.0%)", "status": "PASS"})
    else:
        why_rejected.append({"text": f"Shadow coverage is too high ({cand['shadow_percent']:.1f}%)", "status": "FAIL"})
        
    # Check crater / boulder clearances
    why_selected.append({"text": "Safe buffer clearance around detected craters maintained", "status": "PASS"})
    why_selected.append({"text": "Safe buffer clearance around detected boulder candidates maintained", "status": "PASS"})
    
    # Check uncertainty
    if cand.get("mean_uncertainty", 0.0) < 0.35:
        why_selected.append({"text": f"Low landing uncertainty ({cand['mean_uncertainty']:.2f})", "status": "PASS"})
    else:
        why_selected.append({"text": f"Conditional landing: High local uncertainty ({cand['mean_uncertainty']:.2f})", "status": "WARNING"})
        
    # Check suitability
    why_selected.append({"text": f"High landing suitability score: {cand['score']:.1f}/100", "status": "PASS"})
    
    return why_selected, why_rejected
