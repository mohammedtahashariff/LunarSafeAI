import numpy as np
import cv2
from scipy.ndimage import maximum_filter

def detect_shadows(sr_img: np.ndarray, threshold: float = 0.15) -> tuple:
    """
    Detects shadowed regions using intensity thresholding.
    Returns:
        shadow_risk (np.ndarray): Binary hazard layer (1.0 for shadow, 0.0 otherwise).
        shadow_conf (np.ndarray): Confidence map [0, 1].
    """
    if sr_img.size == 0:
        return sr_img, sr_img
        
    # Low intensity values are marked as shadows
    shadow_mask = sr_img < threshold
    shadow_risk = shadow_mask.astype(np.float32)
    
    # Confidence is high inside clear shadows and clear sunlit areas, lower at boundary
    dist_to_edge = cv2.distanceTransform((shadow_mask.astype(np.uint8) * 255), cv2.DIST_L2, 3)
    dist_to_sun = cv2.distanceTransform(((~shadow_mask).astype(np.uint8) * 255), cv2.DIST_L2, 3)
    boundary = np.maximum(dist_to_edge, dist_to_sun)
    
    shadow_conf = np.clip(0.6 + 0.4 * (boundary / (boundary.max() + 1e-5)), 0.0, 1.0)
    return shadow_risk, shadow_conf

def detect_craters_classical(sr_img: np.ndarray) -> list:
    """
    Detects craters using classical computer vision: Sobel edges + Hough Circle Transform.
    """
    craters = []
    if sr_img.size == 0:
        return craters
        
    # Preprocess image for Hough Circles (uint8, smoothed)
    img_uint8 = (sr_img * 255.0).astype(np.uint8)
    blurred = cv2.GaussianBlur(img_uint8, (9, 9), 2)
    
    # Run Hough Circles
    # param1: upper threshold for Canny, param2: accumulator threshold for circle centers
    circles = cv2.HoughCircles(
        blurred, cv2.HOUGH_GRADIENT, dp=1.2, minDist=30,
        param1=50, param2=25, minRadius=8, maxRadius=100
    )
    
    if circles is not None:
        circles = np.round(circles[0, :]).astype(int)
        for (x, y, r) in circles:
            craters.append({
                "x": float(x),
                "y": float(y),
                "radius_m": float(r),
                "confidence": 0.75,
                "risk": 0.85
            })
    return craters

def detect_craters_ml(sr_img: np.ndarray, synthetic_craters: list = None) -> list:
    """
    Detects craters using an ML/YOLO-like segmentation wrapper.
    If in Demo mode (synthetic_craters is provided), retrieves ground-truth with high confidence.
    """
    if synthetic_craters is not None:
        # Map simulated coordinates directly for precision
        craters = []
        for c in synthetic_craters:
            craters.append({
                "x": c["x"],
                "y": c["y"],
                "radius_m": c["radius_m"],
                "confidence": 0.94,
                "risk": 0.95
            })
        return craters
        
    # Mock ML detector fallback (finds local circular segments)
    return detect_craters_classical(sr_img)

def detect_boulders_dem(dem: np.ndarray, resolution_m: float = 1.0) -> list:
    """
    Mode 1: Boulder detection when DEM is available.
    Detects local elevation peaks standing out from local surrounding mean.
    """
    boulders = []
    if dem.size == 0:
        return boulders
        
    # High-pass filter DEM (subtract local mean from DEM)
    local_mean = cv2.boxFilter(dem.astype(np.float32), -1, (7, 7))
    high_pass = dem - local_mean
    
    # Find local peaks: pixel is max in a 5x5 window and high-pass height > 0.8 meters
    local_max = maximum_filter(dem, size=5)
    peaks_mask = (dem == local_max) & (high_pass > 0.8)
    
    y_indices, x_indices = np.where(peaks_mask)
    for y, x in zip(y_indices, x_indices):
        height = float(high_pass[y, x])
        # Estimate radius based on high-pass threshold contour
        radius = float(np.sqrt(height) * 1.5)
        boulders.append({
            "x": float(x),
            "y": float(y),
            "radius_m": radius,
            "height_m": height,
            "confidence": 0.90,
            "risk": 0.85,
            "status": "CONFIRMED"
        })
    return boulders

