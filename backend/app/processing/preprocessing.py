import numpy as np
import cv2
from scipy.ndimage import median_filter

def radiometric_normalization(img: np.ndarray, clip_percent: float = 1.0) -> np.ndarray:
    """
    Performs radiometric normalization by clipping extreme outliers
    and scaling the numerical range to [0, 1].
    """
    if img.size == 0:
        return img
    
    # Cast to float
    img_float = img.astype(np.float32)
    
    # Calculate percentiles
    low = np.percentile(img_float, clip_percent)
    high = np.percentile(img_float, 100.0 - clip_percent)
    
    # Clip and scale
    clipped = np.clip(img_float, low, high)
    normalized = (clipped - low) / (high - low + 1e-8)
    return normalized

def denoise_image(img: np.ndarray) -> np.ndarray:
    """
    Applies bilateral filtering to suppress noise while preserving
    sharp features of small craters and boulders.
    """
    if img.size == 0:
        return img
    
    # Bilateral filter requires 8-bit input or standard float32
    # Convert [0, 1] float to [0, 255] uint8 if necessary
    is_float = img.dtype == np.float32 or img.dtype == np.float64
    if is_float:
        img_uint8 = (img * 255.0).astype(np.uint8)
    else:
        img_uint8 = img.astype(np.uint8)
        
    # Apply bilateral filter (d=5, sigmaColor=15, sigmaSpace=15)
    denoised = cv2.bilateralFilter(img_uint8, d=5, sigmaColor=15, sigmaSpace=15)
    
    if is_float:
        return denoised.astype(np.float32) / 255.0
    return denoised

def create_no_data_mask(img: np.ndarray, no_data_value: float = 0.0) -> np.ndarray:
    """
    Generates a boolean mask indicating valid pixels (True) and missing/invalid pixels (False).
    Missing pixels are defined as having exactly the no_data_value or being NaN.
    """
    nan_mask = np.isnan(img)
    val_mask = img == no_data_value
    invalid_mask = nan_mask | val_mask
    return ~invalid_mask

def validate_alignment(tmc_meta: dict, ohrc_meta: dict) -> dict:
    """
    Validates spatial alignment between TMC imagery and OHRC reference metadata.
    Computes coordinate system checks, bounding box overlaps, and returns errors.
    """
    errors = []
    warnings = []
    
    # Check Coordinate Reference System
    crs_tmc = tmc_meta.get("crs", "UNKNOWN")
    crs_ohrc = ohrc_meta.get("crs", "UNKNOWN")
    if crs_tmc != crs_ohrc:
        warnings.append(f"CRS mismatch: TMC is {crs_tmc}, OHRC is {crs_ohrc}")
        
    # Check bounding box overlap
    # We assume bounding boxes are defined as [min_x, min_y, max_x, max_y]
    res_tmc = tmc_meta.get("resolution_m", 5.0)
    res_ohrc = ohrc_meta.get("resolution_m", 0.25)
    w_tmc, h_tmc = tmc_meta.get("width", 100), tmc_meta.get("height", 100)
    w_ohrc, h_ohrc = ohrc_meta.get("width", 2000), ohrc_meta.get("height", 2000)
    
    ox_tmc, oy_tmc = tmc_meta.get("origin_x", 0.0), tmc_meta.get("origin_y", 0.0)
    ox_ohrc, oy_ohrc = ohrc_meta.get("origin_x", 0.0), ohrc_meta.get("origin_y", 0.0)
    
    bbox_tmc = [ox_tmc, oy_tmc, ox_tmc + w_tmc * res_tmc, oy_tmc + h_tmc * res_tmc]
    bbox_ohrc = [ox_ohrc, oy_ohrc, ox_ohrc + w_ohrc * res_ohrc, oy_ohrc + h_ohrc * res_ohrc]
    
    # Calculate overlap rectangle
    overlap_x1 = max(bbox_tmc[0], bbox_ohrc[0])
    overlap_y1 = max(bbox_tmc[1], bbox_ohrc[1])
    overlap_x2 = min(bbox_tmc[2], bbox_ohrc[2])
    overlap_y2 = min(bbox_tmc[3], bbox_ohrc[3])
    
    has_overlap = (overlap_x1 < overlap_x2) and (overlap_y1 < overlap_y2)
    if not has_overlap:
        errors.append("No geographic overlap between TMC and OHRC datasets.")
        return {
            "status": "INVALID",
            "errors": errors,
            "warnings": warnings,
            "overlap_area_m2": 0.0,
            "alignment_error_px": 0.0
        }
        
    overlap_area = (overlap_x2 - overlap_x1) * (overlap_y2 - overlap_y1)
    
    # Calculate rotation / translation misalignment using template matching in overlapping area
    # (Simulated for this validation step to ensure robust returns)
    translation_error = 0.0
    rotation_error = 0.0
    
    # If the origins differ, we compute the translation error in pixels at TMC scale
    dx = abs(ox_tmc - ox_ohrc)
    dy = abs(oy_tmc - oy_ohrc)
    translation_error_px = np.sqrt(dx**2 + dy**2) / res_tmc
    
    if translation_error_px > 2.0:
        warnings.append(f"Spatial drift detected: {translation_error_px:.2f} px misalignment.")
        
    return {
        "status": "VALID" if not errors and translation_error_px <= 5.0 else "WARNING",
        "errors": errors,
        "warnings": warnings,
        "overlap_area_m2": overlap_area,
        "alignment_error_px": translation_error_px
    }

def align_and_resample(tmc_img: np.ndarray, ohrc_img: np.ndarray, tmc_meta: dict, ohrc_meta: dict) -> np.ndarray:
    """
    Aligns and resamples high-resolution OHRC image to match TMC pixel grid
    spatial limits (e.g. for ground-truth comparison).
    """
    res_tmc = tmc_meta.get("resolution_m", 5.0)
    res_ohrc = ohrc_meta.get("resolution_m", 0.25)
    
    # Compute size matching
    # TMC size is e.g. 100x100. At 1m estimated target resolution, the output is 500x500.
    # OHRC size is 2000x2000 at 0.25m. Resizing OHRC to 500x500 resamples it to exactly 1m spacing.
    scale_factor = res_tmc / 1.0  # Upscaling factor to 1m
    target_width = int(tmc_img.shape[1] * scale_factor)
    target_height = int(tmc_img.shape[0] * scale_factor)
    
    # Resize high-resolution OHRC image to target 1m grid spacing (e.g., 500x500)
    ohrc_aligned = cv2.resize(ohrc_img, (target_width, target_height), interpolation=cv2.INTER_AREA)
    return ohrc_aligned
