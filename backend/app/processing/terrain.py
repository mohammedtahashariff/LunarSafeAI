import numpy as np
import cv2
from scipy.ndimage import generic_filter

def calculate_slope_horn(dem: np.ndarray, resolution_m: float = 1.0) -> np.ndarray:
    """
    Calculates surface slope in degrees using Horn's method.
    Suitable for Digital Elevation Models (DEMs).
    """
    if dem.size == 0:
        return dem
        
    # Scale factor for Horn
    # Horn's filters for dx and dy
    # dx = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]] / (8 * spacing)
    # dy = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]] / (8 * spacing)
    
    kernel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32) / (8.0 * resolution_m)
    kernel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32) / (8.0 * resolution_m)
    
    # Pad borders to handle edges
    padded_dem = np.pad(dem, pad_width=1, mode='edge')
    
    # Compute gradients
    dx = cv2.filter2D(padded_dem.astype(np.float32), -1, kernel_x)
    dy = cv2.filter2D(padded_dem.astype(np.float32), -1, kernel_y)
    
    # Remove padding from gradients
    dx = dx[1:-1, 1:-1]
    dy = dy[1:-1, 1:-1]
    
    # Slope in radians and degrees
    slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
    slope_deg = np.degrees(slope_rad)
    return slope_deg

def calculate_aspect(dem: np.ndarray) -> np.ndarray:
    """
    Calculates slope aspect (direction of maximum slope rate of change) in degrees [0, 360].
    """
    if dem.size == 0:
        return dem
        
    dy, dx = np.gradient(dem)
    # Aspect angle in radians, from -pi to pi
    aspect_rad = np.arctan2(-dy, dx)
    
    # Convert to degrees, where 0 is North, clockwise
    aspect_deg = np.degrees(aspect_rad)
    aspect_deg = (450.0 - aspect_deg) % 360.0
    return aspect_deg

def calculate_curvature(dem: np.ndarray, resolution_m: float = 1.0) -> np.ndarray:
    """
    Calculates surface profile curvature using Laplacian filters.
    Negative values indicate convex ridges; positive indicates concave valleys.
    """
    if dem.size == 0:
        return dem
        
    # Standard Laplacian filter
    laplacian = cv2.Laplacian(dem.astype(np.float32), cv2.CV_32F, ksize=3)
    # Scale by cell grid spacing
    curvature = laplacian / (resolution_m ** 2)
    return curvature

def calculate_roughness(dem: np.ndarray, window_size: int = 5) -> np.ndarray:
    """
    Calculates local surface roughness, defined as the standard deviation
    of elevation in a window surrounding each cell.
    """
    if dem.size == 0:
        return dem
        
    # Implement local standard deviation filter using OpenCV
    # std_dev = sqrt( E[X^2] - (E[X])^2 )
    dem_f = dem.astype(np.float32)
    mean_val = cv2.boxFilter(dem_f, -1, (window_size, window_size))
    mean_sq = cv2.boxFilter(dem_f ** 2, -1, (window_size, window_size))
    
    variance = np.maximum(0.0, mean_sq - (mean_val ** 2))
    std_dev = np.sqrt(variance)
    return std_dev

def calculate_local_relief(dem: np.ndarray, window_size: int = 5) -> np.ndarray:
    """
    Calculates local relief (Max elevation - Min elevation in a local window).
    """
    if dem.size == 0:
        return dem
        
    # Using morphological dilate (max) and erode (min)
    kernel = np.ones((window_size, window_size), dtype=np.uint8)
    dem_f = dem.astype(np.float32)
    
    max_el = cv2.dilate(dem_f, kernel)
    min_el = cv2.erode(dem_f, kernel)
    
    relief = max_el - min_el
    return relief

def process_dem_terrain(dem_scaled: np.ndarray, has_dem: bool, resolution_m: float = 1.0) -> dict:
    """
    Analyzes terrain metrics. If has_dem is False, sets all layers to None
    and marks metadata as UNAVAILABLE.
    """
    if not has_dem or dem_scaled is None:
        return {
            "has_dem": False,
            "elevation": None,
            "slope": None,
            "aspect": None,
            "curvature": None,
            "roughness": None,
            "local_relief": None,
            "provenance": "UNAVAILABLE"
        }
        
    # Calculate all metrics
    slope = calculate_slope_horn(dem_scaled, resolution_m)
    aspect = calculate_aspect(dem_scaled)
    curvature = calculate_curvature(dem_scaled, resolution_m)
    roughness = calculate_roughness(dem_scaled, window_size=5)
    local_relief = calculate_local_relief(dem_scaled, window_size=5)
    
    return {
        "has_dem": True,
        "elevation": dem_scaled,
        "slope": slope,
        "aspect": aspect,
        "curvature": curvature,
        "roughness": roughness,
        "local_relief": local_relief,
        "provenance": "DERIVED"
    }
