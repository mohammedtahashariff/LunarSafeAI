import React, { useState, useEffect, useRef, useCallback } from 'react';
import { gsap } from 'gsap';
import { 
  Play, Compass, Settings, Database, Sliders, 
  Map, Activity, ShieldCheck, ActivitySquare, Info, 
  RotateCcw, Save, Loader2, AlertCircle, FileText, Globe
} from 'lucide-react';

import { Canvas } from "@react-three/fiber";
import LoadingScreen from "./components/LoadingScreen";
import HUDOverlay from "./components/HUDOverlay";
import LunarScene from "./components/LunarScene";

import DashboardOverview from './components/DashboardOverview';
import InteractiveMap2D from './components/InteractiveMap2D';
import TerrainViewer3D from './components/TerrainViewer3D';
import EvaluationPanel from './components/EvaluationPanel';
import DatasetPanel from './components/DatasetPanel';
import MoonSurfaceExplorer from './components/MoonSurfaceExplorer';
import HeatMapOverlay from './components/HeatMapOverlay';

export type MissionPhase =
  | "loading"
  | "deep_space"
  | "moon_approach"
  | "lander_arrival"
  | "ai_activation"
  | "terrain_scanning"
  | "hazard_detection"
  | "ai_decision"
  | "safe_zone"
  | "landing"
  | "success";

