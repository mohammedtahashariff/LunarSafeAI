import { useEffect, useState } from "react";

const LOAD_STAGES = [
  "TERRAIN DATA",
  "AI MODEL",
  "NAVIGATION SYSTEM",
  "HAZARD DATABASE",
];

interface Props {
  progress: number;
  done: boolean;
  onEnter: () => void;
}

export default function LoadingScreen({ progress, done, onEnter }: Props) {
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (progress < 30) setCurrentStage(0);
    else if (progress < 57) setCurrentStage(1);
    else if (progress < 80) setCurrentStage(2);
    else setCurrentStage(3);
  }, [progress]);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => {
      setVisible(false);
      onEnter();
    }, 800);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center z-50 scanline-effect"
      style={{
        background: "#000",
        opacity: exiting ? 0 : 1,
        transition: "opacity 0.8s ease",
      }}
    >
      {/* Stars bg */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 120 }).map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              width: Math.random() < 0.8 ? 1 : 2,
              height: Math.random() < 0.8 ? 1 : 2,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              opacity: Math.random() * 0.6 + 0.1,
              animation: `blink ${2 + Math.random() * 4}s ${Math.random() * 3}s infinite`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 w-full max-w-md px-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3">
          <div className="relative">
            <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="rgba(0,212,255,0.3)" strokeWidth="1" />
              <circle cx="32" cy="32" r="20" stroke="rgba(0,212,255,0.5)" strokeWidth="1" />
              <circle cx="32" cy="32" r="6" fill="rgba(0,212,255,0.8)" />
              <line x1="32" y1="4" x2="32" y2="14" stroke="var(--cyan)" strokeWidth="1.5" />
              <line x1="32" y1="50" x2="32" y2="60" stroke="var(--cyan)" strokeWidth="1.5" />
              <line x1="4" y1="32" x2="14" y2="32" stroke="var(--cyan)" strokeWidth="1.5" />
              <line x1="50" y1="32" x2="60" y2="32" stroke="var(--cyan)" strokeWidth="1.5" />
              <path d="M18 18 L46 46" stroke="rgba(0,212,255,0.3)" strokeWidth="0.5" />
              <path d="M46 18 L18 46" stroke="rgba(0,212,255,0.3)" strokeWidth="0.5" />
            </svg>
            <div
              className="absolute inset-0 rounded-full"
              style={{
                border: "1px solid var(--cyan)",
                animation: "pulse-ring 2.5s ease-out infinite",
              }}
            />
          </div>

          <div className="text-center">
            <div
              className="display-text text-2xl font-bold text-white tracking-widest"
              style={{ letterSpacing: "0.3em" }}
            >
              LUNARSAFE AI
            </div>
            <div className="hud-text text-xs mt-1" style={{ color: "var(--cyan)", letterSpacing: "0.15em" }}>
              AUTONOMOUS LANDING INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Status */}
        <div className="hud-text text-xs text-center" style={{ color: "rgba(0,212,255,0.6)" }}>
          INITIALIZING MISSION...
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="progress-bar w-full rounded-none">
            <div
              className="progress-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="hud-text text-xs" style={{ color: "rgba(0,212,255,0.4)" }}>
              LOADING
            </span>
            <span className="hud-text text-xs" style={{ color: "var(--cyan)" }}>
              {Math.round(progress)}%
            </span>
          </div>
        </div>

        {/* Stage list */}
        <div className="w-full flex flex-col gap-2">
          {LOAD_STAGES.map((stage, i) => {
            const stageProgress = i * 25;
            const done = progress >= stageProgress + 25;
            const active = i === currentStage;
            return (
              <div key={stage} className="flex items-center gap-3">
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{
                    background: done ? "var(--cyan)" : active ? "var(--cyan)" : "rgba(0,212,255,0.15)",
                    boxShadow: active ? "0 0 8px var(--cyan)" : "none",
                    animation: active ? "blink 1s infinite" : "none",
                  }}
                />
                <div className="flex-1 progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: done ? "100%" : active ? `${((progress - stageProgress) / 25) * 100}%` : "0%",
                    }}
                  />
                </div>
                <span
                  className="hud-text text-xs"
                  style={{
                    color: done ? "var(--cyan)" : active ? "rgba(0,212,255,0.8)" : "rgba(0,212,255,0.3)",
                    minWidth: "120px",
                    letterSpacing: "0.08em",
                  }}
                >
                  {stage}
                </span>
                {done && (
                  <span className="hud-text text-xs" style={{ color: "var(--green)" }}>
                    ✓
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Enter button */}
        {done && (
          <div className="flex flex-col items-center gap-3" style={{ animation: "fadeInUp 0.6s ease forwards" }}>
            <div className="hud-text text-xs" style={{ color: "var(--green)", letterSpacing: "0.2em" }}>
              MISSION READY
            </div>
            <button className="btn-mission" onClick={handleEnter}>
              <span>ENTER</span>
            </button>
          </div>
        )}

        {/* Corner decorations */}
        <div
          className="absolute top-4 left-4 hud-text text-xs"
          style={{ color: "rgba(0,212,255,0.3)", fontSize: "9px" }}
        >
          MISSION 01 / LUNAR LANDING
        </div>
        <div
          className="absolute top-4 right-4 hud-text text-xs"
          style={{ color: "rgba(0,212,255,0.3)", fontSize: "9px" }}
        >
          {new Date().toISOString().slice(0, 10)}
        </div>
      </div>
    </div>
  );
}
