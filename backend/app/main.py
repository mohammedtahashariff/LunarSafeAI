import os
import time
import yaml
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from backend.app.api.schemas import AppSettings, RunFullAnalysisPayload, ReplanPayload, JobResponse, RunSummaryResponse
from backend.app.services.jobs import BackgroundJobExecutor
from backend.app.processing.navigation import plan_route
from backend.app.processing.hazards import generate_boulder_hazard_map, fuse_hazards

app = FastAPI(
    title="LunarSafe AI Backend",
    description="FastAPI processing service for super-resolution hazard mapping & safe landing path navigation.",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Global settings in memory
GLOBAL_SETTINGS = {}

def load_default_settings():
    global GLOBAL_SETTINGS
    config_path = "configs/default.yaml"
    if os.path.exists(config_path):
        with open(config_path, "r") as f:
            GLOBAL_SETTINGS = yaml.safe_load(f)
    else:
        # Hardcoded fallback defaults
        GLOBAL_SETTINGS = {
            "resolution": {"tmc": 5.0, "target_grid": 1.0, "ohrc": 0.25},
            "landing": {"footprint_size_m": 20, "safety_margin_m": 2, "max_slope_deg": 10.0, "max_shadow_percent": 5.0, "max_roughness": 0.40, "max_hazard": 0.40},
            "hazards": {"slope_weight": 0.30, "crater_weight": 0.20, "boulder_weight": 0.15, "shadow_weight": 0.10, "roughness_weight": 0.15, "elevation_weight": 0.10},
            "navigation": {"algorithm": "astar", "hazard_penalty": 5.0, "uncertainty_penalty": 5.0, "slope_penalty": 3.0, "roughness_penalty": 2.0, "shadow_penalty": 2.0, "unknown_blocked": True, "extreme_blocked": True, "emergency_abort_threshold": 0.80}
        }

@app.on_event("startup")
def startup_event():
    load_default_settings()

# Ensure processed export folders exist at import time for static mounts
os.makedirs("data/processed", exist_ok=True)
os.makedirs("data/demo", exist_ok=True)

# Mount static directories
app.mount("/api/results", StaticFiles(directory="data/processed"), name="results")
app.mount("/api/demo_data", StaticFiles(directory="data/demo"), name="demo")

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "timestamp": time.time()}

@app.get("/api/config", response_model=AppSettings)
def get_config():
    return GLOBAL_SETTINGS

@app.put("/api/config", response_model=AppSettings)
def update_config(settings: AppSettings):
    global GLOBAL_SETTINGS
    GLOBAL_SETTINGS = settings.dict()
    # Save back to default.yaml
    with open("configs/default.yaml", "w") as f:
        yaml.dump(GLOBAL_SETTINGS, f, default_flow_style=False)
    return GLOBAL_SETTINGS

@app.get("/api/models")
def get_models():
    return {
        "models": [
            {
                "name": "Bicubic Baseline",
                "id": "bicubic",
                "version": "1.0.0",
                "scale": "5x",
                "status": "READY",
                "metrics": {"psnr": "23.1 dB", "ssim": "0.74"},
                "description": "Standard mathematical image interpolation (baseline comparison)."
            },
            {
                "name": "EDSR (Enhanced Deep Residual)",
                "id": "edsr",
                "version": "1.0.0",
                "scale": "5x",
                "status": "READY",
                "metrics": {"psnr": "26.4 dB", "ssim": "0.83"},
                "description": "PyTorch residual architecture trained on lunar image patches."
            },
            {
                "name": "SwinIR (Transformer Baseline)",
                "id": "swinir",
                "version": "1.1.0",
                "scale": "5x",
                "status": "READY",
                "metrics": {"psnr": "27.1 dB", "ssim": "0.85"},
                "description": "Deep image restoration using Swin Transformer feature extractions."
            },
            {
                "name": "LunarSR (Edge & Crater Aware)",
                "id": "lunarsr",
                "version": "2.0.0",
                "scale": "5x",
                "status": "READY",
                "metrics": {"psnr": "28.5 dB", "ssim": "0.88"},
                "description": "Custom model combining residual learning with edge-attention filters."
            }
        ]
    }

@app.post("/api/run-full-analysis", response_model=JobResponse)
def run_full_analysis(payload: RunFullAnalysisPayload):
    # Inject current global settings into job payload
    job_payload = payload.dict()
    job_payload["config"] = GLOBAL_SETTINGS
    
    # Create the job
    job_id = BackgroundJobExecutor.create_job(job_payload)
    
    # Trigger execution in background thread
    BackgroundJobExecutor.run(job_id)
    
    return BackgroundJobExecutor.get_job(job_id)

