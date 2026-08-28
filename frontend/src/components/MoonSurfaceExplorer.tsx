import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MapPin, Crosshair, Loader2, ChevronRight, Satellite, Layers } from 'lucide-react';

interface Region {
  id: string;
  name: string;
  terrain_type: string;
  description: string;
  center_lat: number;
  center_lon: number;
  difficulty: string;
  features: string[];
  crater_density: number;
  mean_slope_deg: number;
  shadow_pct: number;
  has_data: boolean;
  map_x_pct: number;
  map_y_pct: number;
}

interface MoonSurfaceExplorerProps {
  onRegionSelect: (regionId: string) => void;
  onAnalyze: (regionId: string) => void;
  onGoToDashboard?: () => void;
  analyzedRegions: Record<string, any>;
  analyzing: string | null;
  progress: number;
  stageText: string;
}

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: '#00ff88',
  medium: '#ffdd00',
  hard: '#ff8800',
  extreme: '#ff3333'
};

const TERRAIN_LABELS: Record<string, string> = {
  highland: 'Highland',
  crater_complex: 'Crater Complex',
  central_peak_crater: 'Central Peak',
  mare_basalt: 'Mare Basalt',
  young_impact: 'Young Impact',
  mare: 'Mare',
  polar_highland: 'Polar Highland',
  large_crater: 'Large Crater',
  large_mare: 'Large Mare',
  floor_fractured: 'Floor-Fractured',
  polar_peak: 'Polar Peak'
};

