# System Architecture Manual

This document details the software architecture of the **LunarSafe AI** platform.

---

## 1. High-Level Component Interactions

```mermaid
graph TD
    User([User UI]) -->|Config & Triggers| API[FastAPI Web Server]
    API -->|Job payloads| Scheduler[Background Job Scheduler]
    Scheduler -->|Spawns Thread| Worker[Pipeline Execution Worker]
    Worker -->|1. Normalize & Denoise| Preprocess[Preprocessing Module]
    Worker -->|2. upscale 5m to 1m| SR[Super Resolution Engine]
    Worker -->|3. Slope & Curvatures| Terrain[Terrain Analysis Engine]
    Worker -->|4. Detect Objects| Hazards[Hazard Detectors]
    Worker -->|5. Fuse maps| Fusion[Hazard Fusion & Uncertainty]
    Worker -->|6. Window check| Landing[Landing footprint Selector]
    Worker -->|7. Graph search| Path[A* / Dijkstra Pathfinders]
    Worker -->|8. Create logs| Export[Export & PDF Report module]
    Export -->|Writes Files| Disk[(Processed Storage data/)]
    User -->|Retrieves Files| API
```

---

## 2. Backend Design

* **API routing (`backend/app/main.py`):** Configures FastAPI routes, mounts static directories (`/api/results` and `/api/demo_data`), and runs the dynamic route replanners.
* **Background Scheduler (`backend/app/services/jobs.py`):** Heavy ML/upscaling calculations run in a thread-safe registry mapping. This prevents uvicorn event-loop blocks.
* **Processing Modules:** Standard OpenCV/NumPy filters. Supports dual-mode (Geospatial and standard fallback modes).

---

## 3. Frontend Architecture

Built on React + Vite:
* `DashboardOverview.tsx`: Renders overview statistics cards, comparative timelines, and explainable justifications.
* `InteractiveMap2D.tsx`: High-performance HTML5 Canvas-based 2D layer viewer. Synchronizes mouse zoom/pan transforms.
* `TerrainViewer3D.tsx`: Interactive Three.js WebGL heightfield renderer. Samples DEM heights, paints hazard textures, and animates descending trajectories. Includes dynamic obstacles path-invalidation bindings.
