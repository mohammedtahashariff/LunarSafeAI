import { useEffect, useRef, useState, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import { gsap } from "gsap";
import LoadingScreen from "./components/LoadingScreen";
import HUDOverlay from "./components/HUDOverlay";
import LunarScene from "./components/LunarScene";

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
  const [phase, setPhase] = useState<MissionPhase>("loading");
  const [scrollProgress, setScrollProgress] = useState(0);
  const [loadProgress, setLoadProgress] = useState(0);
  const [loadingDone, setLoadingDone] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [logoClicks, setLogoClicks] = useState(0);
  const [missionOverride, setMissionOverride] = useState(false);
  const scrollRef = useRef(0);
  const wheelRef = useRef<number | null>(null);
  const lastScrollRef = useRef(0);

  // Fake loading progress
  useEffect(() => {
    const steps = [
      { label: "TERRAIN DATA", target: 28 },
      { label: "AI MODEL", target: 55 },
      { label: "NAVIGATION SYSTEM", target: 78 },
      { label: "HAZARD DATABASE", target: 100 },
    ];
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
  }, []);

  const enterMission = useCallback(() => {
    setPhase("deep_space");
  }, []);

  // Wheel-based scroll
  useEffect(() => {
    if (phase === "loading") return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY * 0.0003;
      scrollRef.current = Math.max(0, Math.min(1, scrollRef.current + delta));
      setScrollProgress(scrollRef.current);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });

    // Touch
    let touchStartY = 0;
    const handleTouchStart = (e: TouchEvent) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e: TouchEvent) => {
      const dy = touchStartY - e.touches[0].clientY;
      touchStartY = e.touches[0].clientY;
      scrollRef.current = Math.max(0, Math.min(1, scrollRef.current + dy * 0.001));
      setScrollProgress(scrollRef.current);
    };
    window.addEventListener("touchstart", handleTouchStart);
    window.addEventListener("touchmove", handleTouchMove);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
    };
  }, [phase]);

  // Derive phase from scroll
  useEffect(() => {
    if (phase === "loading") return;
    const s = scrollProgress;
    let newPhase: MissionPhase = "deep_space";
    if (s >= 0.9) newPhase = "landing";
    else if (s >= 0.8) newPhase = "safe_zone";
    else if (s >= 0.7) newPhase = "ai_decision";
    else if (s >= 0.6) newPhase = "hazard_detection";
    else if (s >= 0.45) newPhase = "terrain_scanning";
    else if (s >= 0.3) newPhase = "ai_activation";
    else if (s >= 0.15) newPhase = "lander_arrival";
    else if (s >= 0.05) newPhase = "moon_approach";
    else newPhase = "deep_space";
    setPhase(newPhase);
  }, [scrollProgress, phase]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({
        x: (e.clientX / window.innerWidth - 0.5) * 2,
        y: (e.clientY / window.innerHeight - 0.5) * 2,
      });
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleLogoClick = useCallback(() => {
    const next = logoClicks + 1;
    setLogoClicks(next);
    if (next >= 3) {
      setMissionOverride(true);
      setLogoClicks(0);
      setTimeout(() => setMissionOverride(false), 6000);
    }
  }, [logoClicks]);

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
    <div className="relative w-full h-full overflow-hidden bg-black">
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
      />
    </div>
  );
}