export default function MoonSurfaceExplorer({
  onRegionSelect, onAnalyze, onGoToDashboard, analyzedRegions, analyzing, progress, stageText
}: MoonSurfaceExplorerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [regions, setRegions] = useState<Region[]>([]);
  const [hoveredRegion, setHoveredRegion] = useState<Region | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [canvasSize, setCanvasSize] = useState({ w: 900, h: 900 });
  const animFrameRef = useRef(0);

  // Load regions from API
  useEffect(() => {
    fetch('/api/regions')
      .then(res => res.json())
      .then(data => setRegions(data))
      .catch(() => {
        // Fallback mock regions if API is down
        setRegions([]);
      });
  }, []);

  // Draw the moon surface
  const drawMoon = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const cx = W / 2;
    const cy = H / 2;
    const moonR = Math.min(W, H) * 0.42;
    const t = animFrameRef.current * 0.005;

    ctx.clearRect(0, 0, W, H);

    // Background starfield
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    const rng = (seed: number) => {
      let s = seed;
      return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
    };
    const rand = rng(12345);
    for (let i = 0; i < 200; i++) {
      const sx = rand() * W;
      const sy = rand() * H;
      const bright = rand() * 0.4 + 0.1;
      ctx.fillStyle = `rgba(200,220,255,${bright})`;
      ctx.fillRect(sx, sy, 1, 1);
    }

    // Moon disc gradient
    const moonGrad = ctx.createRadialGradient(cx - moonR * 0.15, cy - moonR * 0.15, moonR * 0.1, cx, cy, moonR);
    moonGrad.addColorStop(0, '#d4d0c8');
    moonGrad.addColorStop(0.3, '#b8b4a8');
    moonGrad.addColorStop(0.6, '#9a9688');
    moonGrad.addColorStop(0.85, '#7a7668');
    moonGrad.addColorStop(1.0, '#3a3830');

    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
    ctx.fillStyle = moonGrad;
    ctx.fill();

    // Add lunar texture (dark maria spots)
    const mariaSpots = [
      { x: 0.42, y: 0.30, r: 0.12, dark: 0.20 }, // Imbrium
      { x: 0.55, y: 0.32, r: 0.06, dark: 0.18 }, // Serenitatis
      { x: 0.60, y: 0.44, r: 0.08, dark: 0.15 }, // Tranquillitatis
      { x: 0.58, y: 0.55, r: 0.06, dark: 0.12 }, // Fecunditatis
      { x: 0.25, y: 0.40, r: 0.10, dark: 0.22 }, // Procellarum
      { x: 0.48, y: 0.48, r: 0.04, dark: 0.10 }, // Vaporum
      { x: 0.55, y: 0.38, r: 0.04, dark: 0.12 }, // Crisis
    ];

    for (const m of mariaSpots) {
      const mx = cx + (m.x - 0.5) * moonR * 2;
      const my = cy + (m.y - 0.5) * moonR * 2;
      const mr = m.r * moonR * 2;
      const dist = Math.sqrt((mx - cx) ** 2 + (my - cy) ** 2);
      if (dist + mr > moonR) continue;

      const grad = ctx.createRadialGradient(mx, my, 0, mx, my, mr);
      grad.addColorStop(0, `rgba(60,58,50,${m.dark})`);
      grad.addColorStop(0.7, `rgba(60,58,50,${m.dark * 0.5})`);
      grad.addColorStop(1, 'rgba(60,58,50,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(mx, my, mr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Crater textures
    const craterSpots = [
      { x: 0.45, y: 0.72, r: 0.04 }, // Tycho
      { x: 0.40, y: 0.44, r: 0.03 }, // Copernicus
      { x: 0.28, y: 0.32, r: 0.025 }, // Aristarchus
      { x: 0.44, y: 0.80, r: 0.05 }, // Clavius
    ];
    for (const c of craterSpots) {
      const crx = cx + (c.x - 0.5) * moonR * 2;
      const cry = cy + (c.y - 0.5) * moonR * 2;
      const crr = c.r * moonR * 2;
      ctx.beginPath();
      ctx.arc(crx, cry, crr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180,175,165,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Limb darkening
    const limbGrad = ctx.createRadialGradient(cx, cy, moonR * 0.7, cx, cy, moonR);
    limbGrad.addColorStop(0, 'rgba(0,0,0,0)');
    limbGrad.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
    ctx.fillStyle = limbGrad;
    ctx.fill();

    // Atmosphere glow
    ctx.beginPath();
    ctx.arc(cx, cy, moonR + 3, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200,210,220,0.08)';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Draw region markers
    for (const region of regions) {
      const rx = (region.map_x_pct / 100) * W;
      const ry = (region.map_y_pct / 100) * H;

      // Check if inside moon disc
      const distFromCenter = Math.sqrt((rx - cx) ** 2 + (ry - cy) ** 2);
      if (distFromCenter > moonR * 0.95) continue;

      const isHovered = hoveredRegion?.id === region.id;
      const isSelected = selectedRegion?.id === region.id;
      const isAnalyzed = !!analyzedRegions[region.id];
      const isAnalyzing = analyzing === region.id;
      const diffColor = DIFFICULTY_COLORS[region.difficulty] || '#00d4ff';

      // Pulse animation for analyzing
      const pulse = Math.sin(t * 3) * 0.3 + 0.7;

      // Region circle
      const baseR = isSelected ? 14 : isHovered ? 12 : 8;

      if (isAnalyzed) {
        // Draw heatmap indicator ring
        ctx.beginPath();
        ctx.arc(rx, ry, baseR + 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,255,136,0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      if (isAnalyzing) {
        // Scanning ring animation
        ctx.beginPath();
        ctx.arc(rx, ry, baseR + 8 + Math.sin(t * 5) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,212,255,${pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Outer ring
      ctx.beginPath();
      ctx.arc(rx, ry, baseR + 2, 0, Math.PI * 2);
      ctx.strokeStyle = isSelected ? '#00d4ff' : isHovered ? diffColor : 'rgba(0,212,255,0.4)';
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // Fill
      ctx.beginPath();
      ctx.arc(rx, ry, baseR, 0, Math.PI * 2);
      const alpha = isSelected ? 0.5 : isHovered ? 0.35 : isAnalyzed ? 0.25 : 0.15;
      ctx.fillStyle = isAnalyzed
        ? `rgba(0,255,136,${alpha})`
        : `rgba(0,212,255,${alpha})`;
      ctx.fill();

      // Center dot
      ctx.beginPath();
      ctx.arc(rx, ry, 2, 0, Math.PI * 2);
      ctx.fillStyle = isAnalyzed ? '#00ff88' : '#00d4ff';
      ctx.fill();

      // Label
      if (isHovered || isSelected) {
        ctx.font = 'bold 10px "Share Tech Mono", monospace';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        ctx.fillText(region.name.toUpperCase(), rx + baseR + 8, ry - 4);
        ctx.font = '9px "Share Tech Mono", monospace';
        ctx.fillStyle = diffColor;
        ctx.fillText(TERRAIN_LABELS[region.terrain_type] || region.terrain_type, rx + baseR + 8, ry + 8);
      }
    }

    // Grid overlay
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, moonR, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,212,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let i = -10; i <= 10; i++) {
      const y = cy + (i / 10) * moonR;
      ctx.beginPath();
      ctx.moveTo(cx - moonR, y);
      ctx.lineTo(cx + moonR, y);
      ctx.stroke();
    }
    for (let i = -10; i <= 10; i++) {
      const x = cx + (i / 10) * moonR;
      ctx.beginPath();
      ctx.moveTo(x, cy - moonR);
      ctx.lineTo(x, cy + moonR);
      ctx.stroke();
    }
    ctx.restore();

    animFrameRef.current++;
  }, [regions, hoveredRegion, selectedRegion, analyzedRegions, analyzing]);

  // Animation loop
  useEffect(() => {
    let raf: number;
    const animate = () => {
      drawMoon();
      raf = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(raf);
  }, [drawMoon]);

  // Mouse events
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    setMousePos({ x, y });

    // Find hovered region
    let found: Region | null = null;
    for (const region of regions) {
      const rx = (region.map_x_pct / 100) * canvas.width;
      const ry = (region.map_y_pct / 100) * canvas.height;
      const dist = Math.sqrt((x - rx) ** 2 + (y - ry) ** 2);
      if (dist < 20) {
        found = region;
        break;
      }
    }
    setHoveredRegion(found);
  };

  const handleClick = () => {
    if (hoveredRegion) {
      setSelectedRegion(hoveredRegion);
      onRegionSelect(hoveredRegion.id);
    }
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-black">
      {/* Moon Canvas */}
      <div className="flex-1 relative flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={canvasSize.w}
          height={canvasSize.h}
          className="cursor-crosshair"
          style={{ maxWidth: '100%', maxHeight: '100%' }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
        />

        {/* Top HUD */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start pointer-events-none">
          <div>
            <div className="hud-text text-xs" style={{ color: 'rgba(0,212,255,0.5)', letterSpacing: '0.2em' }}>
              NEXORA MOON SURFACE EXPLORER
            </div>
            <div className="hud-text text-lg font-bold" style={{ color: '#00d4ff', letterSpacing: '0.1em' }}>
              SELECT ANALYSIS REGION
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Satellite size={12} style={{ color: 'rgba(0,212,255,0.6)' }} />
              <span className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)' }}>
                TMC-2 + OHRC COVERAGE
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#00ff88', boxShadow: '0 0 4px #00ff88' }} />
              <span className="hud-text" style={{ fontSize: '9px', color: '#00ff88' }}>
                {Object.keys(analyzedRegions).length} ANALYZED
              </span>
            </div>
          </div>
        </div>

        {/* Hover tooltip */}
        {hoveredRegion && !selectedRegion && (
          <div
            className="absolute glass-panel p-3 pointer-events-none"
            style={{
              left: mousePos.x > canvasSize.w / 2 ? mousePos.x - 220 : mousePos.x + 30,
              top: Math.min(mousePos.y, canvasSize.h - 150),
              minWidth: 200,
              animation: 'fadeInUp 0.2s ease'
            }}
          >
            <div className="hud-text text-xs font-bold" style={{ color: '#00d4ff' }}>
              {hoveredRegion.name.toUpperCase()}
            </div>
            <div className="hud-text mt-1" style={{ fontSize: '9px', color: 'rgba(200,212,224,0.6)' }}>
              {hoveredRegion.description}
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 mt-2">
              {[
                ['LAT', `${hoveredRegion.center_lat.toFixed(2)}°`],
                ['LON', `${hoveredRegion.center_lon.toFixed(2)}°`],
                ['SLOPE', `${hoveredRegion.mean_slope_deg.toFixed(1)}°`],
                ['SHADOW', `${hoveredRegion.shadow_pct.toFixed(1)}%`],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between">
                  <span className="hud-text" style={{ fontSize: '8px', color: 'rgba(0,212,255,0.4)' }}>{k}</span>
                  <span className="hud-text" style={{ fontSize: '8px', color: '#c8d4e0' }}>{v}</span>
                </div>
              ))}
            </div>
            <div className="mt-1.5 text-center hud-text" style={{ fontSize: '8px', color: 'rgba(0,212,255,0.5)' }}>
              CLICK TO SELECT
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 glass-panel p-3 pointer-events-none">
          <div className="hud-text mb-2" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>
            DIFFICULTY LEGEND
          </div>
          {Object.entries(DIFFICULTY_COLORS).map(([k, c]) => (
            <div key={k} className="flex items-center gap-2 mb-0.5">
              <div className="w-2 h-2 rounded-full" style={{ background: c }} />
              <span className="hud-text" style={{ fontSize: '8px', color: 'rgba(200,212,224,0.6)' }}>
                {k.toUpperCase()}
              </span>
            </div>
          ))}
        </div>

        {/* Coordinates */}
        <div className="absolute bottom-4 right-4 hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.4)' }}>
          REGIONS: {regions.length} | ANALYZED: {Object.keys(analyzedRegions).length}
        </div>
      </div>

      {/* Right Panel - Region Details */}
      <div className="w-80 border-l border-aerospace-800/80 bg-aerospace-950/80 flex flex-col overflow-y-auto">
        {selectedRegion ? (
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="p-4 border-b border-aerospace-800/80 bg-aerospace-900/40">
              <div className="flex items-center gap-2 mb-1">
                <Crosshair size={14} style={{ color: '#00d4ff' }} />
                <span className="hud-text text-xs font-bold" style={{ color: '#00d4ff', letterSpacing: '0.1em' }}>
                  SELECTED REGION
                </span>
              </div>
              <div className="display-text text-sm font-bold text-white" style={{ letterSpacing: '0.05em' }}>
                {selectedRegion.name}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="hud-text px-1.5 py-0.5 rounded"
                  style={{
                    fontSize: '8px',
                    background: `${DIFFICULTY_COLORS[selectedRegion.difficulty]}15`,
                    border: `1px solid ${DIFFICULTY_COLORS[selectedRegion.difficulty]}40`,
                    color: DIFFICULTY_COLORS[selectedRegion.difficulty]
                  }}
                >
                  {selectedRegion.difficulty.toUpperCase()}
                </span>
                <span className="hud-text px-1.5 py-0.5 rounded" style={{
                  fontSize: '8px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff'
                }}>
                  {TERRAIN_LABELS[selectedRegion.terrain_type] || selectedRegion.terrain_type}
                </span>
              </div>
            </div>

            {/* Details */}
            <div className="p-4 space-y-3 flex-1">
              <p className="hud-text" style={{ fontSize: '10px', color: 'rgba(200,212,224,0.6)', lineHeight: 1.5 }}>
                {selectedRegion.description}
              </p>

              <div className="space-y-1.5">
                <div className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>
                  TERRAIN METRICS
                </div>
                {[
                  ['Latitude', `${selectedRegion.center_lat.toFixed(3)}°`],
                  ['Longitude', `${selectedRegion.center_lon.toFixed(3)}°`],
                  ['Mean Slope', `${selectedRegion.mean_slope_deg.toFixed(1)}°`],
                  ['Shadow Coverage', `${selectedRegion.shadow_pct.toFixed(1)}%`],
                  ['Crater Density', `${(selectedRegion.crater_density * 100).toFixed(0)}%`],
                ].map(([k, v]) => (
                  <div key={k} className="flex justify-between hud-text" style={{ fontSize: '10px' }}>
                    <span style={{ color: 'rgba(200,212,224,0.5)' }}>{k}</span>
                    <span style={{ color: '#c8d4e0' }}>{v}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5">
                <div className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>
                  TERRAIN FEATURES
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedRegion.features.map(f => (
                    <span key={f} className="hud-text px-1.5 py-0.5 rounded" style={{
                      fontSize: '8px', background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)', color: 'rgba(200,212,224,0.6)'
                    }}>
                      {f.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>

              {/* TMC Preview */}
              {selectedRegion.has_data && (
                <div className="space-y-1.5">
                  <div className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>
                    TMC-2 IMAGERY (5m)
                  </div>
                  <div className="aspect-square bg-black rounded border border-aerospace-800 overflow-hidden relative">
                    <img
                      src={`/api/region_data/${selectedRegion.id}/tmc_tile.png`}
                      alt="TMC Tile"
                      className="w-full h-full object-cover"
                      style={{ imageRendering: 'pixelated' }}
                    />
                    <div className="absolute bottom-1 left-1 hud-text px-1 py-0.5 rounded" style={{
                      fontSize: '7px', background: 'rgba(0,0,0,0.8)', color: 'rgba(0,212,255,0.6)'
                    }}>
                      100×100 px | 5m/px
                    </div>
                  </div>
                </div>
              )}

              {/* Analysis result or CTA */}
              {analyzedRegions[selectedRegion.id] ? (
                <div className="p-3 rounded border space-y-2" style={{ background: 'rgba(0,255,136,0.05)', borderColor: 'rgba(0,255,136,0.3)' }}>
                  <div className="hud-text text-xs font-bold" style={{ color: '#00ff88' }}>
                    1M ANALYSIS COMPLETE
                  </div>
                  <div className="hud-text" style={{ fontSize: '9px', color: 'rgba(200,212,224,0.6)' }}>
                    Super-resolution (1m) & hazard map generated for {selectedRegion.name}.
                  </div>
                  {onGoToDashboard && (
                    <button
                      onClick={onGoToDashboard}
                      className="w-full py-2 font-bold rounded flex items-center justify-center gap-1.5 transition mt-1"
                      style={{
                        background: 'linear-gradient(135deg, rgba(0,255,136,0.2), rgba(0,212,255,0.2))',
                        border: '1px solid #00ff88',
                        color: '#00ff88',
                        fontFamily: 'var(--font-display)',
                        fontSize: '10px',
                        letterSpacing: '0.1em'
                      }}
                    >
                      VIEW 1M DASHBOARD →
                    </button>
                  )}
                </div>
              ) : analyzing === selectedRegion.id ? (
                <div className="p-3 rounded border" style={{ background: 'rgba(0,212,255,0.05)', borderColor: 'rgba(0,212,255,0.3)' }}>
                  <div className="flex items-center gap-2">
                    <Loader2 size={14} className="animate-spin" style={{ color: '#00d4ff' }} />
                    <span className="hud-text text-xs font-bold" style={{ color: '#00d4ff' }}>ANALYZING...</span>
                  </div>
                  <div className="w-full bg-aerospace-950 rounded-full h-1 mt-2">
                    <div className="h-1 rounded-full transition-all duration-300" style={{
                      width: `${progress}%`, background: 'linear-gradient(90deg, #0066ff, #00d4ff)'
                    }} />
                  </div>
                  <div className="hud-text mt-1" style={{ fontSize: '8px', color: 'rgba(0,212,255,0.6)' }}>
                    {stageText}
                  </div>
                </div>
              ) : null}
            </div>

            {/* Action button */}
            <div className="p-4 border-t border-aerospace-800/80">
              {!analyzedRegions[selectedRegion.id] && analyzing !== selectedRegion.id && (
                <button
                  onClick={() => onAnalyze(selectedRegion.id)}
                  className="w-full py-2.5 font-bold rounded flex items-center justify-center gap-2 transition"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,100,255,0.3), rgba(0,212,255,0.3))',
                    border: '1px solid rgba(0,212,255,0.5)',
                    color: '#00d4ff',
                    fontFamily: 'var(--font-display)',
                    fontSize: '11px',
                    letterSpacing: '0.15em'
                  }}
                >
                  <Crosshair size={14} />
                  RUN NEXORA ANALYSIS
                </button>
              )}
              <button
                onClick={() => { setSelectedRegion(null); }}
                className="w-full mt-2 py-1.5 hud-text text-xs rounded transition"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(200,212,224,0.5)'
                }}
              >
                DESELECT REGION
              </button>
            </div>
          </div>
        ) : (
          /* No region selected — show region list */
          <div className="p-4">
            <div className="hud-text text-xs mb-3" style={{ color: 'rgba(0,212,255,0.5)', letterSpacing: '0.15em' }}>
              <Layers size={12} className="inline mr-1" style={{ verticalAlign: 'middle' }} />
              AVAILABLE REGIONS ({regions.length})
            </div>
            <div className="space-y-1.5">
              {regions.map(r => {
                const isAnalyzed = !!analyzedRegions[r.id];
                return (
                  <button
                    key={r.id}
                    onClick={() => { setSelectedRegion(r); onRegionSelect(r.id); }}
                    className="w-full text-left px-3 py-2 rounded transition border"
                    style={{
                      background: isAnalyzed ? 'rgba(0,255,136,0.04)' : 'rgba(0,212,255,0.03)',
                      borderColor: isAnalyzed ? 'rgba(0,255,136,0.2)' : 'rgba(0,212,255,0.1)',
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <span className="hud-text text-xs" style={{ color: isAnalyzed ? '#00ff88' : '#c8d4e0' }}>
                        {r.name}
                      </span>
                      <ChevronRight size={12} style={{ color: 'rgba(0,212,255,0.4)' }} />
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="hud-text" style={{ fontSize: '8px', color: DIFFICULTY_COLORS[r.difficulty] }}>
                        {r.difficulty.toUpperCase()}
                      </span>
                      <span className="hud-text" style={{ fontSize: '8px', color: 'rgba(200,212,224,0.4)' }}>
                        {TERRAIN_LABELS[r.terrain_type] || r.terrain_type}
                      </span>
                      {isAnalyzed && (
                        <span className="hud-text" style={{ fontSize: '7px', color: '#00ff88' }}>ANALYZED</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
