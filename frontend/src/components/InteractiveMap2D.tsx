import React, { useRef, useEffect, useState } from 'react';
import { Eye, Layers, Compass, HelpCircle } from 'lucide-react';

interface InteractiveMap2DProps {
  runData: any;
}

export default function InteractiveMap2D({ runData }: InteractiveMap2DProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  
  // Layer Selection
  const [activeLayer, setActiveLayer] = useState<string>('hazard'); // 'tmc', 'sr', 'dem', 'slope', 'hazard', 'uncertainty'
  const [showCandidates, setShowCandidates] = useState<boolean>(true);
  const [showPath, setShowPath] = useState<boolean>(true);
  const [showCoverage, setShowCoverage] = useState<boolean>(false);
  
  // View State (Zoom / Pan)
  const [zoom, setZoom] = useState<number>(1.0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  
  // Cursor Telemetry
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [hoverMetrics, setHoverMetrics] = useState<any>(null);
  
  // Image cache
  const [images, setImages] = useState<any>({});
  
  const hasResults = runData && runData.results;
  const results = hasResults ? runData.results : null;
  const candidates = results?.candidates || [];
  const path = results?.navigation_astar?.path || [];

  // Load images when runData is completed
  useEffect(() => {
    if (!results) return;
    
    const imageSources: any = {
      tmc: '/api/demo_data/synthetic_tmc.png',
      sr: '/api/demo_data/synthetic_ohrc.png', // Represents the estimated high-res texture
      dem: '/api/demo_data/synthetic_dem.png',
      hazard: results.files.hazard_map_png,
      uncertainty: results.files.hazard_map_png // Fallback image for display
    };
    
    const loadedImages: any = {};
    let loadedCount = 0;
    const keys = Object.keys(imageSources);
    
    keys.forEach(key => {
      const img = new Image();
      img.src = imageSources[key];
      img.onload = () => {
        loadedImages[key] = img;
        loadedCount++;
        if (loadedCount === keys.length) {
          setImages(loadedImages);
        }
      };
    });
  }, [runData]);

  // Redraw Canvas
  useEffect(() => {
    drawCanvas();
  }, [images, activeLayer, zoom, offset, showCandidates, showPath, showCoverage, results]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    ctx.save();
    // Apply Zoom & Pan Transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);
    
    // Draw Active Layer
    const activeImg = images[activeLayer];
    if (activeImg) {
      // All grids represent 500m x 500m. Map to 500x500 pixels on Canvas
      ctx.drawImage(activeImg, 0, 0, 500, 500);
      
      // If uncertainty layer, we paint a custom blue-gray tint
      if (activeLayer === 'uncertainty') {
        ctx.fillStyle = 'rgba(6, 182, 212, 0.15)';
        ctx.fillRect(0, 0, 500, 500);
      }
    } else {
      // Draw grid placeholder
      ctx.fillStyle = '#0b0f19';
      ctx.fillRect(0, 0, 500, 500);
      
      ctx.strokeStyle = '#1f2937';
      ctx.lineWidth = 1;
      // Draw grid lines
      for (let i = 0; i <= 500; i += 50) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 500);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(500, i);
        ctx.stroke();
      }
      
      ctx.fillStyle = '#6b7280';
      ctx.font = '12px monospace';
      ctx.fillText('NO LAYER LOADED - RUN FULL MISSION', 130, 250);
    }
    
    // Draw Navigation Path
    if (showPath && path.length > 0) {
      ctx.beginPath();
      ctx.strokeStyle = '#06b6d4'; // Cyan route line
      ctx.lineWidth = 3 / zoom;
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 4 / zoom;
      
      path.forEach((pt: any, idx: number) => {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
      ctx.shadowBlur = 0; // Reset shadow
      
      // Draw Lander Start Point
      const startPt = path[0];
      ctx.beginPath();
      ctx.fillStyle = '#eab308'; // Amber start
      ctx.arc(startPt[0], startPt[1], 6 / zoom, 0, 2 * Math.PI);
      ctx.fill();
      
      ctx.fillStyle = '#ffffff';
      ctx.font = `${10 / zoom}px monospace`;
      ctx.fillText('START', startPt[0] + 10 / zoom, startPt[1] + 4 / zoom);
    }
    
    // Draw Landing Zone Candidates
    if (showCandidates && candidates.length > 0) {
      candidates.forEach((cand: any, idx: number) => {
        const isBest = idx === 0;
        
        // Draw footprint boundaries (20m footprint, so 20px diameter / 10px radius)
        ctx.beginPath();
        ctx.strokeStyle = isBest ? '#10b981' : '#84cc16'; // Emerald for best, lime for others
        ctx.lineWidth = isBest ? 2 / zoom : 1 / zoom;
        
        // Footprint circle
        ctx.arc(cand.x, cand.y, 10, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Safety Buffer circle (12px radius)
        ctx.beginPath();
        ctx.strokeStyle = isBest ? 'rgba(16, 185, 129, 0.4)' : 'rgba(132, 204, 22, 0.3)';
        ctx.setLineDash([4 / zoom, 4 / zoom]);
        ctx.arc(cand.x, cand.y, 12, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
        
        // Center crosshair
        ctx.beginPath();
        ctx.moveTo(cand.x - 3 / zoom, cand.y);
        ctx.lineTo(cand.x + 3 / zoom, cand.y);
        ctx.moveTo(cand.x, cand.y - 3 / zoom);
        ctx.lineTo(cand.x, cand.y + 3 / zoom);
        ctx.stroke();
        
        // Draw text label
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${8 / zoom}px monospace`;
        ctx.fillText(cand.id, cand.x + 14 / zoom, cand.y + 3 / zoom);
      });
    }

    // Draw Dataset Coverage Overlay
    if (showCoverage) {
      // TMC bounds: cyan outline (full 100% since synthetic data matches grid)
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.8)';
      ctx.lineWidth = 2 / zoom;
      ctx.strokeRect(5, 5, 490, 490);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.1)';
      ctx.fillRect(5, 5, 490, 490);
      
      // OHRC bounds: purple outline (e.g. 50% overlap coverage)
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.8)';
      ctx.strokeRect(100, 100, 300, 300);
      ctx.fillStyle = 'rgba(168, 85, 247, 0.1)';
      ctx.fillRect(100, 100, 300, 300);
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.font = `${10 / zoom}px monospace`;
      ctx.fillText('TMC COVERAGE AREA', 20, 30);
      ctx.fillText('OHRC REFERENCE AREA (OVERLAP)', 110, 120);
    }
    
    ctx.restore();
  };

  // Zoom/Pan Event Handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;
    
    // Pan execution
    if (isDragging) {
      setOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
    
    // Compute local matrix coordinate (0 to 500) under zoom/offset
    const gridX = Math.round((clientX - offset.x) / zoom);
    const gridY = Math.round((clientY - offset.y) / zoom);
    
    if (gridX >= 0 && gridX < 500 && gridY >= 0 && gridY < 500) {
      setCursorPos({ x: gridX, y: gridY });
      
      // Calculate realistic simulated hover values based on grid location
      // (Used to display instant hover metrics panel)
      let el = 22.4;
      let sl = 3.2;
      let hz = 0.05;
      let unc = "LOW";
      
      // Craters regions have high slope & hazard
      if (results) {
        // Find if near crater center
        const cx1 = 150, cy1 = 150, r1 = 35;
        const cx2 = 350, cy2 = 120, r2 = 25;
        const cx3 = 220, cy3 = 380, r3 = 45;
        
        const d1 = Math.sqrt((gridX - cx1)**2 + (gridY - cy1)**2);
        const d2 = Math.sqrt((gridX - cx2)**2 + (gridY - cy2)**2);
        const d3 = Math.sqrt((gridX - cx3)**2 + (gridY - cy3)**2);
        
        if (d1 < r1 * 1.3 || d2 < r2 * 1.3 || d3 < r3 * 1.3) {
          sl = 14.8;
          hz = 0.85;
          unc = "MEDIUM";
        }
        
        // Ridge diagonal region
        if (gridX + gridY > 630 && gridX + gridY < 670) {
          sl = 12.5;
          hz = 0.65;
          unc = "LOW";
        }
      }
      
      setHoverMetrics({
        elevation: el,
        slope: sl,
        hazard: hz,
        uncertainty: unc
      });
    } else {
      setCursorPos(null);
      setHoverMetrics(null);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const scale = e.deltaY < 0 ? 1.1 : 0.9;
    setZoom(prev => Math.min(Math.max(prev * scale, 0.5), 15.0));
  };

  const resetView = () => {
    setZoom(1.0);
    setOffset({ x: 0, y: 0 });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Side layers selector */}
      <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg space-y-5 lg:col-span-1">
        <div>
          <div className="text-xs font-mono text-aerospace-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Layers size={14} className="text-cyan-400" /> Active Grid Layer
          </div>
          <div className="space-y-2">
            {[
              { id: 'tmc', name: 'TMC Imagery (5m)', prov: 'OBSERVED' },
              { id: 'sr', name: 'SR Estimate (1m)', prov: 'ESTIMATED' },
              { id: 'dem', name: 'DEM Elevation', prov: 'DERIVED' },
              { id: 'slope', name: 'Slope Map', prov: 'DERIVED' },
              { id: 'hazard', name: 'Combined Hazard', prov: 'DERIVED' },
              { id: 'uncertainty', name: 'Uncertainty Map', prov: 'ESTIMATED' }
            ].map(layer => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`w-full px-3 py-2 text-left rounded text-xs font-mono flex justify-between items-center border transition ${
                  activeLayer === layer.id 
                    ? 'bg-cyan-950/40 border-cyan-500 text-cyan-200' 
                    : 'bg-aerospace-950 border-aerospace-800 text-aerospace-400 hover:border-aerospace-700'
                }`}
              >
                <span>{layer.name}</span>
                <span className={`text-[9px] px-1 py-0.5 rounded border border-transparent ${
                  layer.prov === 'OBSERVED' ? 'bg-blue-950/60 text-blue-300' :
                  layer.prov === 'ESTIMATED' ? 'bg-amber-950/60 text-amber-300' : 'bg-emerald-950/60 text-emerald-300'
                }`}>
                  {layer.prov}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="border-t border-aerospace-800/80 pt-4">
          <div className="text-xs font-mono text-aerospace-400 uppercase tracking-wider mb-3">Map Overlays</div>
          <div className="space-y-2 text-xs">
            <label className="flex items-center gap-2 text-aerospace-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showCandidates} 
                onChange={(e) => setShowCandidates(e.target.checked)}
                className="accent-cyan-500 bg-black"
              />
              <span>Candidate Landing Footprints</span>
            </label>
            <label className="flex items-center gap-2 text-aerospace-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showPath} 
                onChange={(e) => setShowPath(e.target.checked)}
                className="accent-cyan-500 bg-black"
              />
              <span>Lander Planned Route</span>
            </label>
            <label className="flex items-center gap-2 text-aerospace-300 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showCoverage} 
                onChange={(e) => setShowCoverage(e.target.checked)}
                className="accent-cyan-500 bg-black"
              />
              <span>Dataset Coverage Map</span>
            </label>
          </div>
        </div>

        <button 
          onClick={resetView} 
          className="w-full py-1.5 bg-aerospace-850 border border-aerospace-750 hover:bg-aerospace-800 text-xs font-mono text-aerospace-300 rounded transition"
        >
          Reset Zoom/Pan
        </button>
      </div>

      {/* Map display */}
      <div className="bg-aerospace-900 border border-aerospace-750 p-4 rounded-lg lg:col-span-3 space-y-4 flex flex-col">
        <div className="flex justify-between items-center text-xs font-mono text-aerospace-400">
          <span className="flex items-center gap-1"><Compass size={14} className="text-cyan-400" /> Interactive Map Area (500m x 500m)</span>
          <span>Hold Left-Click to drag | Scroll to Zoom</span>
        </div>
        
        <div 
          ref={containerRef}
          className="bg-black border border-aerospace-950 rounded flex items-center justify-center overflow-hidden cursor-crosshair select-none relative"
          style={{ minHeight: '450px' }}
        >
          <canvas 
            ref={canvasRef}
            width={500}
            height={500}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
            className="shadow-2xl"
          />
          
          {/* Coordinates hover card */}
          {cursorPos && hoverMetrics && (
            <div className="absolute top-4 left-4 bg-aerospace-950/90 border border-aerospace-700/80 p-3 rounded-lg shadow-xl text-xs font-mono space-y-1.5 text-aerospace-200 min-w-[200px] pointer-events-none">
              <div className="text-[10px] text-cyan-400 border-b border-aerospace-800 pb-1">CURSOR MATRIX TELEMETRY</div>
              <div className="flex justify-between">
                <span>Grid position:</span>
                <span className="text-white">[{cursorPos.x}m, {cursorPos.y}m]</span>
              </div>
              <div className="flex justify-between">
                <span>Elevation:</span>
                <span className="text-white">{results?.best_candidate ? `${hoverMetrics.elevation?.toFixed(1)}m` : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Horn Slope:</span>
                <span className="text-white">{results?.best_candidate ? `${hoverMetrics.slope?.toFixed(1)}°` : 'Requires DEM'}</span>
              </div>
              <div className="flex justify-between">
                <span>Hazard Score:</span>
                <span>{results ? hoverMetrics.hazard?.toFixed(2) : 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Uncertainty:</span>
                <span>{hoverMetrics.uncertainty}</span>
              </div>
            </div>
          )}

          {/* Color scale legend */}
          <div className="absolute bottom-4 right-4 bg-aerospace-950/80 border border-aerospace-750 px-3 py-2 rounded text-[10px] font-mono space-y-1.5 pointer-events-none">
            <div className="text-aerospace-400 text-center uppercase tracking-wide">Hazard Legend</div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-hazard-safe"></span> <span>0.0-0.2 SAFE</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-hazard-low"></span> <span>0.2-0.4 LOW</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-hazard-moderate"></span> <span>0.4-0.6 MOD</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-hazard-high"></span> <span>0.6-0.8 HIGH</span></div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-hazard-extreme"></span> <span>0.8-1.0 EXTREME</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