def detect_boulders_image(sr_img: np.ndarray) -> list:
    """
    Mode 2: Boulder detection in image-only mode (No DEM).
    Identifies high-contrast texture anomalies (bright peaks with a dark shadow side).
    """
    boulders = []
    if sr_img.size == 0:
        return boulders
        
    # Convolve with a shadow-directional filter (e.g. Sobel derivative along 45 deg)
    kernel = np.array([[-1, -1, 0], [-1, 0, 1], [0, 1, 1]], dtype=np.float32)
    contrast_img = cv2.filter2D(sr_img, -1, kernel)
    
    # Find local maxima of contrast anomalies
    local_max = maximum_filter(contrast_img, size=5)
    peaks_mask = (contrast_img == local_max) & (contrast_img > 0.25)
    
    y_indices, x_indices = np.where(peaks_mask)
    for y, x in zip(y_indices, x_indices):
        # We don't have elevation, so height is marked unavailable
        boulders.append({
            "x": float(x),
            "y": float(y),
            "radius_m": 2.0,  # Estimated radius
            "height_m": None, # Unavailable
            "confidence": 0.60,
            "risk": 0.70,
            "status": "CANDIDATE"
        })
    return boulders

def generate_crater_hazard_map(shape: tuple, craters: list) -> tuple:
    """
    Paints crater circles on a grid hazard layer.
    Inner bowl has high risk, rim has extreme risk.
    """
    risk = np.zeros(shape, dtype=np.float32)
    conf = np.ones(shape, dtype=np.float32) * 0.90
    
    for c in craters:
        cx, cy, r = c["x"], c["y"], c["radius_m"]
        c_conf = c.get("confidence", 0.80)
        
        # Create mesh grid for crater circles
        y, x = np.ogrid[:shape[0], :shape[1]]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        
        # Bowl risk
        bowl_mask = dist < r
        risk[bowl_mask] = np.maximum(risk[bowl_mask], 0.80)
        conf[bowl_mask] = c_conf
        
        # Rim risk (up to 1.3 * radius)
        rim_mask = (dist >= r) & (dist < 1.3 * r)
        risk[rim_mask] = np.maximum(risk[rim_mask], 1.0)  # Extreme risk
        conf[rim_mask] = c_conf
        
    return risk, conf

def generate_boulder_hazard_map(shape: tuple, boulders: list) -> tuple:
    """
    Paints boulder footprints on a grid hazard layer.
    """
    risk = np.zeros(shape, dtype=np.float32)
    conf = np.ones(shape, dtype=np.float32) * 0.90
    
    for b in boulders:
        cx, cy, r = b["x"], b["y"], b["radius_m"]
        b_conf = b.get("confidence", 0.70)
        
        y, x = np.ogrid[:shape[0], :shape[1]]
        dist = np.sqrt((x - cx)**2 + (y - cy)**2)
        
        # Boulder body
        boulder_mask = dist < r
        risk[boulder_mask] = np.maximum(risk[boulder_mask], 1.0)  # Extreme risk
        conf[boulder_mask] = b_conf
        
    return risk, conf

def calculate_slope_risk(slope_deg: np.ndarray) -> np.ndarray:
    """
    Maps slope angle to normalized hazard risk [0, 1].
    Preferred: 0-10 deg (low risk). Hazard: > 10 deg.
    """
    risk = np.zeros_like(slope_deg)
    
    # 0 to 10 deg: scaled to [0.0, 0.2]
    mask_low = slope_deg < 10.0
    risk[mask_low] = (slope_deg[mask_low] / 10.0) * 0.2
    
    # > 10 deg: scaled to [0.2, 1.0] (clamped at 15 deg)
    mask_high = slope_deg >= 10.0
    risk[mask_high] = 0.2 + ((slope_deg[mask_high] - 10.0) / 5.0) * 0.8
    return np.clip(risk, 0.0, 1.0)

