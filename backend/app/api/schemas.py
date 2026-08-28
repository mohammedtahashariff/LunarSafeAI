from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class ResolutionConfig(BaseModel):
    tmc: float = 5.0
    target_grid: float = 1.0
    ohrc: float = 0.25

class LandingConstraintsConfig(BaseModel):
    footprint_size_m: int = 20
    safety_margin_m: int = 2
    max_slope_deg: float = 10.0
    max_shadow_percent: float = 5.0
    max_roughness: float = 0.40
    max_hazard: float = 0.40

class HazardWeightsConfig(BaseModel):
    slope_weight: float = 0.30
    crater_weight: float = 0.20
    boulder_weight: float = 0.15
    shadow_weight: float = 0.10
    roughness_weight: float = 0.15
    elevation_weight: float = 0.10

class NavigationConfig(BaseModel):
    algorithm: str = "astar"
    hazard_penalty: float = 5.0
    uncertainty_penalty: float = 5.0
    slope_penalty: float = 3.0
    roughness_penalty: float = 2.0
    shadow_penalty: float = 2.0
    unknown_blocked: bool = True
    extreme_blocked: bool = True
    emergency_abort_threshold: float = 0.80

class AppSettings(BaseModel):
    resolution: ResolutionConfig = ResolutionConfig()
    landing: LandingConstraintsConfig = LandingConstraintsConfig()
    hazards: HazardWeightsConfig = HazardWeightsConfig()
    navigation: NavigationConfig = NavigationConfig()

class RunFullAnalysisPayload(BaseModel):
    mode: str = "demo" # "demo", "real", or "validation"
    sr_model: str = "edsr" # "bicubic", "edsr", "swinir", "lunarsr"
    start_point: List[int] = Field(default_factory=lambda: [50, 450]) # (x, y) coordinates
    config: Optional[Dict[str, Any]] = None

class ReplanPayload(BaseModel):
    start_point: List[int] # (x, y)
    goal_point: List[int]  # (x, y)
    dynamic_obstacles: List[Dict[str, Any]] = [] # [{x, y, radius}]
    config: Optional[Dict[str, Any]] = None

class JobResponse(BaseModel):
    job_id: str
    status: str
    progress: float
    current_stage: str
    elapsed_time: float
    error_message: Optional[str] = None
    results: Optional[Dict[str, Any]] = None

class RunSummaryResponse(BaseModel):
    job_id: str
    status: str
    sr_model: str
    mode: str
    timestamp: float
    elapsed_time: float