export default function App() {
  const [view, setView] = useState<'landing' | 'explorer' | 'dashboard'>('landing');

  // Explorer state
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [analyzedRegions, setAnalyzedRegions] = useState<Record<string, any>>({});
  const [analyzingRegion, setAnalyzingRegion] = useState<string | null>(null);
  const [explorerProgress, setExplorerProgress] = useState(0);
  const [explorerStageText, setExplorerStageText] = useState('');

  // Landing Page States
  const [phase, setPhase] = useState<MissionPhase>("loading");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [logoClicks, setLogoClicks] = useState(0);
  const [missionOverride, setMissionOverride] = useState(false);
  const scrollRef = useRef(0);
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  const startAutoPlay = useCallback(() => {
    if (tweenRef.current) {
      tweenRef.current.kill();
    }
    const obj = { value: scrollRef.current };
    tweenRef.current = gsap.to(obj, {
      value: 1,
      duration: 15, // Smooth 15 seconds descent animation
      ease: "power1.inOut",
      onUpdate: () => {
        scrollRef.current = obj.value;
        setScrollProgress(obj.value);
      }
    });
  }, []);

  const watchAIAnalysis = useCallback(() => {
    if (tweenRef.current) {
      tweenRef.current.kill();
    }
    const obj = { value: scrollRef.current };
    tweenRef.current = gsap.to(obj, {
      value: 0.65, // animate to scanning phase
      duration: 8,
      ease: "power1.out",
      onUpdate: () => {
        scrollRef.current = obj.value;
        setScrollProgress(obj.value);
      }
    });
  }, []);

  // Cleanup tween on unmount
  useEffect(() => {
    return () => {
      if (tweenRef.current) {
        tweenRef.current.kill();
      }
    };
  }, []);

  // Dashboard Overview & Telemetry States
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [loading, setLoading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [stageText, setStageText] = useState<string>('');
  
  // App & Run Registry States
  const [activeRun, setActiveRun] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string>('edsr');
  const [runHistory, setRunHistory] = useState<any[]>([]);
  
  // Settings Panel Config
  const [settings, setSettings] = useState<any>({
    resolution: { tmc: 5.0, target_grid: 1.0, ohrc: 0.25 },
    landing: { footprint_size_m: 20, safety_margin_m: 2, max_slope_deg: 10.0, max_shadow_percent: 5.0, max_roughness: 0.40, max_hazard: 0.40 },
    hazards: { slope_weight: 0.30, crater_weight: 0.20, boulder_weight: 0.15, shadow_weight: 0.10, roughness_weight: 0.15, elevation_weight: 0.10 },
    navigation: { algorithm: 'astar', hazard_penalty: 5.0, uncertainty_penalty: 5.0, slope_penalty: 3.0, roughness_penalty: 2.0, shadow_penalty: 2.0, unknown_blocked: true, extreme_blocked: true, emergency_abort_threshold: 0.80 }
  });
  
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [toast, setToast] = useState<string | null>(null);

  // Fake loading progress for Landing Page
  useEffect(() => {
    if (view !== 'landing') return;
    let current = 0;
    const interval = setInterval(() => {
      current += Math.random() * 3 + 1;
      if (current >= 100) {
        current = 100;
        clearInterval(interval);
        setTimeout(() => setLoadingDone(true), 800);
      }
      setLoadProgress(Math.min(current, 100));
    }, 60);
    return () => clearInterval(interval);
  }, [view]);

  const enterMission = useCallback(() => {
    setPhase("deep_space");
  }, []);

  // Landing Page Scroll Events
  useEffect(() => {
    if (view !== 'landing' || phase === "loading") return;

    const handleWheel = (e: WheelEvent) => {
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
      e.preventDefault();
      const delta = e.deltaY * 0.0003;
      scrollRef.current = Math.max(0, Math.min(1, scrollRef.current + delta));
      setScrollProgress(scrollRef.current);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    // Touch support for scroll on mobile
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (tweenRef.current) {
        tweenRef.current.kill();
        tweenRef.current = null;
      }
      const dy = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      scrollRef.current = Math.max(0, Math.min(1, scrollRef.current + dy * 0.001));
      setScrollProgress(scrollRef.current);
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [phase, view]);

  // Derive phase from scroll
  useEffect(() => {
    if (view !== 'landing' || phase === "loading") return;
    const s = scrollProgress;
    let newPhase: MissionPhase = "deep_space";
    if (s >= 0.95) newPhase = "success";
    else if (s >= 0.9) newPhase = "landing";
    else if (s >= 0.8) newPhase = "safe_zone";
    else if (s >= 0.7) newPhase = "ai_decision";
    else if (s >= 0.6) newPhase = "hazard_detection";
    else if (s >= 0.45) newPhase = "terrain_scanning";
    else if (s >= 0.3) newPhase = "ai_activation";
    else if (s >= 0.15) newPhase = "lander_arrival";
    else if (s >= 0.05) newPhase = "moon_approach";
    else newPhase = "deep_space";
    setPhase(newPhase);
  }, [scrollProgress, phase, view]);

  // Mouse move parallax for Landing Page
  useEffect(() => {
    if (view !== 'landing') return;
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [view]);

  const handleLogoClick = useCallback(() => {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 3) {
      setMissionOverride(true);
      setLogoClicks(0);
      setTimeout(() => setMissionOverride(false), 6000);
    }
  }, [logoClicks]);

  // Fetch initial configs and run logs for Dashboard
  useEffect(() => {
    fetchConfigs();
    fetchRunHistory();
  }, []);

  const fetchConfigs = () => {
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(err => console.error("Error fetching config:", err));
  };

  const fetchRunHistory = (selectLatestId?: string) => {
    fetch('/api/runs')
      .then(res => res.json())
      .then(data => {
        setRunHistory(data);
        if (data.length > 0) {
          if (selectLatestId) {
            inspectRun(selectLatestId);
          } else if (!activeRun) {
            inspectRun(data[0].job_id);
          }
        }
      })
      .catch(err => console.error("Error loading run logs:", err));
  };

  const inspectRun = (runId: string) => {
    fetch(`/api/jobs/${runId}`)
      .then(res => res.json())
      .then(data => {
        setActiveRun(data);
        if (data.status === 'COMPLETED') {
          setActiveTab('overview');
        }
      })
      .catch(err => console.error("Error inspecting run:", err));
  };

  const executePipeline = (mode: string) => {
    setLoading(true);
    setProgress(0);
    setStageText("Initializing processing job...");
    
    fetch('/api/run-full-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mode: mode,
        sr_model: selectedModel
      })
    })
    .then(res => res.json())
    .then(job => {
      pollJobStatus(job.job_id);
    })
    .catch(err => {
      console.error(err);
      setLoading(false);
      showToast("Pipeline execution initiation failed.");
    });
  };

  const pollJobStatus = (jobId: string) => {
    const timer = setInterval(() => {
      fetch(`/api/jobs/${jobId}`)
        .then(res => res.json())
        .then(job => {
          setProgress(job.progress);
          setStageText(job.current_stage);
          
          if (job.status === 'COMPLETED') {
            clearInterval(timer);
            setLoading(false);
            showToast("Analysis pipeline finished successfully!");
            fetchRunHistory(jobId);
          } else if (job.status === 'FAILED') {
            clearInterval(timer);
            setLoading(false);
            showToast(`Analysis failed: ${job.error_message}`);
          }
        })
        .catch(err => {
          clearInterval(timer);
          setLoading(false);
          console.error(err);
        });
    }, 1000);
  };

  const saveSettings = () => {
    fetch('/api/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
    .then(res => res.json())
    .then(data => {
      setSettings(data);
      showToast("Configurations updated successfully.");
      setShowSettings(false);
    })
    .catch(err => {
      console.error(err);
      showToast("Failed to save configs.");
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  // Rendering View Branching
  if (view === 'landing') {
    if (phase === "loading") {
      return (
        <LoadingScreen
          progress={loadProgress}
          done={loadingDone}
          onEnter={enterMission}
        />
      );
    }

    return (
      <div className="relative w-screen h-screen overflow-hidden bg-black text-white">
        <Canvas
          gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
          dpr={[1, 1.5]}
          style={{ position: "absolute", inset: 0 }}
        >
          <LunarScene
            phase={phase}
            scrollProgress={scrollProgress}
            mousePos={mousePos}
          />
        </Canvas>

        <HUDOverlay
          phase={phase}
          scrollProgress={scrollProgress}
          mousePos={mousePos}
          onLogoClick={handleLogoClick}
          missionOverride={missionOverride}
          onExploreMission={() => {
            setView('explorer');
            if (tweenRef.current) {
              tweenRef.current.kill();
              tweenRef.current = null;
            }
          }}
          onEnterMission={startAutoPlay}
          onWatchAI={watchAIAnalysis}
        />
      </div>
    );
  }

  // ─── EXPLORER VIEW: Interactive Moon Surface ───
  if (view === 'explorer') {
    const handleRegionSelect = (regionId: string) => {
      setSelectedRegionId(regionId);
    };

    const handleAnalyze = (regionId: string) => {
      setAnalyzingRegion(regionId);
      setExplorerProgress(0);
      setExplorerStageText('Initializing Nexora pipeline...');

      fetch(`/api/regions/${regionId}/analyze`, { method: 'POST' })
        .then(res => res.json())
        .then(job => {
          // Poll for results
          const timer = setInterval(() => {
            fetch(`/api/jobs/${job.job_id}`)
              .then(res => res.json())
              .then(jobData => {
                setExplorerProgress(jobData.progress || 0);
                setExplorerStageText(jobData.current_stage || '');

                if (jobData.status === 'COMPLETED') {
                  clearInterval(timer);
                  setAnalyzingRegion(null);
                  setAnalyzedRegions(prev => ({
                    ...prev,
                    [regionId]: jobData
                  }));
                  // Set active run for dashboard and auto-redirect
                  setActiveRun(jobData);
                  setView('dashboard');
                  setActiveTab('overview');
                } else if (jobData.status === 'FAILED') {
                  clearInterval(timer);
                  setAnalyzingRegion(null);
                  showToast(`Analysis failed: ${jobData.error_message}`);
                }
              })
              .catch(() => {
                clearInterval(timer);
                setAnalyzingRegion(null);
              });
          }, 800);
        })
        .catch(err => {
          console.error(err);
          setAnalyzingRegion(null);
          showToast('Failed to start analysis.');
        });
    };

    return (
      <div className="h-screen flex flex-col bg-black text-white overflow-hidden">
        {/* Explorer Header */}
        <header className="bg-aerospace-900/90 border-b border-aerospace-800 px-6 py-3 flex items-center justify-between shrink-0" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (tweenRef.current) { tweenRef.current.kill(); tweenRef.current = null; }
                setView('landing');
                setPhase('loading');
                setScrollProgress(0);
                scrollRef.current = 0;
                setLoadingDone(false);
                setLoadProgress(0);
              }}
              className="flex items-center gap-2 hover:opacity-80 transition"
            >
              <div className="w-8 h-8 border rounded flex items-center justify-center font-bold font-mono text-sm" style={{ background: 'rgba(0,212,255,0.1)', borderColor: 'rgba(0,212,255,0.4)', color: '#00d4ff' }}>N</div>
              <div>
                <div className="display-text text-xs font-bold text-white" style={{ letterSpacing: '0.15em' }}>NEXORA</div>
                <div className="hud-text" style={{ fontSize: '8px', color: 'rgba(0,212,255,0.4)', letterSpacing: '0.1em' }}>LUNAR ANALYSIS PLATFORM</div>
              </div>
            </button>
          </div>
          <div className="flex items-center gap-3">
            {Object.keys(analyzedRegions).length > 0 && (
              <button
                onClick={() => {
                  setView('dashboard');
                  if (!activeRun && Object.keys(analyzedRegions).length > 0) {
                    const lastKey = Object.keys(analyzedRegions).pop()!;
                    setActiveRun(analyzedRegions[lastKey]);
                  }
                }}
                className="px-4 py-1.5 text-xs font-mono font-bold rounded flex items-center gap-1.5 transition"
                style={{ background: 'rgba(0,255,136,0.1)', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88' }}
              >
                <ShieldCheck size={14} />
                VIEW DASHBOARD ({Object.keys(analyzedRegions).length})
              </button>
            )}
            <div className="flex items-center gap-1.5">
              <Globe size={12} style={{ color: 'rgba(0,212,255,0.5)' }} />
              <span className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.5)', letterSpacing: '0.1em' }}>12 REGIONS AVAILABLE</span>
            </div>
          </div>
        </header>

        {/* Explorer Content */}
        <MoonSurfaceExplorer
          onRegionSelect={handleRegionSelect}
          onAnalyze={handleAnalyze}
          analyzedRegions={analyzedRegions}
          analyzing={analyzingRegion}
          progress={explorerProgress}
          stageText={explorerStageText}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-aerospace-950 flex flex-col font-sans select-none text-aerospace-100">
      
      {/* 1. TOP HEADER BAR */}
      <header className="bg-aerospace-900 border-b border-aerospace-800 px-6 py-4 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-3">
          <div 
            onClick={() => setView('explorer')}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition select-none"
            title="Return to Moon Explorer"
          >
            <div className="w-9 h-9 bg-cyan-950/80 border border-cyan-500 rounded flex items-center justify-center text-cyan-400 font-bold font-mono text-xl shadow-[0_0_10px_rgba(6,182,212,0.3)]">
              N
            </div>
            <div>
              <h1 className="text-base font-bold uppercase tracking-wider text-white font-mono flex items-center gap-1.5">
                Nexora — LunarSafe AI
              </h1>
              <p className="text-[10px] text-aerospace-400 uppercase tracking-widest font-mono">
                TMC/OHRC Hazard Mapping & Safe Landing Platform
              </p>
            </div>
          </div>
          <button
            onClick={() => setView('explorer')}
            className="ml-4 px-3 py-1 text-[10px] font-mono font-bold rounded flex items-center gap-1.5 transition"
            style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)', color: 'rgba(0,212,255,0.7)' }}
          >
            <Globe size={12} /> MOON EXPLORER
          </button>
        </div>

        {/* Action Triggers */}
        <div className="flex items-center gap-3">
          <div className="flex bg-aerospace-950 border border-aerospace-800 rounded p-0.5">
            {[
              { id: 'bicubic', name: 'BICUBIC' },
              { id: 'edsr', name: 'EDSR' },
              { id: 'swinir', name: 'SWINIR' },
              { id: 'lunarsr', name: 'LUNARSR' }
            ].map(model => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                disabled={loading}
                className={`px-2.5 py-1 text-[10px] font-mono font-bold rounded transition ${
                  selectedModel === model.id 
                    ? 'bg-cyan-600 text-white' 
                    : 'text-aerospace-500 hover:text-aerospace-300'
                }`}
              >
                {model.name}
              </button>
            ))}
          </div>

          <button
            onClick={() => executePipeline("demo")}
            disabled={loading}
            className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-aerospace-800 disabled:text-aerospace-500 text-white text-xs font-mono font-bold rounded flex items-center gap-1.5 shadow-lg shadow-cyan-900/30 transition animate-pulse-glow"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Play size={14} />}
            RUN DEMO MISSION
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded border border-aerospace-750 transition ${
              showSettings ? 'bg-cyan-950/40 border-cyan-500 text-cyan-400' : 'bg-aerospace-900 text-aerospace-400 hover:border-aerospace-600'
            }`}
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* 2. MAIN LAYOUT AND TABS RENDER */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Side Tab Routing Buttons */}
        <nav className="w-56 bg-aerospace-900/40 border-r border-aerospace-800/80 py-4 px-3 flex flex-col gap-1 shrink-0 overflow-y-auto">
          <div className="text-[10px] font-mono text-aerospace-500 uppercase tracking-widest px-3 mb-2">CONTROL PANEL</div>
          {[
            { id: 'overview', name: 'Overview', icon: Map },
            { id: 'heatmap', name: 'Hazard Heatmap', icon: ShieldCheck },
            { id: 'map2d', name: '2D Canvas Map', icon: Compass },
            { id: 'sim3d', name: '3D Simulation', icon: Activity },
            { id: 'eval', name: 'Evaluation Panel', icon: ActivitySquare },
            { id: 'datasets', name: 'Dataset Registry', icon: Database }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full px-3 py-2.5 text-left rounded text-xs font-mono flex items-center gap-2.5 transition border ${
                activeTab === tab.id 
                  ? 'bg-cyan-950/30 border-cyan-500/60 text-cyan-200 font-bold shadow-[inset_0_0_8px_rgba(6,182,212,0.15)]' 
                  : 'border-transparent text-aerospace-400 hover:bg-aerospace-900/60 hover:text-aerospace-200'
              }`}
            >
              <tab.icon size={15} className={activeTab === tab.id ? 'text-cyan-400' : 'text-aerospace-400'} />
              <span>{tab.name}</span>
            </button>
          ))}

          {/* Quick Active Run indicator */}
          {activeRun && (
            <div className="mt-auto border border-aerospace-800/60 p-3 rounded bg-aerospace-950/60 text-[10px] font-mono space-y-1.5">
              <div className="text-aerospace-500">ACTIVE EXPERIMENT:</div>
              <div className="font-bold text-cyan-400 truncate">{activeRun.job_id}</div>
              <div className="flex justify-between">
                <span>Model:</span>
                <span className="text-white uppercase">{activeRun.results?.sr_model || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-400">{activeRun.status}</span>
              </div>
              
              {activeRun.results?.files?.report_html && (
                <a 
                  href={`/api/results/${activeRun.job_id}/report.html`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="mt-2 block w-full py-1 text-center bg-cyan-950/40 hover:bg-cyan-900 border border-cyan-800 rounded font-semibold text-[9px] text-cyan-300 transition flex items-center justify-center gap-1"
                >
                  <FileText size={10} /> OPEN REPORT
                </a>
              )}
            </div>
          )}
        </nav>

        {/* Center Display Panel */}
        <main className="flex-1 overflow-y-auto p-6 relative">
          
          {/* Active Job Progress Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-aerospace-950/80 backdrop-blur-sm z-50 flex items-center justify-center">
              <div className="bg-aerospace-900 border border-aerospace-750 p-6 rounded-lg shadow-2xl max-w-sm w-full space-y-4 text-center font-mono">
                <Loader2 size={32} className="text-cyan-400 animate-spin mx-auto" />
                <div className="text-xs uppercase tracking-widest text-aerospace-400 font-semibold">Processing pipeline...</div>
                <div className="w-full bg-aerospace-950 rounded-full h-1.5">
                  <div className="bg-cyan-500 h-1.5 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                </div>
                <div className="text-[10px] text-cyan-300 min-h-[30px] leading-relaxed">
                  {stageText}
                </div>
                <div className="text-[9px] text-aerospace-500">Progress: {progress.toFixed(0)}%</div>
              </div>
            </div>
          )}

          {/* Render Tab Views */}
          {activeTab === 'overview' && (
            <DashboardOverview 
              runData={activeRun} 
              loading={loading} 
              activeTab={activeTab} 
              setActiveTab={setActiveTab} 
            />
          )}
          {activeTab === 'heatmap' && selectedRegionId && activeRun && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} style={{ color: '#00d4ff' }} />
                <span className="text-sm font-semibold text-aerospace-200 uppercase tracking-wider font-mono">Hazard Heatmap — Safe Landing Zones</span>
              </div>
              <HeatMapOverlay regionId={selectedRegionId} runData={activeRun} />
            </div>
          )}
          {activeTab === 'heatmap' && (!selectedRegionId || !activeRun) && (
            <div className="flex items-center justify-center h-64 text-aerospace-500 text-xs font-mono">
              Select and analyze a region from the Moon Explorer to view the heatmap.
              <button onClick={() => setView('explorer')} className="ml-2 text-cyan-400 underline">Open Explorer</button>
            </div>
          )}
          {activeTab === 'map2d' && <InteractiveMap2D runData={activeRun} />}
          {activeTab === 'sim3d' && <TerrainViewer3D runData={activeRun} config={settings} />}
          {activeTab === 'eval' && <EvaluationPanel runData={activeRun} />}
          {activeTab === 'datasets' && (
            <DatasetPanel 
              onSelectRun={inspectRun} 
              selectedRunId={activeRun?.job_id || ''} 
            />
          )}
        </main>
      </div>

      {/* 3. SETTINGS SLIDEOUT SIDE PANEL */}
      {showSettings && (
        <div className="fixed inset-y-0 right-0 w-80 bg-aerospace-900 border-l border-aerospace-700 shadow-2xl z-50 flex flex-col font-mono text-xs">
          <div className="p-4 border-b border-aerospace-800 flex justify-between items-center bg-aerospace-950">
            <span className="font-bold text-white flex items-center gap-1.5"><Sliders size={14} className="text-cyan-400" /> Settings Configurations</span>
            <button onClick={() => setShowSettings(false)} className="text-aerospace-400 hover:text-white">✕</button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Landing parameters */}
            <div className="space-y-2">
              <div className="text-cyan-400 font-bold border-b border-aerospace-850 pb-1 uppercase text-[10px]">Landing Footprint Constraints</div>
              <div className="space-y-1">
                <label className="text-aerospace-400 block">Footprint Size (m):</label>
                <input 
                  type="number" 
                  value={settings.landing.footprint_size_m} 
                  onChange={(e) => setSettings({...settings, landing: {...settings.landing, footprint_size_m: parseInt(e.target.value)}})}
                  className="w-full bg-black border border-aerospace-800 rounded px-2 py-1 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-aerospace-400 block">Safety Clearance Margin (m):</label>
                <input 
                  type="number" 
                  value={settings.landing.safety_margin_m} 
                  onChange={(e) => setSettings({...settings, landing: {...settings.landing, safety_margin_m: parseInt(e.target.value)}})}
                  className="w-full bg-black border border-aerospace-800 rounded px-2 py-1 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-aerospace-400 block">Max Slope Degrees (°):</label>
                <input 
                  type="number" 
                  step="0.5"
                  value={settings.landing.max_slope_deg} 
                  onChange={(e) => setSettings({...settings, landing: {...settings.landing, max_slope_deg: parseFloat(e.target.value)}})}
                  className="w-full bg-black border border-aerospace-800 rounded px-2 py-1 text-white"
                />
              </div>
            </div>

            {/* Fusion weights */}
            <div className="space-y-2 pt-2 border-t border-aerospace-850">
              <div className="text-cyan-400 font-bold border-b border-aerospace-850 pb-1 uppercase text-[10px]">Hazard Fusion Weights</div>
              {[
                { key: 'slope_weight', label: 'Slope Weight' },
                { key: 'crater_weight', label: 'Crater Weight' },
                { key: 'boulder_weight', label: 'Boulder Weight' },
                { key: 'shadow_weight', label: 'Shadow Weight' },
                { key: 'roughness_weight', label: 'Roughness Weight' }
              ].map(item => (
                <div key={item.key} className="flex justify-between items-center">
                  <label className="text-aerospace-400">{item.label}:</label>
                  <input 
                     type="number" 
                     step="0.05"
                     style={{ width: '70px' }}
                     value={settings.hazards[item.key]} 
                     onChange={(e) => setSettings({...settings, hazards: {...settings.hazards, [item.key]: parseFloat(e.target.value)}})}
                     className="bg-black border border-aerospace-800 rounded px-2 py-1 text-white text-right"
                   />
                </div>
              ))}
            </div>

            {/* Navigation penalties */}
            <div className="space-y-2 pt-2 border-t border-aerospace-850">
              <div className="text-cyan-400 font-bold border-b border-aerospace-850 pb-1 uppercase text-[10px]">Route Cost Penalties</div>
              <div className="space-y-1">
                <label className="text-aerospace-400 block">Hazard Penalty Weight:</label>
                <input 
                  type="number" 
                  value={settings.navigation.hazard_penalty} 
                  onChange={(e) => setSettings({...settings, navigation: {...settings.navigation, hazard_penalty: parseFloat(e.target.value)}})}
                  className="w-full bg-black border border-aerospace-800 rounded px-2 py-1 text-white"
                />
              </div>
              <div className="space-y-1">
                <label className="text-aerospace-400 block">Uncertainty Penalty Weight:</label>
                <input 
                  type="number" 
                  value={settings.navigation.uncertainty_penalty} 
                  onChange={(e) => setSettings({...settings, navigation: {...settings.navigation, uncertainty_penalty: parseFloat(e.target.value)}})}
                  className="w-full bg-black border border-aerospace-800 rounded px-2 py-1 text-white"
                />
              </div>
            </div>
          </div>
          
          <div className="p-4 border-t border-aerospace-800 bg-aerospace-950 flex gap-2">
            <button 
              onClick={saveSettings} 
              className="flex-1 py-2 bg-cyan-600 hover:bg-cyan-500 font-bold rounded text-white flex items-center justify-center gap-1"
            >
              <Save size={14} /> SAVE CONFIGS
            </button>
            <button 
              onClick={fetchConfigs} 
              className="px-3 py-2 bg-aerospace-800 hover:bg-aerospace-700 border border-aerospace-700 rounded text-aerospace-300"
            >
              <RotateCcw size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification Alert */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-aerospace-900 border border-cyan-500 px-4 py-3 rounded-lg shadow-2xl z-50 flex items-center gap-2.5 font-mono text-xs text-white max-w-sm">
          <Info size={16} className="text-cyan-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

    </div>
  );
}
