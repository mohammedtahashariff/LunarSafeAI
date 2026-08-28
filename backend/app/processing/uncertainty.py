import numpy as np
import cv2

def calculate_uncertainty_map(
    sr_uncertainty: np.ndarray,
    sr_img: np.ndarray,
    shadow_risk: np.ndarray,
    has_dem: bool,
    no_data_mask: np.ndarray = None
) -> tuple:
    """
    Computes a multi-factor grid uncertainty map.
    Uncertainty factors:
    1. SR Reconstruction uncertainty (0.0 to 1.0).
    2. Low illumination: low contrast/intensity makes shadow detection and visual features fuzzy.
    3. Shadow boundaries: transition zones around shadows have high signal-to-noise drift.
    4. DEM absence: if DEM is missing, terrain variables are unknown, yielding extreme uncertainty.
    
    Returns:
        uncertainty (np.ndarray): Map scaled to [0, 1].
        classes (np.ndarray): Categorical map (0=LOW, 1=MEDIUM, 2=HIGH, 3=UNKNOWN).
    """
    shape = sr_img.shape
    
    # 1. Base super-resolution uncertainty
    unc = sr_uncertainty.copy()
    
    # 2. Add Low illumination factor (inverse brightness)
    # Brightness in [0, 1]. Lower values have higher uncertainty
    low_light_unc = np.clip(1.0 - (sr_img / 0.3), 0.0, 1.0) * 0.4
    unc = np.maximum(unc, low_light_unc)
    
    # 3. Shadow boundaries
    # Dialate shadow mask slightly and find boundary difference
    kernel = np.ones((5, 5), dtype=np.uint8)
    shadow_dilated = cv2.dilate(shadow_risk, kernel)
    boundary_mask = (shadow_dilated > 0.0) & (shadow_risk == 0.0)
    
    unc[boundary_mask] = np.maximum(unc[boundary_mask], 0.65)
    
    # 4. If DEM is unavailable, uncertainty of physical layers is high
    if not has_dem:
        # Increase baseline uncertainty of the entire map by 0.35
        unc = np.clip(unc + 0.35, 0.0, 1.0)
        
    # Overlay No-Data mask
    if no_data_mask is not None:
        unc[~no_data_mask] = 1.0
        
    # Classify uncertainty:
    # 0.00-0.25: LOW
    # 0.25-0.50: MEDIUM
    # 0.50-0.75: HIGH
    # 0.75-1.00: UNKNOWN (and no-data)
    classes = np.zeros_like(unc, dtype=np.uint8)
    classes[(unc >= 0.00) & (unc < 0.25)] = 0  # LOW
    classes[(unc >= 0.25) & (unc < 0.50)] = 1  # MEDIUM
    classes[(unc >= 0.50) & (unc < 0.75)] = 2  # HIGH
    classes[(unc >= 0.75) & (unc <= 1.00)] = 3  # UNKNOWN
    
    return unc, classes