def fuse_hazards(
    slope_layer: dict,
    crater_layer: dict,
    boulder_layer: dict,
    shadow_layer: dict,
    roughness_layer: dict,
    relief_layer: dict,
    weights: dict,
    no_data_mask: np.ndarray = None
) -> tuple:
    """
    Fuses individual hazard layers using a weighted average hazard scoring scheme.
    Enforces hard constraints (slope > 15 deg, boulders, shadows are extreme).
    
    Returns:
        fused_hazard (np.ndarray): Normalized combined hazard score.
        fused_conf (np.ndarray): Fused confidence map.
        fused_class (np.ndarray): Integer array representing classified risk states.
    """
    shape = shadow_layer["risk"].shape
    
    # Initialize components
    r_slope = slope_layer["risk"] if slope_layer["status"] == "DERIVED" else np.zeros(shape)
    r_crater = crater_layer["risk"]
    r_boulder = boulder_layer["risk"]
    r_shadow = shadow_layer["risk"]
    r_rough = roughness_layer["risk"] if roughness_layer["status"] == "DERIVED" else np.zeros(shape)
    r_relief = relief_layer["risk"] if relief_layer["status"] == "DERIVED" else np.zeros(shape)
    
    c_slope = slope_layer["conf"] if slope_layer["status"] == "DERIVED" else np.zeros(shape)
    c_crater = crater_layer["conf"]
    c_boulder = boulder_layer["conf"]
    c_shadow = shadow_layer["conf"]
    c_rough = roughness_layer["conf"] if roughness_layer["status"] == "DERIVED" else np.zeros(shape)
    c_relief = relief_layer["conf"] if relief_layer["status"] == "DERIVED" else np.zeros(shape)
    
    # Normalize weights
    total_w = sum(weights.values())
    w = {k: v / total_w for k, v in weights.items()}
    
    # Weighted average risk
    fused_risk = (
        r_slope * w.get("slope", 0.30) +
        r_crater * w.get("crater", 0.20) +
        r_boulder * w.get("boulder", 0.15) +
        r_shadow * w.get("shadow", 0.10) +
        r_rough * w.get("roughness", 0.15) +
        r_relief * w.get("elevation", 0.10)
    )
    
    # Weighted average confidence
    fused_conf = (
        c_slope * w.get("slope", 0.30) +
        c_crater * w.get("crater", 0.20) +
        c_boulder * w.get("boulder", 0.15) +
        c_shadow * w.get("shadow", 0.10) +
        c_rough * w.get("roughness", 0.15) +
        c_relief * w.get("elevation", 0.10)
    )
    
    # Hard constraints: force extreme hazard (1.0) on physical safety violations
    # 1. Slope hazard is extreme if slope > 15 deg (mapped in calculate_slope_risk)
    # 2. Directly on a boulder
    # 3. Direct shadow region (shadow_risk == 1.0)
    extreme_mask = (r_slope >= 0.8) | (r_boulder == 1.0) | (r_shadow == 1.0)
    fused_risk[extreme_mask] = 1.0
    
    # Overlay No-Data mask
    if no_data_mask is not None:
        fused_risk[~no_data_mask] = 1.0  # Force to 1.0 (treated as extreme obstacle)
        fused_conf[~no_data_mask] = 0.0  # Zero confidence
        
    # Classify hazard score
    # 0.00-0.20: SAFE
    # 0.20-0.40: LOW
    # 0.40-0.60: MODERATE
    # 0.60-0.80: HIGH
    # 0.80-1.00: EXTREME
    fused_class = np.zeros_like(fused_risk, dtype=np.uint8)
    fused_class[(fused_risk >= 0.00) & (fused_risk < 0.20)] = 0 # SAFE
    fused_class[(fused_risk >= 0.20) & (fused_risk < 0.40)] = 1 # LOW
    fused_class[(fused_risk >= 0.40) & (fused_risk < 0.60)] = 2 # MODERATE
    fused_class[(fused_risk >= 0.60) & (fused_risk < 0.80)] = 3 # HIGH
    fused_class[(fused_risk >= 0.80) & (fused_risk <= 1.00)] = 4 # EXTREME
    
    return fused_risk, fused_conf, fused_class
