import json
import os
import numpy as np
import cv2

def export_hazard_map_png(fused_hazard: np.ndarray, filepath: str):
    """
    Exports a colorful PNG representation of the hazard map.
    Colormap legend:
      Safe: Green (0, 185, 129)
      Low Risk: Light Green/Lime (132, 204, 22)
      Moderate: Yellow (234, 179, 8)
      High Risk: Orange (249, 115, 22)
      Extreme: Red (239, 68, 68)
    """
    h, w = fused_hazard.shape
    colored = np.zeros((h, w, 3), dtype=np.uint8)
    
    # Define colors in BGR
    c_safe = [129, 185, 0]
    c_low = [22, 204, 132]
    c_mod = [8, 179, 234]
    c_high = [22, 115, 249]
    c_ext = [68, 68, 239]
    
    # Fill colors based on hazard values
    colored[fused_hazard < 0.20] = c_safe
    colored[(fused_hazard >= 0.20) & (fused_hazard < 0.40)] = c_low
    colored[(fused_hazard >= 0.40) & (fused_hazard < 0.60)] = c_mod
    colored[(fused_hazard >= 0.60) & (fused_hazard < 0.80)] = c_high
    colored[fused_hazard >= 0.80] = c_ext
    
    cv2.imwrite(filepath, colored)

def export_landing_zones_geojson(candidates: list, filepath: str):
    """
    Saves candidate landing zones as a GeoJSON FeatureCollection.
    """
    features = []
    for cand in candidates:
        geom = {
            "type": "Point",
            "coordinates": [float(cand["x"]), float(cand["y"])]
        }
        props = {
            "id": cand["id"],
            "suitability": float(cand["score"]),
            "mean_slope": float(cand["mean_slope"]),
            "max_slope": float(cand["max_slope"]),
            "mean_hazard": float(cand["mean_hazard"]),
            "shadow_percent": float(cand["shadow_percent"]),
            "decision": cand["decision"]
        }
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": props
        })
        
    geojson = {
        "type": "FeatureCollection",
        "features": features
    }
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(geojson, f, indent=2)

def export_navigation_geojson(path: list, filepath: str):
    """
    Saves A* or Dijkstra paths as a GeoJSON Feature representing a LineString.
    """
    # Coordinates format: [[x1, y1], [x2, y2], ...]
    coords = [[float(p[0]), float(p[1])] for p in path]
    
    feature = {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": coords
        },
        "properties": {
            "description": "Risk-Aware Lander Navigation Path"
        }
    }
    
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(feature, f, indent=2)

