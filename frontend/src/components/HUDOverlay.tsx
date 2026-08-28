import { useEffect, useRef, useState } from "react";
import type { MissionPhase } from "../App";

interface Props {
  phase: MissionPhase;
  scrollProgress: number;
  mousePos: { x: number; y: number };
  onLogoClick: () => void;
  missionOverride: boolean;
  onExploreMission?: () => void;
  onEnterMission?: () => void;
  onWatchAI?: () => void;
}

function AnimatedNumber({ target, duration = 1200 }: { target: number; duration?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = Date.now();
    let startVal = 0;
    const animate = () => {
      const elapsed = Date.now() - start;
      const t = Math.min(elapsed / duration, 1);
      setVal(startVal + (target - startVal) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [target, duration]);
  return <>{val.toFixed(1)}</>;
}

function TypewriterText({ text, speed = 50, className = "" }: { text: string; speed?: number; className?: string }) {
  const [displayed, setDisplayed] = useState("");
  const [done, setDone] = useState(false);
  useEffect(() => {
    setDisplayed("");
    setDone(false);
    let i = 0;
    const iv = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) {
        clearInterval(iv);
        setDone(true);
      }
    }, speed);
    return () => clearInterval(iv);
  }, [text, speed]);

  return (
    <span className={className}>
      {displayed}
      {!done && <span className="hud-text" style={{ color: "var(--cyan)", animation: "blink 0.7s infinite" }}>_</span>}
    </span>
  );
}

function RadarSweep() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const angleRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const cx = 50, cy = 50, r = 44;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, 100, 100);
      angleRef.current += 0.03;

      // Background circles
      ctx.strokeStyle = "rgba(0,212,255,0.15)";
      ctx.lineWidth = 0.5;
      [14, 28, 44].forEach(radius => {
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.stroke();
      });

      // Cross
      ctx.beginPath();
      ctx.moveTo(cx - r, cy); ctx.lineTo(cx + r, cy);
      ctx.moveTo(cx, cy - r); ctx.lineTo(cx, cy + r);
      ctx.stroke();

      // Sweep
      const endAngle = angleRef.current;
      const sweepArc = Math.PI * 0.7;

      const sweep = ctx.createLinearGradient(cx, cy, cx + r * Math.cos(endAngle), cy + r * Math.sin(endAngle));
      sweep.addColorStop(0, "rgba(0,212,255,0.4)");
      sweep.addColorStop(1, "rgba(0,212,255,0)");

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, endAngle - sweepArc, endAngle);
      ctx.closePath();
      ctx.fillStyle = "rgba(0,212,255,0.12)";
      ctx.fill();

      // Sweep line
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + r * Math.cos(endAngle), cy + r * Math.sin(endAngle));
      ctx.strokeStyle = "rgba(0,212,255,0.8)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Blips
      [[30, 20], [65, 55], [25, 70]].forEach(([bx, by]) => {
        const a = Math.atan2(by - cy, bx - cx);
        const diff = ((angleRef.current - a) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        if (diff < 0.5) {
          ctx.beginPath();
          ctx.arc(bx, by, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,255,136,${1 - diff * 2})`;
          ctx.fill();
        }
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      width={100}
      height={100}
      style={{ width: 80, height: 80 }}
    />
  );
}

function AIBrainViz({ active }: { active: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !active) return;
    const ctx = canvas.getContext("2d")!;
    const W = canvas.width, H = canvas.height;
    const cx = W / 2, cy = H / 2;
    let raf: number;

    const nodes = Array.from({ length: 16 }, (_, i) => {
      const angle = (i / 16) * Math.PI * 2;
      const r = 30 + Math.random() * 20;
      return {
        x: cx + Math.cos(angle) * r,
        y: cy + Math.sin(angle) * r,
        pulse: Math.random() * Math.PI * 2,
      };
    });

    const draw = () => {
      frameRef.current++;
      ctx.clearRect(0, 0, W, H);

      // Core glow
      const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
      grd.addColorStop(0, "rgba(0,212,255,0.6)");
      grd.addColorStop(0.5, "rgba(0,100,255,0.2)");
      grd.addColorStop(1, "rgba(0,212,255,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, 25, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // Center ring
      ctx.beginPath();
      ctx.arc(cx, cy, 8, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,212,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Nodes and connections
      nodes.forEach((node, i) => {
        const pulse = Math.sin(frameRef.current * 0.04 + node.pulse) * 0.5 + 0.5;
        // Connection to center
        const particleT = (frameRef.current * 0.02 + i * 0.1) % 1;
        const px = cx + (node.x - cx) * particleT;
        const py = cy + (node.y - cy) * particleT;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(node.x, node.y);
        ctx.strokeStyle = `rgba(0,150,255,${0.1 + pulse * 0.1})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();

        // Particle
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${0.5 + pulse * 0.5})`;
        ctx.fill();

        // Node
        ctx.beginPath();
        ctx.arc(node.x, node.y, 2 + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,212,255,${0.4 + pulse * 0.6})`;
        ctx.fill();
      });

      // Orbit ring
      const orbitAngle = frameRef.current * 0.03;
      ctx.beginPath();
      ctx.arc(cx, cy, 40, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(0,212,255,0.1)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx + 40 * Math.cos(orbitAngle), cy + 40 * Math.sin(orbitAngle), 3, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,255,136,0.8)";
      ctx.fill();

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      width={120}
      height={120}
      style={{ width: 120, height: 120 }}
    />
  );
}

