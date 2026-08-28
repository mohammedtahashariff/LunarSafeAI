import React from 'react';
import { Loader2, CheckCircle2, Circle } from 'lucide-react';

interface PipelineProgressProps {
  active: boolean;
  progress: number;
  stageText: string;
  currentStage: string;
}

const PIPELINE_STAGES = [
  { id: 'INTERSECTION', name: 'TMC/OHRC Intersection', icon: '01', threshold: 10 },
  { id: 'LR_HR_PAIRS', name: 'LR/HR Pair Generation', icon: '02', threshold: 15 },
  { id: 'PATCHES', name: 'Patch Construction', icon: '03', threshold: 18 },
  { id: 'SPLITTING', name: 'Dataset Splitting', icon: '04', threshold: 20 },
  { id: 'SUPER_RESOLUTION', name: 'LunarSR Super-Resolution', icon: '05', threshold: 25 },
  { id: 'HAZARD_DETECTION', name: 'Hazard Analysis', icon: '06', threshold: 60 },
  { id: 'LANDING_ANALYSIS', name: 'Landing Site Scoring', icon: '07', threshold: 75 },
  { id: 'NAVIGATION', name: 'A*/Dijkstra Navigation', icon: '08', threshold: 88 },
];

export default function PipelineProgress({ active, progress, stageText, currentStage }: PipelineProgressProps) {
  if (!active) return null;

  return (
    <div className="glass-panel p-4 rounded-lg" style={{ animation: 'fadeInUp 0.4s ease' }}>
      <div className="flex items-center gap-2 mb-3">
        <Loader2 size={16} className="animate-spin" style={{ color: '#00d4ff' }} />
        <span className="hud-text text-xs font-bold" style={{ color: '#00d4ff', letterSpacing: '0.15em' }}>
          NEXORA PIPELINE
        </span>
        <span className="hud-text" style={{ fontSize: '10px', color: 'rgba(200,212,224,0.5)' }}>
          {progress.toFixed(0)}%
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-aerospace-950 rounded-full h-1.5 mb-3">
        <div
          className="h-1.5 rounded-full transition-all duration-500"
          style={{
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #0066ff, #00d4ff)',
            boxShadow: '0 0 8px rgba(0,212,255,0.5)'
          }}
        />
      </div>

      {/* Stage list */}
      <div className="space-y-1">
        {PIPELINE_STAGES.map((stage) => {
          const isComplete = progress > stage.threshold + 5;
          const isActive = currentStage === stage.id || 
            (progress >= stage.threshold && progress <= stage.threshold + 10);
          const isPending = progress < stage.threshold;

          return (
            <div
              key={stage.id}
              className="flex items-center gap-2 py-0.5"
              style={{ opacity: isPending ? 0.35 : 1 }}
            >
              {isComplete ? (
                <CheckCircle2 size={12} style={{ color: '#00ff88' }} />
              ) : isActive ? (
                <Loader2 size={12} className="animate-spin" style={{ color: '#00d4ff' }} />
              ) : (
                <Circle size={12} style={{ color: 'rgba(200,212,224,0.2)' }} />
              )}
              <span className="hud-text" style={{
                fontSize: '9px',
                color: isComplete ? '#00ff88' : isActive ? '#00d4ff' : 'rgba(200,212,224,0.4)',
                letterSpacing: '0.05em'
              }}>
                [{stage.icon}] {stage.name}
              </span>
            </div>
          );
        })}
      </div>

      {/* Current stage text */}
      <div className="mt-2 pt-2 border-t" style={{ borderColor: 'rgba(0,212,255,0.1)' }}>
        <div className="hud-text" style={{ fontSize: '9px', color: 'rgba(0,212,255,0.6)' }}>
          {stageText}
        </div>
      </div>
    </div>
  );
}