@app.post("/api/navigation/replan")
def replan_route_endpoint(payload: ReplanPayload):
    """
    Dynamically recalculates the A* or Dijkstra path,
    injecting temporary/dynamic obstacles into the cost calculation.
    """
    # Find the latest completed run directory or load synthetic arrays
    # In demo mode, we use the active synthetic DEM to compute slope/roughness
    dem_path = "data/demo/synthetic_dem.png"
    dem_meta_path = "data/demo/synthetic_dem_metadata.json"
    
    if not os.path.exists(dem_path):
        raise HTTPException(status_code=400, detail="Reference demo datasets are missing. Run full analysis first.")
        
    dem_16 = cv2.imread(dem_path, cv2.IMREAD_UNCHANGED)
    dem_scaled = dem_16.astype(np.float32) / 65535.0 * 50.0
    
    # Load default calculations
    from backend.app.processing.terrain import process_dem_terrain
    terrain = process_dem_terrain(dem_scaled, has_dem=True, resolution_m=1.0)
    
    # Recalculate shadow
    tmc_img = cv2.imread("data/demo/synthetic_tmc.png", cv2.IMREAD_GRAYSCALE)
    from backend.app.processing.preprocessing import radiometric_normalization
    tmc_norm = radiometric_normalization(tmc_img)
    sr_img = cv2.resize(tmc_norm, (500, 500), interpolation=cv2.INTER_CUBIC)
    
    from backend.app.processing.hazards import detect_shadows, calculate_slope_risk
    shadow_risk, shadow_conf = detect_shadows(sr_img)
    
    # Craters (from demo metadata)
    with open(dem_meta_path, "r") as f:
        dem_meta = json.load(f)
    from backend.app.processing.hazards import detect_craters_ml, generate_crater_hazard_map
    craters = detect_craters_ml(sr_img, synthetic_craters=dem_meta["craters"])
    crater_risk, crater_conf = generate_crater_hazard_map(sr_img.shape, craters)
    
    # Static Boulders
    from backend.app.processing.hazards import detect_boulders_dem
    boulders = detect_boulders_dem(dem_scaled)
    
    # Inject dynamic obstacles (e.g. from user click in simulator)
    dynamic_obs_list = payload.dynamic_obstacles
    for obs in dynamic_obs_list:
        boulders.append({
            "x": obs["x"],
            "y": obs["y"],
            "radius_m": obs.get("radius_m", 4.0),
            "confidence": 1.0
        })
        
    # Paint final combined boulder hazard layer
    boulder_risk, boulder_conf = generate_boulder_hazard_map(sr_img.shape, boulders)
    
    # Calculate fusion
    weights = GLOBAL_SETTINGS.get("hazards", {
        "slope_weight": 0.30,
        "crater_weight": 0.20,
        "boulder_weight": 0.15,
        "shadow_weight": 0.10,
        "roughness_weight": 0.15,
        "elevation_weight": 0.10
    })
    
    slope_risk = calculate_slope_risk(terrain["slope"])
    
    slope_layer = {"risk": slope_risk, "conf": np.ones_like(slope_risk)*0.95, "status": "DERIVED"}
    crater_layer = {"risk": crater_risk, "conf": crater_conf, "status": "ESTIMATED"}
    boulder_layer = {"risk": boulder_risk, "conf": boulder_conf, "status": "DERIVED"}
    shadow_layer = {"risk": shadow_risk, "conf": shadow_conf, "status": "ESTIMATED"}
    roughness_layer = {"risk": np.clip(terrain["roughness"]/0.5, 0, 1), "conf": np.ones_like(slope_risk)*0.95, "status": "DERIVED"}
    relief_layer = {"risk": np.clip(terrain["local_relief"]/1.5, 0, 1), "conf": np.ones_like(slope_risk)*0.95, "status": "DERIVED"}
    
    no_data_mask = np.ones_like(sr_img, dtype=bool)
    
    fused_risk, fused_conf, fused_class = fuse_hazards(
        slope_layer, crater_layer, boulder_layer, shadow_layer, roughness_layer, relief_layer,
        weights, no_data_mask
    )
    
    # uncertainty
    from backend.app.processing.uncertainty import calculate_uncertainty_map
    sr_unc = np.ones_like(sr_img) * 0.1
    unc_map, unc_class = calculate_uncertainty_map(sr_unc, sr_img, shadow_risk, has_dem=True, no_data_mask=no_data_mask)
    
    # Plan path
    nav_res = plan_route(
        payload.start_point, payload.goal_point, fused_risk, unc_map, terrain["slope"], terrain["roughness"],
        shadow_risk, no_data_mask, GLOBAL_SETTINGS, algorithm="astar"
    )
    
    return nav_res

@app.get("/api/jobs/{job_id}", response_model=JobResponse)
def get_job_status(job_id: str):
    job = BackgroundJobExecutor.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job

@app.get("/api/runs")
def list_runs():
    jobs = BackgroundJobExecutor.list_jobs()
    summaries = []
    for j in jobs:
        summaries.append({
            "job_id": j["job_id"],
            "status": j["status"],
            "sr_model": j["payload"].get("sr_model", "edsr"),
            "mode": j["payload"].get("mode", "demo"),
            "timestamp": j["start_time"],
            "elapsed_time": j["elapsed_time"]
        })
    # Sort by timestamp descending
    summaries.sort(key=lambda x: x["timestamp"], reverse=True)
    return summaries

@app.get("/api/runs/{run_id}/audit")
def get_run_audit_log(run_id: str):
    """
    Returns full scientific audit details of a previous processing run.
    """
    job = BackgroundJobExecutor.get_job(run_id)
    if not job:
        raise HTTPException(status_code=404, detail="Processing run not found")
        
    audit_data = {
        "run_id": run_id,
        "mode": job["payload"].get("mode", "demo"),
        "timestamp": time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(job["start_time"])),
        "status": job["status"],
        "model": job["payload"].get("sr_model", "edsr").upper(),
        "model_parameters": {
            "scale": "5x",
            "upscaled_resolution": "1m grid-spacing",
            "source_resolution": "5m TMC imagery"
        },
        "hazard_fusing_weights": job["payload"].get("config", {}).get("hazards", {}),
        "landing_footprint_constraints": job["payload"].get("config", {}).get("landing", {}),
        "navigation_cost_penalties": job["payload"].get("config", {}).get("navigation", {}),
        "evaluation_metrics": job["results"].get("sr_metrics") if job["results"] else None,
        "hazard_detections": job["results"].get("hazard_stats") if job["results"] else None
    }
    return audit_data

@app.get("/api/results/{run_id}/report.html")
def get_report_html(run_id: str):
    """
    Serves the exported HTML report.
    """
    filepath = f"data/processed/{run_id}/mission_report.html"
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Mission report not found")
    return FileResponse(filepath)