def generate_scientific_html_report(
    run_id: str,
    dataset_info: dict,
    sr_model: str,
    sr_metrics: dict,
    hazard_stats: dict,
    best_candidate: dict,
    nav_metrics: dict,
    why_selected: list,
    filepath: str
):
    """
    Generates a printable, professional HTML scientific mission report.
    """
    why_selected_html = "".join([
        f"<li style='margin-bottom: 6px; color: {'#10b981' if item['status'] == 'PASS' else '#eab308'};'>"
        f"{'✓' if item['status'] == 'PASS' else '⚠'} {item['text']}</li>"
        for item in why_selected
    ])
    
    html = f"""<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>LunarSafe AI - Mission Analysis Report</title>
    <style>
        body {{
            font-family: 'Outfit', -apple-system, sans-serif;
            background-color: #f9fafb;
            color: #111827;
            padding: 40px;
            max-width: 900px;
            margin: 0 auto;
        }}
        .header {{
            border-bottom: 3px solid #06b6d4;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }}
        .header h1 {{
            color: #0b0f19;
            margin: 0;
            font-size: 28px;
        }}
        .run-id {{
            color: #06b6d4;
            font-family: 'JetBrains Mono', monospace;
            font-size: 16px;
            font-weight: bold;
            margin-top: 5px;
        }}
        .section {{
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}
        .section-title {{
            font-size: 18px;
            color: #111827;
            border-left: 4px solid #06b6d4;
            padding-left: 10px;
            margin-top: 0;
            margin-bottom: 20px;
        }}
        .grid {{
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
        }}
        .metric-label {{
            font-size: 13px;
            color: #6b7280;
            margin-bottom: 4px;
        }}
        .metric-value {{
            font-size: 16px;
            font-weight: 600;
            color: #111827;
        }}
        .badge {{
            display: inline-block;
            padding: 3px 8px;
            border-radius: 4px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
        }}
        .badge-observed {{ background: #e0f2fe; color: #0369a1; }}
        .badge-estimated {{ background: #fef3c7; color: #b45309; }}
        .badge-derived {{ background: #dcfce7; color: #15803d; }}
        .disclaimer {{
            background: #fffbeb;
            border: 1px solid #fef3c7;
            border-radius: 6px;
            padding: 15px;
            font-size: 13px;
            color: #b45309;
            margin-top: 30px;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>LunarSafe AI — Scientific Mission Report</h1>
        <div class="run-id">RUN ID: {run_id}</div>
    </div>
    
    <div class="section">
        <div class="section-title">1. Dataset Summary & Provenance</div>
        <div class="grid">
            <div>
                <div class="metric-label">Input Imagery</div>
                <div class="metric-value">{dataset_info.get('name', 'TMC Image')} <span class="badge badge-observed">OBSERVED</span></div>
            </div>
            <div>
                <div class="metric-label">Spatial Resolution</div>
                <div class="metric-value">{dataset_info.get('resolution_m', 5.0)} meters</div>
            </div>
            <div>
                <div class="metric-label">Elevation Model</div>
                <div class="metric-value">{'Digital Elevation Model (DEM)' if dataset_info.get('has_dem') else 'Not Provided'} 
                    <span class="badge badge-derived">{'DERIVED' if dataset_info.get('has_dem') else 'UNAVAILABLE'}</span>
                </div>
            </div>
            <div>
                <div class="metric-label">Target Grid spacing</div>
                <div class="metric-value">1.0 meter <span class="badge badge-estimated">ESTIMATED</span></div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">2. Super-Resolution Reconstruction</div>
        <div class="grid">
            <div>
                <div class="metric-label">upscaling Algorithm</div>
                <div class="metric-value" style="text-transform: uppercase;">{sr_model}</div>
            </div>
            <div>
                <div class="metric-label">Inference Status</div>
                <div class="metric-value">Completed (<span class="badge badge-estimated">ESTIMATED</span>)</div>
            </div>
            <div>
                <div class="metric-label">SSIM (Structural Similarity)</div>
                <div class="metric-value">{sr_metrics.get('ssim', 'Not Evaluated')}</div>
            </div>
            <div>
                <div class="metric-label">PSNR (Peak Signal-to-Noise Ratio)</div>
                <div class="metric-value">{sr_metrics.get('psnr', 'Not Evaluated')} dB</div>
            </div>
        </div>
    </div>

    <div class="section">
        <div class="section-title">3. Selected Landing Zone Diagnostic</div>
        {f"""
        <div class="grid" style="margin-bottom: 20px;">
            <div>
                <div class="metric-label">Candidate Identifier</div>
                <div class="metric-value" style="color: #06b6d4; font-family: monospace;">{best_candidate.get('id', 'N/A')}</div>
            </div>
            <div>
                <div class="metric-label">Landing Suitability Score</div>
                <div class="metric-value">{best_candidate.get('score', 0.0):.1f} / 100</div>
            </div>
            <div>
                <div class="metric-label">Coordinates (Grid cell X, Y)</div>
                <div class="metric-value">[{best_candidate.get('x', 0)}, {best_candidate.get('y', 0)}]</div>
            </div>
            <div>
                <div class="metric-label">Decision State</div>
                <div class="metric-value" style="color: #10b981; font-weight: bold;">{best_candidate.get('decision', 'N/A')}</div>
            </div>
        </div>
        
        <div style="background: #f3f4f6; border-radius: 6px; padding: 15px;">
            <div style="font-weight: 600; font-size: 14px; margin-bottom: 10px;">Why Selected? (Explainable AI Panel)</div>
            <ul style="padding-left: 20px; margin: 0; font-size: 13px;">
                {why_selected_html}
            </ul>
        </div>
        """ if best_candidate else "<div class='metric-value' style='color:#ef4444;'>NO VALID LANDING ZONE IDENTIFIED.</div>"}
    </div>

    <div class="section">
        <div class="section-title">4. Risk-Aware Navigation Path</div>
        {f"""
        <div class="grid">
            <div>
                <div class="metric-label">Calculated Route Distance</div>
                <div class="metric-value">{nav_metrics.get('path_length_m', 0.0):.1f} meters</div>
            </div>
            <div>
                <div class="metric-label">Maximum Hazard Encountered</div>
                <div class="metric-value" style="color: #f97316;">{nav_metrics.get('max_hazard_encountered', 0.0):.2f}</div>
            </div>
            <div>
                <div class="metric-label">Average Hazard along route</div>
                <div class="metric-value">{nav_metrics.get('average_hazard', 0.0):.2f}</div>
            </div>
            <div>
                <div class="metric-label">Computation Time</div>
                <div class="metric-value">{nav_metrics.get('planning_time_ms', 0.0):.1f} ms</div>
            </div>
        </div>
        """ if nav_metrics else "<div class='metric-value'>No path planned.</div>"}
    </div>

    <div class="disclaimer">
        <strong>SCIENTIFIC LIMITATION NOTICE:</strong> Super-resolved imagery is an estimated higher-resolution representation
        derived from lower-resolution source imagery. It must not be interpreted as direct physical observation.
        Slope, physical terrain roughness, local relief and elevation-dependent hazards require valid elevation data (DEM)
        or a separately validated terrain reconstruction method.
    </div>
</body>
</html>
"""
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)
