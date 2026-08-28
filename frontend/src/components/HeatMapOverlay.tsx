import React, { useRef, useEffect, useState } from 'react';
import { Crosshair, Navigation, Flag } from 'lucide-react';

interface HeatMapOverlayProps {
  regionId: string;
  runData: any;
  width?: number;
  height?: number;
}

export default function HeatMapOverlay({ regionId, runData, width = 500, height = 500 }: HeatMapOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [heatmapImg, setHeatmapImg] = useState<HTMLImageElement | null>(null);
  const [tmcImg, setTmcImg] = useState<HTMLImageElement | null>(null);
  const [showPath, setShowPath] = useState(true);
  const [showCandidates, setShowCandidates] = useState(true);
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

  const results = runData?.results;
  const candidates = results?.candidates || [];
  const path = results?.navigation_astar?.path || [];
  const bestCandidate = results?.best_candidate;

  // Load images
  useEffect(() => {
    if (!results) return;

    // Load heatmap
    if (results.files?.hazard_map_png) {
      const img = new Image();
      img.src = results.files.hazard_map_png;
      img.onload = () => setHeatmapImg(img);
    }

    // Load TMC tile
    const tmc = new Image();
    tmc.src = `/api/region_data/${regionId}/tmc_tile.png`;
    tmc.onload = () => setTmcImg(tmc);
  }, [results, regionId]);

  // Draw heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);

    // Background
    ctx.fillStyle = '#0a0e14';
    ctx.fillRect(0, 0, width, height);

    // Draw TMC base (dimmed)
    if (tmcImg) {
      ctx.globalAlpha = 0.3;
      ctx.drawImage(tmcImg, 0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }

    // Draw heatmap overlay
    if (heatmapImg) {
      ctx.globalAlpha = 0.85;
      ctx.drawImage(heatmapImg, 0, 0, width, height);
      ctx.globalAlpha = 1.0;
    }

    // Draw navigation path
    if (showPath && path.length > 1) {
      // Path shadow
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(0,100,255,0.3)';
      ctx.lineWidth = 5;
      path.forEach((pt: number[], idx: number) => {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();

      // Path main line
      ctx.beginPath();
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 2;
      ctx.shadowColor = '#00d4ff';
      ctx.shadowBlur = 6;
      path.forEach((pt: number[], idx: number) => {
        if (idx === 0) ctx.moveTo(pt[0], pt[1]);
        else ctx.lineTo(pt[0], pt[1]);
      });
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Start marker
      const startPt = path[0];
      ctx.beginPath();
      ctx.arc(startPt[0], startPt[1], 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffaa00';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.font = 'bold 9px "Share Tech Mono", monospace';
      ctx.fillStyle = '#ffaa00';
      ctx.fillText('START', startPt[0] + 10, startPt[1] + 3);

      // End marker
      const endPt = path[path.length - 1];
      ctx.beginPath();
      ctx.arc(endPt[0], endPt[1], 6, 0, Math.PI * 2);
      ctx.fillStyle = '#00ff88';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw landing candidates
    if (showCandidates && candidates.length > 0) {
      candidates.forEach((cand: any, idx: number) => {
        const isBest = idx === 0;
        const color = isBest ? '#00ff88' : '#84cc16';

        // Safety buffer
        ctx.beginPath();
        ctx.arc(cand.x, cand.y, 12, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}50`;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);

        // Footprint circle
        ctx.beginPath();
        ctx.arc(cand.x, cand.y, 10, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = isBest ? 2.5 : 1.5;
        ctx.stroke();

        // Fill
        ctx.beginPath();
        ctx.arc(cand.x, cand.y, 10, 0, Math.PI * 2);
        ctx.fillStyle = `${color}15`;
        ctx.fill();

        // Crosshair
        ctx.beginPath();
        ctx.moveTo(cand.x - 4, cand.y);
        ctx.lineTo(cand.x + 4, cand.y);
        ctx.moveTo(cand.x, cand.y - 4);
        ctx.lineTo(cand.x, cand.y + 4);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Label
        ctx.font = `bold 8px "Share Tech Mono", monospace`;
        ctx.fillStyle = '#fff';
        ctx.fillText(cand.id || `Z-${idx + 1}`, cand.x + 14, cand.y + 3);

        // Score
        if (isBest) {
          ctx.font = '7px "Share Tech Mono", monospace';
          ctx.fillStyle = '#00ff88';
          ctx.fillText(`${cand.score?.toFixed(0) || '?'}/100`, cand.x + 14, cand.y + 12);
        }
      });
    }

    // Cursor crosshair
    if (cursorPos) {
      ctx.strokeStyle = 'rgba(0,212,255,0.3)';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(cursorPos.x, 0);
      ctx.lineTo(cursorPos.x, height);
      ctx.moveTo(0, cursorPos.y);
      ctx.lineTo(width, cursorPos.y);
      ctx.stroke();
    }
  }, [heatmapImg, tmcImg, showPath, showCandidates, path, candidates, cursorPos, width, height]);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * width);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * height);
    if (x >= 0 && x < width && y >= 0 && y < height) {
      setCursorPos({ x, y });
    }
  };

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 hud-text" style={{ fontSize: '10px', color: 'rgba(200,212,224,0.6)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showCandidates} onChange={e => setShowCandidates(e.target.checked)} className="accent-cyan-500" />
          Landing Zones
        </label>
        <label className="flex items-center gap-1.5 hud-text" style={{ fontSize: '10px', color: 'rgba(200,212,224,0.6)', cursor: 'pointer' }}>
          <input type="checkbox" checked={showPath} onChange={e => setShowPath(e.target.checked)} className="accent-cyan-500" />
          Navigation Path
        </label>
      </div>

      {/* Canvas */}
      <div className="relative bg-black rounded border border-aerospace-800 overflow-hidden" style={{ maxWidth: width }}>
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          className="cursor-crosshair"
          style={{ width: '100%', height: 'auto' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setCursorPos(null)}
        />

        {/* Cursor info */}
        {cursorPos && (
          <div className="absolute top-2 left-2 glass-panel px-2 py-1 pointer-events-none" style={{ minWidth: 120 }}>
            <div className="hud-text" style={{ fontSize: '8px', color: 'rgba(0,212,255,0.5)' }}>CURSOR</div>
            <div className="hud-text" style={{ fontSize: '9px', color: '#c8d4e0' }}>
              [{cursorPos.x}m, {cursorPos.y}m]
            </div>
          </div>
        )}

        {/* Best zone indicator */}
        {bestCandidate && (
          <div className="absolute bottom-2 right-2 glass-panel px-2 py-1 pointer-events-none">
            <div className="hud-text" style={{ fontSize: '8px', color: '#00ff88' }}>
              BEST: {bestCandidate.id} ({bestCandidate.score?.toFixed(0)}/100)
            </div>
          </div>
        )}

        {/* Color legend */}
        <div className="absolute bottom-2 left-2 glass-panel px-2 py-1.5 pointer-events-none">
          <div className="hud-text mb-1" style={{ fontSize: '7px', color: 'rgba(0,212,255,0.5)' }}>HAZARD</div>
          <div className="flex items-center gap-0.5">
            <div className="w-8 h-1.5 rounded-sm" style={{ background: 'linear-gradient(90deg, #00ff88, #88ff00, #ffdd00, #ff8800, #ff3333)' }} />
          </div>
          <div className="flex justify-between" style={{ width: 32 }}>
            <span className="hud-text" style={{ fontSize: '6px', color: 'rgba(200,212,224,0.4)' }}>SAFE</span>
            <span className="hud-text" style={{ fontSize: '6px', color: 'rgba(200,212,224,0.4)' }}>HIGH</span>
          </div>
        </div>
      </div>
    </div>
  );
}
