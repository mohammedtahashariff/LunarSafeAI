import os
import json
import numpy as np
import cv2
from scipy.ndimage import gaussian_filter

def generate_synthetic_terrain():
    print("Generating synthetic lunar terrain (500x500 grid, 1m spacing)...")
    size = 500
    x = np.arange(size)
    y = np.arange(size)
    X, Y = np.meshgrid(x, y)
    
    # 1. Base undulating terrain (low frequency noise)
    elevation = 25.0 + 5.0 * np.sin(X / 80.0) * np.cos(Y / 100.0)
    elevation += 2.0 * np.sin(X / 30.0) * np.cos(Y / 30.0)
    
    # Add a ridge (high slope region)
    # A diagonal ridge on the top-right
    ridge = np.maximum(0, 15.0 - np.abs(X + Y - 650) / 15.0)
    elevation += ridge
    
    # 2. Add Craters (raised-rim paraboloids)
    # Crater format: (cx, cy, radius, depth)
    craters = [
        (150.0, 150.0, 35.0, 10.0), # Crater 1: Left-middle
        (350.0, 120.0, 25.0, 7.0),  # Crater 2: Top-right
        (220.0, 380.0, 45.0, 14.0)  # Crater 3: Bottom-middle
    ]
    
    for cx, cy, r, d in craters:
        dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
        # Inside crater bowl (r < r_crater)
        mask_bowl = dist < r
        # Parabolic profile
        elevation[mask_bowl] -= d * (1.0 - (dist[mask_bowl] / r)**2)
        
        # Crater rim (r to 1.4*r)
        mask_rim = (dist >= r) & (dist < 1.4 * r)
        # Smooth cosine raised rim
        rim_width = 0.4 * r
        rim_val = 0.25 * d * np.cos(np.pi * (dist[mask_rim] - r) / rim_width - np.pi / 2.0)
        elevation[mask_rim] += rim_val

    # 3. Add Boulders (small positive bumps)
    # Boulder format: (cx, cy, radius, height)
    boulders = [
        (80.0, 80.0, 3.0, 2.5),
        (90.0, 75.0, 2.0, 1.8),
        (260.0, 160.0, 4.0, 3.0),
        (120.0, 280.0, 3.0, 2.2),
        (310.0, 340.0, 5.0, 4.0),
        (420.0, 400.0, 2.5, 2.0),
        (180.0, 220.0, 3.5, 2.8),
        (450.0, 100.0, 3.0, 2.4),
        (50.0, 320.0, 4.0, 3.2),
        (380.0, 220.0, 2.0, 1.5)
    ]
    
    for cx, cy, r, h in boulders:
        dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
        mask_boulder = dist < r
        # Ellipsoidal dome
        elevation[mask_boulder] += h * np.sqrt(1.0 - (dist[mask_boulder] / r)**2)

    # 4. Smooth a flat landing zone (SAFE ZONE)
    # Safe zone center (380, 300) with a 45m radius
    sz_cx, sz_cy, sz_r = 380.0, 300.0, 45.0
    dist_sz = np.sqrt((X - sz_cx)**2 + (Y - sz_cy)**2)
    
    # Smooth blend between background and flat terrain (elevation = 22.0)
    blend_width = 15.0
    flat_val = 22.0
    
    mask_flat = dist_sz < sz_r
    mask_blend = (dist_sz >= sz_r) & (dist_sz < sz_r + blend_width)
    
    # Flatten the safe zone completely
    elevation[mask_flat] = flat_val
    
    # Blended transition to avoid sharp edges
    t = (dist_sz[mask_blend] - sz_r) / blend_width
    elevation[mask_blend] = t * elevation[mask_blend] + (1.0 - t) * flat_val

    # 5. Generate high-resolution orthophoto texture using hillshade
    print("Simulating sun illumination (Hillshade) for texture generation...")
    # Sun direction: azimuth = 45 deg, altitude = 30 deg
    azimuth = np.radians(45.0)
    altitude = np.radians(30.0)
    
    # Horn's method for gradients
    dy, dx = np.gradient(elevation, 1.0, 1.0)
    
    # Slope and aspect
    slope = np.arctan(np.sqrt(dx**2 + dy**2))
    aspect = np.arctan2(-dy, dx)
    
    # Hillshade equation
    shaded = np.sin(altitude) * np.cos(slope) + \
             np.cos(altitude) * np.sin(slope) * np.cos(azimuth - aspect)
             
    # Normalize to [0, 1]
    shaded = (shaded - shaded.min()) / (shaded.max() - shaded.min())
    
    # Add soil albedo variations (craters and ridges are slightly darker/brighter)
    albedo = 0.6 + 0.1 * np.sin(X / 20.0) * np.cos(Y / 25.0)
    # Crater rims have higher albedo, bowls have lower albedo
    for cx, cy, r, d in craters:
        dist = np.sqrt((X - cx)**2 + (Y - cy)**2)
        albedo[dist < r] -= 0.05
        albedo[(dist >= r) & (dist < 1.3*r)] += 0.08
        
    # Scale to grayscale texture [0, 255]
    texture = np.clip(shaded * albedo * 255.0, 0, 255).astype(np.uint8)
    
    # Add fine-grain regolith noise
    noise = np.random.normal(0, 8, size=(size, size))
    texture = np.clip(texture.astype(float) + noise, 0, 255).astype(np.uint8)
    
    # Apply light Gaussian smoothing to simulate optical blur
    texture = gaussian_filter(texture, sigma=0.5)

    return elevation, texture, craters, boulders

