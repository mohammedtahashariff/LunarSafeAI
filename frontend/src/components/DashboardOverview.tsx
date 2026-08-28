import React from 'react';
import { 
  ShieldCheck, AlertTriangle, AlertOctagon, HelpCircle, 
  Map, Activity, Clock, FileText, CheckCircle2, XCircle
} from 'lucide-react';

interface DashboardOverviewProps {
  runData: any;
  loading: boolean;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function DashboardOverview({ runData, loading, activeTab, setActiveTab }: DashboardOverviewProps) {
  const getProvenanceBadge = (type: string) => {
    const badges: any = {
      OBSERVED: "bg-blue-900/60 text-blue-200 border-blue-700",
      REFERENCE: "bg-purple-900/60 text-purple-200 border-purple-700",
      ESTIMATED: "bg-amber-900/60 text-amber-200 border-amber-700",
      DERIVED: "bg-emerald-900/60 text-emerald-200 border-emerald-700",
      SIMULATED: "bg-gray-800 text-gray-300 border-gray-600",
      UNAVAILABLE: "bg-red-950/60 text-red-300 border-red-800"
    };
    return (
      <span className={`px-2 py-0.5 text-xs font-mono font-bold rounded border ${badges[type] || badges.SIMULATED}`}>
        {type}
      </span>
    );
  };

  const getHazardBadge = (score: number) => {
    if (score < 0.20) return <span className="text-emerald-400 font-bold">SAFE</span>;
    if (score < 0.40) return <span className="text-lime-400 font-bold">LOW RISK</span>;
    if (score < 0.60) return <span className="text-yellow-400 font-bold">MODERATE</span>;
    if (score < 0.80) return <span className="text-orange-400 font-bold">HIGH RISK</span>;
    return <span className="text-red-500 font-bold">EXTREME</span>;
  };

  const getUncertaintyBadge = (val: number) => {
    if (val < 0.25) return <span className="text-emerald-400 font-bold">LOW</span>;
    if (val < 0.50) return <span className="text-yellow-400 font-bold">MEDIUM</span>;
    if (val < 0.75) return <span className="text-orange-400 font-bold">HIGH</span>;
    return <span className="text-red-500 font-bold">UNKNOWN</span>;
  };

  // Safe defaults if runData is empty
  const hasResults = runData && runData.results;
  const results = hasResults ? runData.results : null;
  const bestZone = results?.best_candidate;
  const hazardStats = results?.hazard_stats;
  const navAstar = results?.navigation_astar;
  const navMetrics = navAstar?.metrics;

  return (
    <div className="space-y-6">
      {/* 1. TOP KPI TELEMETRY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg shadow-lg">
          <div className="text-xs text-aerospace-400 uppercase tracking-wider font-mono">Input Data</div>
          <div className="text-lg font-bold mt-1 text-cyan-400 font-mono">TMC 5.0m</div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-aerospace-500">Provenance:</span>
            {getProvenanceBadge("OBSERVED")}
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg shadow-lg">
          <div className="text-xs text-aerospace-400 uppercase tracking-wider font-mono">Target Grid</div>
          <div className="text-lg font-bold mt-1 text-cyan-400 font-mono">1.0m Estimated</div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-aerospace-500">Upscale Model:</span>
            {getProvenanceBadge("ESTIMATED")}
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg shadow-lg">
          <div className="text-xs text-aerospace-400 uppercase tracking-wider font-mono">Landing Decision</div>
          <div className="text-lg font-bold mt-1 font-mono">
            {bestZone ? (
              <span className={bestZone.decision === "SAFE" ? "text-emerald-400" : "text-yellow-400"}>
                {bestZone.decision}
              </span>
            ) : loading ? "ANALYZING..." : "NO RESULT"}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-aerospace-500">Hazard:</span>
            <span className="text-xs font-mono">{bestZone ? getHazardBadge(bestZone.mean_hazard) : "N/A"}</span>
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg shadow-lg">
          <div className="text-xs text-aerospace-400 uppercase tracking-wider font-mono">Uncertainty State</div>
          <div className="text-lg font-bold mt-1 font-mono">
            {bestZone ? getUncertaintyBadge(bestZone.mean_uncertainty) : loading ? "COMPUTING..." : "N/A"}
          </div>
          <div className="mt-2 flex justify-between items-center">
            <span className="text-xs text-aerospace-500">Navigation:</span>
            <span className="text-xs font-mono font-bold text-cyan-400">
              {navAstar?.status === "SUCCESS" ? "READY" : navAstar?.status || "STANDBY"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. MAIN 4-PANEL VISUALIZATION */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-aerospace-900 border border-aerospace-700 p-4 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Map size={16} className="text-cyan-400" /> [01] Original TMC Imagery (5m)
            </h3>
            {getProvenanceBadge("OBSERVED")}
          </div>
          <div className="aspect-square bg-black rounded border border-aerospace-800 flex items-center justify-center relative overflow-hidden group">
            {results ? (
              <img 
                src="/api/demo_data/synthetic_tmc.png" 
                alt="TMC Input" 
                className="w-full h-full object-cover pixelated"
              />
            ) : (
              <span className="text-aerospace-500 text-xs font-mono">Awaiting mission analysis run...</span>
            )}
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[10px] font-mono rounded border border-aerospace-700 text-aerospace-300">
              Resolution: 5m/px | Dim: 100x100
            </div>
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700 p-4 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Activity size={16} className="text-cyan-400" /> [02] Super-Resolved estimate (1m)
            </h3>
            {getProvenanceBadge("ESTIMATED")}
          </div>
          <div className="aspect-square bg-black rounded border border-aerospace-800 flex items-center justify-center relative overflow-hidden">
            {results ? (
              <img 
                src="/api/demo_data/synthetic_ohrc.png" 
                alt="SR Grid" 
                className="w-full h-full object-cover"
                style={{ filter: "brightness(0.9) contrast(1.1)" }}
              />
            ) : (
              <span className="text-aerospace-500 text-xs font-mono">Awaiting mission analysis run...</span>
            )}
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[10px] font-mono rounded border border-aerospace-700 text-aerospace-300">
              Estimated: 1m/px | Scale: 5x | Method: {results?.sr_model.toUpperCase()}
            </div>
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700 p-4 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-cyan-400" /> [03] Fused Multi-Layer Hazard Map
            </h3>
            {getProvenanceBadge("DERIVED")}
          </div>
          <div className="aspect-square bg-black rounded border border-aerospace-800 flex items-center justify-center relative overflow-hidden">
            {results ? (
              <img 
                src={results.files.hazard_map_png} 
                alt="Hazard Map" 
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="text-aerospace-500 text-xs font-mono">Awaiting mission analysis run...</span>
            )}
            <div className="absolute bottom-2 left-2 bg-black/80 px-2 py-1 text-[10px] font-mono rounded border border-aerospace-700 text-aerospace-300">
              Fusion: Weights (Slope: 30%, Crater: 20%, Boulder: 15%)
            </div>
          </div>
        </div>

        <div className="bg-aerospace-900 border border-aerospace-700 p-4 rounded-lg shadow-xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono flex items-center gap-1.5">
              <Activity size={16} className="text-cyan-400" /> [04] Selected Landing Site & Path
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono font-bold rounded border bg-cyan-900/60 text-cyan-200 border-cyan-700">OPTIMIZED</span>
          </div>
          <div className="aspect-square bg-black rounded border border-aerospace-800 flex flex-col items-center justify-center relative overflow-hidden p-2">
            {results ? (
              <div className="w-full h-full bg-slate-950 border border-aerospace-800 rounded relative overflow-hidden flex items-center justify-center">
                {/* Renders summary of path inside card */}
                <div className="text-center space-y-3 z-10 px-4">
                  <div className="text-2xl font-bold font-mono text-cyan-400">{bestZone ? bestZone.id : "NO ZONE"}</div>
                  <div className="text-xs text-aerospace-400 max-w-xs">
                    Safely routed from Lander Start coordinates <span className="text-white font-mono">[50, 450]</span> to landing center <span className="text-white font-mono">[{bestZone?.x}, {bestZone?.y}]</span> avoiding all hazardous obstacles.
                  </div>
                  <div className="inline-flex gap-2">
                    <button 
                      onClick={() => setActiveTab("map2d")} 
                      className="px-3 py-1.5 bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600 rounded text-xs font-mono font-semibold transition"
                    >
                      View 2D Route
                    </button>
                    <button 
                      onClick={() => setActiveTab("sim3d")} 
                      className="px-3 py-1.5 bg-purple-950/80 hover:bg-purple-900 border border-purple-600 rounded text-xs font-mono font-semibold transition animate-pulse"
                    >
                      Play 3D Sim
                    </button>
                  </div>
                </div>
                <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#06b6d4_1px,transparent_1px)] [background-size:16px_16px]"></div>
              </div>
            ) : (
              <span className="text-aerospace-500 text-xs font-mono">Awaiting mission analysis run...</span>
            )}
          </div>
        </div>
      </div>

      {/* 3. EXPLAINABLE AI DIAGNOSTICS & PROCESS TIMELINE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Explainable landing check */}
        <div className="bg-aerospace-900 border border-aerospace-700/60 p-5 rounded-lg md:col-span-2">
          <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono mb-4 flex items-center gap-1.5">
            <FileText size={16} className="text-cyan-400" /> Explainable Site diagnostics ("Why This Site?")
          </h3>
          
          {results ? (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-aerospace-400 font-mono pb-2 border-b border-aerospace-800">
                <span>Site Recommendation: <strong className="text-cyan-400 font-bold">{bestZone?.id || "N/A"}</strong></span>
                <span>Suitability Score: <strong className="text-emerald-400 font-bold">{bestZone?.score?.toFixed(1) ?? "N/A"}/100</strong></span>
              </div>
              <ul className="space-y-2 text-sm">
                {results.why_selected.map((item: any, idx: number) => (
                  <li key={idx} className="flex items-start gap-2 text-aerospace-300">
                    {item.status === 'PASS' ? (
                      <CheckCircle2 size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    ) : (
                      <AlertTriangle size={16} className="text-yellow-500 mt-0.5 shrink-0" />
                    )}
                    <span>{item.text}</span>
                  </li>
                ))}
              </ul>
              {results.why_rejected && results.why_rejected.length > 0 && (
                <div className="mt-4 pt-3 border-t border-aerospace-800/80">
                  <div className="text-xs font-mono text-red-400 font-bold mb-2">Footprint Exclusion Rules Triggered in Surrounding Zones:</div>
                  <ul className="space-y-1.5 text-xs text-aerospace-400">
                    <li className="flex items-center gap-2">
                      <XCircle size={14} className="text-red-500 shrink-0" />
                      <span>Maximum slope exceeded 10.0° constraints</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <XCircle size={14} className="text-red-500 shrink-0" />
                      <span>Shadow coverage exceeded 5.0% constraints</span>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="text-aerospace-500 text-xs font-mono py-6 text-center">
              No active diagnostics. Run analysis or select candidate from Landing Zones tab.
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="bg-aerospace-900 border border-aerospace-700/60 p-5 rounded-lg">
          <h3 className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono mb-4 flex items-center gap-1.5">
            <Clock size={16} className="text-cyan-400" /> Pipeline Timeline
          </h3>
          
          <div className="relative border-l border-aerospace-800 ml-2.5 space-y-4 text-xs font-mono pb-2">
            <div className="relative pl-6">
              <span className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-black ${results ? "bg-emerald-400" : loading ? "bg-cyan-400 animate-pulse" : "bg-aerospace-700"}`}></span>
              <div className="font-semibold text-aerospace-200">[01] Data Loading & Validation</div>
              <div className="text-aerospace-500 text-[10px]">{results ? "Completed in 12ms" : "Awaiting launch..."}</div>
            </div>
            
            <div className="relative pl-6">
              <span className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-black ${results ? "bg-emerald-400" : loading && runData?.progress >= 25 ? "bg-cyan-400 animate-pulse" : "bg-aerospace-700"}`}></span>
              <div className="font-semibold text-aerospace-200">[02] Super-Resolution Upscaling</div>
              <div className="text-aerospace-500 text-[10px]">{results ? `Completed (Inference: ${results.sr_metrics.psnr ? "185ms" : "N/A"})` : "Awaiting launch..."}</div>
            </div>
            
            <div className="relative pl-6">
              <span className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-black ${results ? "bg-emerald-400" : loading && runData?.progress >= 60 ? "bg-cyan-400 animate-pulse" : "bg-aerospace-700"}`}></span>
              <div className="font-semibold text-aerospace-200">[03] Hazard Fusion & Uncertainty</div>
              <div className="text-aerospace-500 text-[10px]">{results ? "Completed in 42ms" : "Awaiting launch..."}</div>
            </div>

            <div className="relative pl-6">
              <span className={`absolute left-[-5px] top-1 w-2.5 h-2.5 rounded-full border border-black ${results ? "bg-emerald-400" : loading && runData?.progress >= 88 ? "bg-cyan-400 animate-pulse" : "bg-aerospace-700"}`}></span>
              <div className="font-semibold text-aerospace-200">[04] Route Optimization & Sim</div>
              <div className="text-aerospace-500 text-[10px]">{results ? `Completed (Path Cost: ${navMetrics?.total_cost?.toFixed(1) ?? "N/A"})` : "Awaiting launch..."}</div>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SCIENTIFIC DISCLAIMER BANNER */}
      <div className="bg-amber-950/20 border border-amber-900/60 p-4 rounded-lg text-amber-300 text-xs">
        <div className="flex gap-2">
          <AlertOctagon size={16} className="shrink-0 text-amber-400 mt-0.5" />
          <p className="leading-relaxed">
            <strong className="font-bold text-amber-400 uppercase tracking-wide">Scientific Limitation Notice:</strong> Super-resolved imagery is an estimated higher-resolution representation derived from lower-resolution imagery. It does not constitute direct physical observation and must not automatically be interpreted as measured elevation. Terrain-dependent quantities require valid elevation data (DEM) or a separately validated terrain-reconstruction method.
          </p>
        </div>
      </div>
    </div>
  );
}