const SITE_SCORES = [
  { id: "A", score: 62, x: "28%", y: "52%" },
  { id: "B", score: 78, x: "52%", y: "60%" },
  { id: "C", score: 96.4, x: "63%", y: "44%" },
  { id: "D", score: 71, x: "38%", y: "35%" },
];

export default function HUDOverlay({
  phase,
  scrollProgress,
  mousePos,
  onLogoClick,
  missionOverride,
  onExploreMission,
  onEnterMission,
  onWatchAI
}: Props) {
  const [connectionText, setConnectionText] = useState("");
  const [showHeroText, setShowHeroText] = useState(false);
  const [connectionEstablished, setConnectionEstablished] = useState(false);
  const [activeHazard, setActiveHazard] = useState<string | null>(null);
  const [selectedSite, setSelectedSite] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Parallax from mouse
  const px = mousePos.x * 6;
  const py = mousePos.y * 4;

  // Show hero text & handle connection sequence in deep_space
  useEffect(() => {
    if (phase === "deep_space") {
      setShowHeroText(true);
      const t = setTimeout(() => {
        setConnectionEstablished(true);
      }, 2500); // 2.5 seconds typewriter loading, then fade-in landing buttons
      return () => clearTimeout(t);
    } else {
      setShowHeroText(false);
      setConnectionEstablished(false);
    }
  }, [phase]);

  // Site selection animation
  useEffect(() => {
    if (phase === "ai_decision" || phase === "safe_zone" || phase === "landing") {
      const t = setTimeout(() => setSelectedSite("C"), 1200);
      return () => clearTimeout(t);
    } else {
      setSelectedSite(null);
    }
  }, [phase]);

  const showTopBar = scrollProgress > 0.05;
  const showHero = phase === "deep_space" || phase === "moon_approach";
  const showLanderHUD = scrollProgress >= 0.15 && scrollProgress < 0.45;
  const showAIActivation = phase === "ai_activation";
  const showScanning = phase === "terrain_scanning" || phase === "hazard_detection";
  const showHazardPanel = phase === "hazard_detection";
  const showAIDecision = phase === "ai_decision";
  const showAIBrain = phase === "terrain_scanning" || phase === "hazard_detection" || phase === "ai_decision";
  const showSafeZone = phase === "safe_zone";
  const showTrajectory = phase === "landing";
  const showSuccess = scrollProgress > 0.95;
  const showFinalHero = scrollProgress > 0.97;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 pointer-events-none z-10 overflow-hidden scanline-effect"
      style={{ fontFamily: "var(--font-hud)" }}
    >
      {/* Top bar */}
      {showTopBar && (
        <div
          className="absolute top-0 left-0 right-0 flex items-center justify-between px-6 py-3"
          style={{
            borderBottom: "1px solid rgba(0,212,255,0.12)",
            background: "linear-gradient(180deg, rgba(0,4,12,0.8) 0%, transparent 100%)",
            transform: `translateX(${px * 0.3}px)`,
            transition: "transform 0.3s ease",
          }}
        >
          <button
            className="flex items-center gap-3 pointer-events-auto cursor-pointer"
            onClick={onLogoClick}
            style={{ background: "none", border: "none", padding: 0 }}
          >
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="32" r="28" stroke="rgba(0,212,255,0.4)" strokeWidth="1" />
              <circle cx="32" cy="32" r="6" fill="rgba(0,212,255,0.9)" />
              <line x1="32" y1="4" x2="32" y2="14" stroke="var(--cyan)" strokeWidth="2" />
              <line x1="32" y1="50" x2="32" y2="60" stroke="var(--cyan)" strokeWidth="2" />
              <line x1="4" y1="32" x2="14" y2="32" stroke="var(--cyan)" strokeWidth="2" />
              <line x1="50" y1="32" x2="60" y2="32" stroke="var(--cyan)" strokeWidth="2" />
            </svg>
            <div>
              <div className="display-text text-xs font-bold text-white" style={{ letterSpacing: "0.2em", fontSize: "11px" }}>
                LUNARSAFE AI
              </div>
              <div className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.12em" }}>
                MISSION CONTROL
              </div>
            </div>
          </button>

          <div className="flex items-center gap-6">
            <div className="coordinate-display">
              LAT: {(23.473 + mousePos.y * 0.01).toFixed(3)}° N
            </div>
            <div className="coordinate-display">
              LON: {(-17.62 + mousePos.x * 0.01).toFixed(3)}° W
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)", boxShadow: "0 0 6px var(--green)", animation: "blink 2s infinite" }} />
              <span className="hud-text text-xs" style={{ color: "var(--green)", fontSize: "9px", letterSpacing: "0.1em" }}>
                ONLINE
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Mission Override / Easter Egg */}
      {missionOverride && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.85)", zIndex: 100 }}
        >
          <div
            className="glass-panel p-8 text-center"
            style={{ maxWidth: 480, border: "1px solid rgba(255,170,0,0.4)", animation: "fadeInUp 0.4s ease" }}
          >
            <div className="hud-text text-xs mb-4" style={{ color: "var(--amber)", letterSpacing: "0.25em", animation: "blink 0.8s infinite" }}>
              ⚠ MISSION CONTROL OVERRIDE ⚠
            </div>
            <div className="display-text text-sm font-bold text-white mb-6" style={{ letterSpacing: "0.15em" }}>
              CLASSIFIED TELEMETRY
            </div>
            <div className="grid grid-cols-2 gap-4 text-left">
              {[
                ["ALTITUDE", "1,247 m"],
                ["VELOCITY", "−4.2 m/s"],
                ["TERRAIN CONF.", "96.4%"],
                ["LANDING RISK", "LOW"],
                ["NAV STATUS", "AUTONOMOUS"],
                ["FUEL REMAIN", "62.3%"],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col gap-0.5">
                  <span className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.1em" }}>{k}</span>
                  <span className="hud-text text-sm" style={{ color: "var(--cyan)", fontWeight: "bold" }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hero text - Deep Space */}
      {showHero && showHeroText && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{
            transform: `translate(${px * 0.5}px, ${py * 0.3}px)`,
            transition: "transform 0.4s ease",
          }}
        >
          <div
            className="flex flex-col items-center text-center"
            style={{ animation: "fadeInUp 1s ease forwards" }}
          >
            {phase === "deep_space" && !connectionEstablished && scrollProgress < 0.03 && (
              <div className="hud-text text-xs mb-8" style={{ color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em", fontSize: "10px" }}>
                <TypewriterText text="ESTABLISHING DEEP SPACE CONNECTION..." speed={40} />
              </div>
            )}
            {(connectionEstablished || scrollProgress >= 0.01) && (
              <>
                <div
                  className="hud-text text-xs mb-2"
                  style={{ color: "rgba(0,212,255,0.4)", letterSpacing: "0.35em", fontSize: "10px" }}
                >
                  LUNARSAFE AI — MISSION 01
                </div>
                <div
                  className="display-text font-black text-white mb-3"
                  style={{
                    fontSize: "clamp(2.5rem, 6vw, 5rem)",
                    letterSpacing: "0.12em",
                    textShadow: "0 0 60px rgba(0,212,255,0.3)",
                    lineHeight: 1.1,
                  }}
                >
                  LUNARSAFE AI
                </div>
                <div
                  className="display-text text-white mb-4"
                  style={{
                    fontSize: "clamp(0.8rem, 1.8vw, 1.2rem)",
                    letterSpacing: "0.12em",
                    opacity: 0.7,
                    maxWidth: 600,
                    fontWeight: 300,
                  }}
                >
                  TEACHING SPACECRAFT WHERE IT'S SAFE TO LAND.
                </div>
                <div
                  className="body-text mb-10"
                  style={{
                    fontSize: "clamp(0.75rem, 1.2vw, 0.95rem)",
                    color: "rgba(200,212,224,0.5)",
                    maxWidth: 440,
                    lineHeight: 1.6,
                    letterSpacing: "0.04em",
                  }}
                >
                  AI-powered lunar hazard mapping and autonomous landing intelligence.
                </div>
                <div className="flex items-center gap-4 pointer-events-auto">
                  <button
                    className="btn-mission"
                    onClick={() => {
                      if (onEnterMission) {
                        onEnterMission();
                      }
                    }}
                  >
                    <span>ENTER MISSION</span>
                  </button>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      if (onWatchAI) {
                        onWatchAI();
                      }
                    }}
                  >
                    WATCH AI ANALYSIS
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Scroll hint */}
      {scrollProgress < 0.02 && showHeroText && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="hud-text" style={{ fontSize: "9px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.2em" }}>
            SCROLL TO BEGIN MISSION
          </div>
          <div className="flex flex-col gap-1 items-center">
            {[0, 1, 2].map(i => (
              <div
                key={i}
                className="w-0.5 h-1.5 rounded-full"
                style={{
                  background: "var(--cyan)",
                  opacity: 0.4,
                  animation: `blink 1s ${i * 0.2}s infinite`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Mission progress bar */}
      {scrollProgress > 0.02 && scrollProgress < 0.98 && (
        <div className="absolute bottom-0 left-0 right-0" style={{ height: "2px" }}>
          <div
            style={{
              width: `${scrollProgress * 100}%`,
              height: "100%",
              background: "linear-gradient(90deg, var(--blue), var(--cyan))",
              boxShadow: "0 0 8px var(--cyan)",
              transition: "width 0.1s linear",
            }}
          />
        </div>
      )}

      {/* Phase label bottom left */}
      {scrollProgress > 0.02 && !showHero && (
        <div
          className="absolute bottom-6 left-6"
          style={{
            transform: `translateX(${px * 0.2}px)`,
            transition: "transform 0.3s ease",
          }}
        >
          <div className="hud-text" style={{ fontSize: "9px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.15em" }}>
            MISSION PHASE
          </div>
          <div className="hud-text text-xs" style={{ color: "var(--cyan)", letterSpacing: "0.15em" }}>
            {phase.replace(/_/g, " ").toUpperCase()}
          </div>
          <div className="hud-text" style={{ fontSize: "9px", color: "rgba(0,212,255,0.3)", marginTop: 2 }}>
            {(scrollProgress * 100).toFixed(0)}% COMPLETE
          </div>
        </div>
      )}

      {/* Lander HUD */}
      {showLanderHUD && (
        <div
          className="absolute top-16 right-6 glass-panel p-3"
          style={{
            minWidth: 200,
            transform: `translateX(${-px * 0.3}px)`,
            transition: "transform 0.3s ease",
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--cyan)", animation: "blink 1.5s infinite" }} />
            <div className="hud-text" style={{ fontSize: "9px", color: "var(--cyan)", letterSpacing: "0.12em" }}>
              LUNAR LANDER — AUTONOMOUS SYSTEM
            </div>
          </div>
          <div className="flex items-center gap-1 mb-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--green)" }} />
            <span className="hud-text" style={{ fontSize: "9px", color: "var(--green)", letterSpacing: "0.12em" }}>ONLINE</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
            {[
              ["ALT", "1,247 m"],
              ["VEL", "−4.2 m/s"],
              ["FUEL", "62.3%"],
              ["SIGNAL", "98.1%"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.5)" }}>{k}</span>
                <span className="hud-text" style={{ fontSize: "8px", color: "var(--silver)" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Radar */}
      {scrollProgress >= 0.3 && scrollProgress < 0.85 && (
        <div
          className="absolute bottom-6 right-6 glass-panel p-2"
          style={{
            transform: `translateX(${-px * 0.2}px)`,
            transition: "transform 0.3s ease",
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <div className="hud-text mb-1" style={{ fontSize: "8px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.12em" }}>
            RADAR SWEEP
          </div>
          <RadarSweep />
        </div>
      )}

      {/* AI Activation */}
      {showAIActivation && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <div
            className="flex flex-col items-center gap-4"
            style={{ animation: "fadeInUp 0.6s ease" }}
          >
            <div className="hud-text text-xl" style={{ color: "var(--cyan)", letterSpacing: "0.25em", animation: "blink 1.5s infinite" }}>
              <TypewriterText text="LUNARSAFE AI INITIALIZING..." speed={35} />
            </div>
            <div className="hud-text text-sm" style={{ color: "rgba(0,212,255,0.6)", letterSpacing: "0.2em" }}>
              AUTONOMOUS TERRAIN ANALYSIS
            </div>
            <div className="flex items-center gap-3 mt-2">
              {["SENSORS", "LIDAR", "NEURAL NET", "MAPPING"].map((s, i) => (
                <div
                  key={s}
                  className="flex items-center gap-1.5"
                  style={{ animation: `fadeInUp 0.4s ${i * 0.15}s ease both` }}
                >
                  <div className="w-1 h-1 rounded-full" style={{ background: "var(--green)", boxShadow: "0 0 4px var(--green)" }} />
                  <span className="hud-text" style={{ fontSize: "9px", color: "rgba(0,212,255,0.6)", letterSpacing: "0.1em" }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Terrain scanning status */}
      {showScanning && (
        <div
          className="absolute top-16 left-6 glass-panel p-4"
          style={{
            maxWidth: 220,
            transform: `translateX(${px * 0.2}px)`,
            transition: "transform 0.3s ease",
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <div className="hud-text text-xs mb-3" style={{ color: "var(--cyan)", letterSpacing: "0.15em" }}>
            TERRAIN ANALYSIS
          </div>
          <div className="flex flex-col gap-2">
            {[
              ["REAL LUNAR TERRAIN", "var(--silver)", 100],
              ["DIGITAL TERRAIN", "var(--cyan)", 85],
              ["AI TERRAIN MODEL", "var(--blue)", 72],
              ["1M × 1M GRID", "var(--green)", 58],
            ].map(([label, color, pct]) => (
              <div key={label as string} className="flex flex-col gap-0.5">
                <div className="flex justify-between">
                  <span className="hud-text" style={{ fontSize: "8px", color: "rgba(200,212,224,0.5)", letterSpacing: "0.08em" }}>
                    {label}
                  </span>
                  <span className="hud-text" style={{ fontSize: "8px", color: color as string }}>{pct}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, rgba(0,50,255,0.5), ${color})`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Brain visualization */}
      {showAIBrain && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
          style={{ transform: `translate(calc(-50% + ${px * 0.3}px), calc(-50% + ${py * 0.3}px))` }}
        >
          <div className="flex flex-col items-center gap-1">
            <div className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em" }}>
              LUNARSAFE AI CORE
            </div>
            <AIBrainViz active={showAIBrain} />
            <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 mt-1">
              {[
                ["TERRAIN", "98.7%", "var(--cyan)"],
                ["HAZARDS", "17", "var(--amber)"],
                ["SAFE ZONES", "04", "var(--green)"],
                ["CONFIDENCE", "96.4%", "var(--cyan)"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="text-center">
                  <div className="hud-text" style={{ fontSize: "7px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.1em" }}>{k}</div>
                  <div className="hud-text" style={{ fontSize: "11px", color: c as string, fontWeight: "bold" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Hazard detection panel */}
      {showHazardPanel && (
        <div
          className="absolute top-16 right-6 glass-panel p-4"
          style={{
            maxWidth: 200,
            transform: `translateX(${-px * 0.3}px)`,
            transition: "transform 0.3s ease",
            animation: "fadeInUp 0.5s ease",
          }}
        >
          <div className="hud-text text-xs mb-3" style={{ color: "var(--amber)", letterSpacing: "0.15em", animation: "blink 2s infinite" }}>
            ⚠ HAZARDS DETECTED
          </div>
          <div className="flex flex-col gap-3">
            {[
              { type: "CRATER", risk: "HIGH", conf: "94.8%", color: "var(--red)" },
              { type: "BOULDER", risk: "MEDIUM", conf: "89.2%", color: "var(--amber)" },
              { type: "STEEP SLOPE", risk: "HIGH", conf: "91.7%", color: "var(--red)" },
              { type: "UNEVEN TERRAIN", risk: "MEDIUM", conf: "87.3%", color: "var(--amber)" },
            ].map((h) => (
              <div
                key={h.type}
                className="p-2 rounded-sm"
                style={{ border: `1px solid ${h.color}33`, background: `${h.color}08` }}
              >
                <div className="hud-text" style={{ fontSize: "9px", color: h.color, letterSpacing: "0.1em", fontWeight: "bold" }}>
                  {h.type} DETECTED
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="hud-text" style={{ fontSize: "8px", color: "rgba(200,212,224,0.4)" }}>
                    RISK: {h.risk}
                  </span>
                  <span className="hud-text" style={{ fontSize: "8px", color: "rgba(200,212,224,0.4)" }}>
                    CONF: {h.conf}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Decision - Landing Sites */}
      {showAIDecision && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 flex flex-col items-center gap-4"
          style={{ animation: "fadeInUp 0.5s ease" }}
        >
          <div className="hud-text text-xs" style={{ color: "var(--cyan)", letterSpacing: "0.2em", animation: "blink 1.5s infinite" }}>
            ANALYZING LANDING SITES...
          </div>
          <div className="flex gap-4">
            {SITE_SCORES.map((site) => {
              const isSelected = selectedSite === site.id;
              const isEliminated = selectedSite && !isSelected && site.score < 90;
              return (
                <div
                  key={site.id}
                  className="glass-panel px-4 py-2 text-center"
                  style={{
                    border: isSelected
                      ? "1px solid var(--green)"
                      : isEliminated
                      ? "1px solid rgba(0,212,255,0.05)"
                      : "1px solid rgba(0,212,255,0.2)",
                    opacity: isEliminated ? 0.25 : 1,
                    boxShadow: isSelected ? "0 0 20px rgba(0,255,136,0.3)" : "none",
                    transition: "all 0.8s ease",
                    minWidth: 72,
                  }}
                >
                  <div className="hud-text text-xs" style={{ color: isSelected ? "var(--green)" : "var(--cyan)", letterSpacing: "0.1em" }}>
                    SITE {site.id}
                  </div>
                  <div
                    className="display-text text-sm font-bold mt-0.5"
                    style={{ color: isSelected ? "var(--green)" : "var(--silver)" }}
                  >
                    {site.score}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Safe Zone announcement */}
      {showSafeZone && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-end pb-24 pointer-events-none"
          style={{ animation: "fadeInUp 0.6s ease" }}
        >
          <div className="flex flex-col items-center gap-2">
            <div
              className="display-text font-black text-white"
              style={{
                fontSize: "clamp(1.8rem, 4vw, 3rem)",
                letterSpacing: "0.15em",
                textShadow: "0 0 30px rgba(0,255,136,0.5)",
                color: "var(--green)",
              }}
            >
              SAFE LANDING ZONE FOUND
            </div>
            <div
              className="display-text text-xl font-bold"
              style={{ color: "var(--green)", letterSpacing: "0.2em", opacity: 0.8 }}
            >
              96.4% CONFIDENCE
            </div>
            <div
              className="hud-text text-sm mt-2"
              style={{ color: "var(--cyan)", letterSpacing: "0.3em", animation: "blink 1s infinite" }}
            >
              TARGET LOCKED
            </div>
            <div className="flex gap-8 mt-3">
              {[
                ["SLOPE", "4.2°"],
                ["ROUGHNESS", "LOW"],
                ["BEARING", "127.4°"],
              ].map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="hud-text" style={{ fontSize: "8px", color: "rgba(0,255,136,0.5)", letterSpacing: "0.1em" }}>{k}</div>
                  <div className="hud-text text-xs" style={{ color: "var(--green)" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trajectory / Autonomous navigation */}
      {showTrajectory && (
        <div
          className="absolute top-16 left-6 glass-panel p-4"
          style={{
            maxWidth: 220,
            animation: "fadeInUp 0.5s ease",
            transform: `translateX(${px * 0.2}px)`,
          }}
        >
          <div className="flex items-center gap-2 mb-2">
            <div className="w-1 h-1 rounded-full" style={{ background: "var(--cyan)", animation: "blink 0.8s infinite" }} />
            <div className="hud-text" style={{ fontSize: "9px", color: "var(--cyan)", letterSpacing: "0.15em" }}>
              AUTONOMOUS NAVIGATION ACTIVE
            </div>
          </div>
          <div className="hud-text text-xs mb-3" style={{ color: "var(--green)", letterSpacing: "0.12em" }}>
            TRAJECTORY OPTIMIZED
          </div>
          <div className="flex flex-col gap-1.5">
            {[
              ["DESCENT RATE", "−2.4 m/s", "var(--cyan)"],
              ["CROSS TRACK", "0.12 m", "var(--green)"],
              ["ETA TOUCHDOWN", "48 s", "var(--silver)"],
              ["HAZARD CLEAR", "YES", "var(--green)"],
            ].map(([k, v, c]) => (
              <div key={k as string} className="flex justify-between">
                <span className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.4)" }}>{k}</span>
                <span className="hud-text" style={{ fontSize: "8px", color: c as string, fontWeight: "bold" }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Landing status */}
      {scrollProgress > 0.88 && scrollProgress < 0.97 && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none"
          style={{ animation: "fadeInUp 0.4s ease" }}
        >
          <div
            className="display-text font-bold text-white"
            style={{
              fontSize: "clamp(2rem, 5vw, 4rem)",
              letterSpacing: "0.2em",
              animation: scrollProgress > 0.93 ? "none" : "blink 0.5s infinite",
            }}
          >
            {scrollProgress > 0.93 ? "TOUCHDOWN" : "LANDING..."}
          </div>
          {scrollProgress > 0.93 && (
            <>
              <div
                className="display-text mt-2"
                style={{ color: "var(--green)", fontSize: "1.1rem", letterSpacing: "0.2em", animation: "fadeInUp 0.5s ease" }}
              >
                LANDING SUCCESSFUL
              </div>
              <div
                className="hud-text mt-1"
                style={{ color: "rgba(0,255,136,0.6)", fontSize: "11px", letterSpacing: "0.2em", animation: "fadeInUp 0.5s 0.3s ease both" }}
              >
                SAFE TERRAIN CONFIRMED
              </div>
            </>
          )}
        </div>
      )}

      {/* Final hero shot */}
      {showFinalHero && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
          style={{ animation: "fadeInUp 0.8s ease" }}
        >
          <div className="flex flex-col items-center text-center gap-4">
            <div
              className="display-text font-black text-white"
              style={{
                fontSize: "clamp(2rem, 5.5vw, 4.5rem)",
                letterSpacing: "0.12em",
                textShadow: "0 0 40px rgba(0,212,255,0.4)",
              }}
            >
              LUNARSAFE AI
            </div>
            <div
              className="display-text"
              style={{
                fontSize: "clamp(0.9rem, 2vw, 1.3rem)",
                color: "rgba(200,212,224,0.7)",
                letterSpacing: "0.1em",
                fontWeight: 300,
              }}
            >
              SAFER LANDINGS. SMARTER EXPLORATION.
            </div>
            <div
              className="hud-text text-xs"
              style={{ color: "rgba(0,212,255,0.5)", letterSpacing: "0.2em", marginTop: 4 }}
            >
              AI-POWERED LUNAR TERRAIN INTELLIGENCE
            </div>
            <button
              className="btn-mission mt-6 pointer-events-auto shadow-lg"
              onClick={() => {
                if (onExploreMission) {
                  onExploreMission();
                } else {
                  window.location.reload();
                }
              }}
            >
              <span>EXPLORE THE MISSION</span>
            </button>

            <div className="flex gap-8 mt-4">
              {[
                ["HAZARDS MAPPED", "2,847"],
                ["SAFE ZONES", "04"],
                ["CONFIDENCE", "96.4%"],
                ["MISSION TIME", "4m 32s"],
              ].map(([k, v]) => (
                <div key={k} className="text-center">
                  <div className="hud-text" style={{ fontSize: "8px", color: "rgba(0,212,255,0.4)", letterSpacing: "0.12em" }}>{k}</div>
                  <div className="display-text text-sm font-bold" style={{ color: "var(--cyan)" }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Holographic scan lines overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "repeating-linear-gradient(0deg, transparent, transparent 3px, rgba(0,212,255,0.008) 3px, rgba(0,212,255,0.008) 4px)",
        }}
      />

      {/* Corner coordinates */}
      {scrollProgress > 0.05 && (
        <>
          <div
            className="absolute bottom-6 left-6 coordinate-display"
            style={{ bottom: showSafeZone || showFinalHero ? "auto" : undefined, top: showSafeZone || showFinalHero ? 80 : undefined }}
          />
          <div className="absolute top-16 right-6 coordinate-display" style={{ display: showLanderHUD ? "none" : "block" }}>
            {scrollProgress > 0.3 && !showHazardPanel && !showTrajectory && (
              <div>
                <div style={{ color: "rgba(0,212,255,0.3)", fontSize: "8px" }}>
                  T+{Math.floor(scrollProgress * 287)}s
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