def main():
    os.makedirs("data/demo", exist_ok=True)
    
    elevation, texture, craters, boulders = generate_synthetic_terrain()
    
    # --- 1. SAVE DEM (1m resolution, 500x500) ---
    # We save elevation as a 16-bit PNG. Map elevation [0, 50] meters to [0, 65535]
    min_el = 0.0
    max_el = 50.0
    dem_16 = np.clip((elevation - min_el) / (max_el - min_el) * 65535.0, 0, 65535).astype(np.uint16)
    
    cv2.imwrite("data/demo/synthetic_dem.png", dem_16)
    
    dem_metadata = {
        "sensor": "SYNTHETIC_LUNAR_DEM",
        "resolution_m": 1.0,
        "width": 500,
        "height": 500,
        "min_elevation_m": min_el,
        "max_elevation_m": max_el,
        "crs": "LOCAL_LUNAR_GRID",
        "origin_x": 0.0,
        "origin_y": 0.0,
        "data_type": "SIMULATED",
        "craters": [{"x": c[0], "y": c[1], "radius_m": c[2], "depth_m": c[3]} for c in craters],
        "boulders": [{"x": b[0], "y": b[1], "radius_m": b[2], "height_m": b[3]} for b in boulders]
    }
    with open("data/demo/synthetic_dem_metadata.json", "w") as f:
        json.dump(dem_metadata, f, indent=2)
        
    # --- 2. SAVE TMC IMAGE (5m resolution, 100x100) ---
    # Downscale the 500x500 high-res texture by factor of 5
    tmc_img = cv2.resize(texture, (100, 100), interpolation=cv2.INTER_AREA)
    # Add sensor noise and slight blur
    tmc_noise = np.random.normal(0, 5, size=(100, 100))
    tmc_img = np.clip(tmc_img.astype(float) + tmc_noise, 0, 255).astype(np.uint8)
    tmc_img = gaussian_filter(tmc_img, sigma=0.6)
    
    cv2.imwrite("data/demo/synthetic_tmc.png", tmc_img)
    
    tmc_metadata = {
        "sensor": "SYNTHETIC_TMC_5M",
        "resolution_m": 5.0,
        "width": 100,
        "height": 100,
        "crs": "LOCAL_LUNAR_GRID",
        "origin_x": 0.0,
        "origin_y": 0.0,
        "data_type": "SIMULATED"
    }
    with open("data/demo/synthetic_tmc_metadata.json", "w") as f:
        json.dump(tmc_metadata, f, indent=2)

    # --- 3. SAVE OHRC REFERENCE IMAGE (25cm resolution, 2000x2000) ---
    # Upscale high-res texture by factor of 4 using bicubic interpolation
    ohrc_img = cv2.resize(texture, (2000, 2000), interpolation=cv2.INTER_CUBIC)
    # Add high-resolution texture details (Perlin-like noise)
    ohrc_noise = np.random.normal(0, 6, size=(2000, 2000))
    ohrc_img = np.clip(ohrc_img.astype(float) + ohrc_noise, 0, 255).astype(np.uint8)
    
    cv2.imwrite("data/demo/synthetic_ohrc.png", ohrc_img)
    
    ohrc_metadata = {
        "sensor": "SYNTHETIC_OHRC_25CM",
        "resolution_m": 0.25,
        "width": 2000,
        "height": 2000,
        "crs": "LOCAL_LUNAR_GRID",
        "origin_x": 0.0,
        "origin_y": 0.0,
        "data_type": "SIMULATED"
    }
    with open("data/demo/synthetic_ohrc_metadata.json", "w") as f:
        json.dump(ohrc_metadata, f, indent=2)
        
    print("Synthetic lunar datasets generated successfully inside data/demo/")
    print("- DEM: data/demo/synthetic_dem.png (500x500)")
    print("- TMC: data/demo/synthetic_tmc.png (100x100)")
    print("- OHRC: data/demo/synthetic_ohrc.png (2000x2000)")

if __name__ == "__main__":
    main()
