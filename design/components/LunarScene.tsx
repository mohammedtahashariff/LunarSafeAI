import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { MissionPhase } from "../App";

interface Props {
  phase: MissionPhase;
  scrollProgress: number;
  mousePos: { x: number; y: number };
}

// Utility: smooth lerp
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function Moon({ scrollProgress, phase }: { scrollProgress: number; phase: MissionPhase }) {
  const moonRef = useRef<THREE.Mesh>(null);
  const rimLightRef = useRef<THREE.DirectionalLight>(null);

  const moonMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.45, 0.44, 0.42),
      roughness: 0.95,
      metalness: 0.0,
    });
    return mat;
  }, []);

  // Craters as bump-like geometry modifications via normal map procedurally
  const moonGeo = useMemo(() => {
    const geo = new THREE.SphereGeometry(8, 128, 128);
    const pos = geo.attributes.position;
    const noise = (x: number, y: number, z: number, freq: number) => {
      return Math.sin(x * freq) * Math.cos(y * freq + 0.5) * Math.sin(z * freq + 1.2);
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z);
      const nx = x / len, ny = y / len, nz = z / len;
      const n =
        noise(nx, ny, nz, 3.1) * 0.15 +
        noise(nx, ny, nz, 7.3) * 0.06 +
        noise(nx, ny, nz, 15.7) * 0.025 +
        noise(nx, ny, nz, 31.1) * 0.01;
      const r = len + n;
      pos.setXYZ(i, nx * r, ny * r, nz * r);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  useFrame(({ clock }) => {
    if (!moonRef.current) return;
    moonRef.current.rotation.y = clock.getElapsedTime() * 0.005;
  });

  return (
    <group>
      <mesh ref={moonRef} geometry={moonGeo} material={moonMaterial} position={[0, 0, 0]} />
      <directionalLight
        ref={rimLightRef}
        position={[-15, 5, -10]}
        intensity={2.5}
        color={new THREE.Color(0.9, 0.92, 1.0)}
      />
      <ambientLight intensity={0.04} color={new THREE.Color(0.2, 0.25, 0.4)} />
    </group>
  );
}

function LunarTerrain({ visible, phase, scrollProgress }: { visible: boolean; phase: MissionPhase; scrollProgress: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const gridRef = useRef<THREE.LineSegments>(null);
  const scanRef = useRef<THREE.Mesh>(null);
  const scanProgress = useRef(0);

  const terrainGeo = useMemo(() => {
    const size = 60;
    const segments = 80;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const h =
        Math.sin(x * 0.18) * 1.8 +
        Math.cos(y * 0.22) * 1.4 +
        Math.sin(x * 0.41 + y * 0.37) * 0.8 +
        Math.cos(x * 0.9 + y * 0.7) * 0.4 +
        Math.sin(x * 2.1 + y * 1.8) * 0.15;
      pos.setZ(i, h);
    }
    geo.computeVertexNormals();
    return geo;
  }, []);

  const gridGeo = useMemo(() => {
    const size = 60;
    const div = 40;
    const step = size / div;
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= div; i++) {
      const x = -size / 2 + i * step;
      points.push(new THREE.Vector3(x, -size / 2, 0.05));
      points.push(new THREE.Vector3(x, size / 2, 0.05));
    }
    for (let j = 0; j <= div; j++) {
      const y = -size / 2 + j * step;
      points.push(new THREE.Vector3(-size / 2, y, 0.05));
      points.push(new THREE.Vector3(size / 2, y, 0.05));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(points);
    return geo;
  }, []);

  const terrainMat = useMemo(() =>
    new THREE.MeshStandardMaterial({
      color: new THREE.Color(0.32, 0.30, 0.28),
      roughness: 1,
      metalness: 0,
    }), []);

  const gridMat = useMemo(() =>
    new THREE.LineBasicMaterial({
      color: new THREE.Color(0, 0.7, 0.9),
      transparent: true,
      opacity: 0,
    }), []);

  useFrame(({ clock }) => {
    if (!gridMat || !scanRef.current) return;
    const s = scrollProgress;
    // Grid appears during scanning
    if (s > 0.45) {
      const t = Math.min((s - 0.45) / 0.2, 1);
      gridMat.opacity = t * 0.35;
    } else {
      gridMat.opacity = 0;
    }
    // Scan beam movement
    if (s > 0.45 && s < 0.7) {
      const t = (s - 0.45) / 0.25;
      scanRef.current.position.x = lerp(-25, 25, t);
      scanRef.current.visible = true;
    } else {
      scanRef.current.visible = false;
    }
  });

  if (!visible) return null;

  return (
    <group rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
      <mesh ref={meshRef} geometry={terrainGeo} material={terrainMat} />
      <lineSegments ref={gridRef} geometry={gridGeo} material={gridMat} />
      {/* Scan beam */}
      <mesh ref={scanRef} visible={false}>
        <planeGeometry args={[1.5, 60]} />
        <meshBasicMaterial
          color={new THREE.Color(0, 0.85, 1)}
          transparent
          opacity={0.18}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

function Lander({ visible, phase, scrollProgress }: { visible: boolean; phase: MissionPhase; scrollProgress: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const engineGlowRef = useRef<THREE.PointLight>(null);
  const bodyRef = useRef<THREE.Mesh>(null);
  const legGroupRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();

    // Hover oscillation
    const baseY = scrollProgress > 0.9 ? lerp(12, -3.2, (scrollProgress - 0.9) / 0.1) : 12;
    groupRef.current.position.y = baseY + Math.sin(t * 0.6) * 0.1;
    groupRef.current.rotation.y = t * 0.05;

    // Engine glow during landing
    if (engineGlowRef.current) {
      const landing = scrollProgress > 0.9 ? 1 : 0;
      engineGlowRef.current.intensity = landing * (1.5 + Math.sin(t * 8) * 0.4);
    }

    // Leg deploy
    if (legGroupRef.current && scrollProgress > 0.85) {
      const deployT = Math.min((scrollProgress - 0.85) / 0.05, 1);
      legGroupRef.current.children.forEach((leg, i) => {
        const angle = (i / 4) * Math.PI * 2;
        leg.rotation.x = lerp(0, 0.5, deployT);
      });
    }
  });

  if (!visible) return null;

  const legAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

  return (
    <group ref={groupRef} position={[0, 12, 0]}>
      {/* Main body */}
      <mesh ref={bodyRef}>
        <cylinderGeometry args={[0.8, 1.1, 1.6, 8]} />
        <meshStandardMaterial color={new THREE.Color(0.7, 0.72, 0.75)} metalness={0.8} roughness={0.3} />
      </mesh>

      {/* Top dome */}
      <mesh position={[0, 1.1, 0]}>
        <sphereGeometry args={[0.6, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={new THREE.Color(0.6, 0.65, 0.7)} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Antenna */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 1.2, 4]} />
        <meshStandardMaterial color={new THREE.Color(0.8, 0.85, 0.9)} metalness={1} roughness={0.1} />
      </mesh>
      <mesh position={[0, 2.45, 0]}>
        <sphereGeometry args={[0.06, 6, 6]} />
        <meshStandardMaterial color={new THREE.Color(0, 0.85, 1)} emissive={new THREE.Color(0, 0.5, 0.8)} emissiveIntensity={2} />
      </mesh>

      {/* LIDAR */}
      <mesh position={[0.9, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.4, 8]} />
        <meshStandardMaterial color={new THREE.Color(0.3, 0.35, 0.4)} metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Cameras */}
      {[0, Math.PI, Math.PI / 2, -Math.PI / 2].map((angle, i) => (
        <mesh key={i} position={[Math.sin(angle) * 1.0, -0.2, Math.cos(angle) * 1.0]}>
          <boxGeometry args={[0.12, 0.1, 0.12]} />
          <meshStandardMaterial color={new THREE.Color(0.1, 0.12, 0.15)} metalness={0.8} roughness={0.4} />
        </mesh>
      ))}

      {/* Landing legs */}
      <group ref={legGroupRef}>
        {legAngles.map((angle, i) => (
          <group key={i} rotation={[0, angle, 0]}>
            <mesh position={[1.4, -0.9, 0]} rotation={[0, 0, -Math.PI / 6]}>
              <cylinderGeometry args={[0.04, 0.04, 2.2, 4]} />
              <meshStandardMaterial color={new THREE.Color(0.65, 0.68, 0.72)} metalness={0.7} roughness={0.4} />
            </mesh>
            <mesh position={[2.1, -1.9, 0]}>
              <boxGeometry args={[0.6, 0.08, 0.08]} />
              <meshStandardMaterial color={new THREE.Color(0.6, 0.62, 0.65)} metalness={0.7} roughness={0.4} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Engine nozzle */}
      <mesh position={[0, -1.05, 0]}>
        <coneGeometry args={[0.5, 0.7, 8, 1, true]} />
        <meshStandardMaterial color={new THREE.Color(0.3, 0.3, 0.32)} metalness={0.8} roughness={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* Engine glow light */}
      <pointLight
        ref={engineGlowRef}
        position={[0, -1.5, 0]}
        color={new THREE.Color(0.4, 0.7, 1)}
        intensity={0}
        distance={8}
        decay={2}
      />

      {/* Scan beam visual from lander */}
      {(phase === "terrain_scanning" || phase === "hazard_detection" || phase === "ai_decision") && (
        <mesh position={[0, -8, 0]}>
          <coneGeometry args={[4, 16, 32, 1, true]} />
          <meshBasicMaterial
            color={new THREE.Color(0, 0.85, 1)}
            transparent
            opacity={0.04}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Directional light on lander */}
      <pointLight position={[3, 5, 3]} intensity={1.2} color={new THREE.Color(0.9, 0.92, 1)} />
    </group>
  );
}

function SafeZone({ visible }: { visible: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.getElapsedTime();
    if (ring1Ref.current) ring1Ref.current.rotation.z = t * 0.5;
    if (ring2Ref.current) ring2Ref.current.rotation.z = -t * 0.3;
  });

  if (!visible) return null;

  return (
    <group ref={groupRef} position={[3, -3.8, -5]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* Ground circle */}
      <mesh>
        <ringGeometry args={[0, 3, 64]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} transparent opacity={0.06} side={THREE.DoubleSide} />
      </mesh>

      {/* Rings */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[2.8, 3, 64]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh ref={ring2Ref}>
        <ringGeometry args={[2.0, 2.15, 64]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      <mesh>
        <ringGeometry args={[0.8, 0.95, 48]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* Center beacon */}
      <mesh>
        <circleGeometry args={[0.2, 16]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} side={THREE.DoubleSide} />
      </mesh>

      {/* Point light */}
      <pointLight position={[0, 0, 1]} color={new THREE.Color(0, 1, 0.5)} intensity={2} distance={10} />
    </group>
  );
}

function HazardMarkers({ visible }: { visible: boolean }) {
  const markers = useMemo(() => [
    { pos: [-8, -3.5, -8] as [number, number, number], type: "crater", color: new THREE.Color(1, 0.2, 0.1) },
    { pos: [6, -3.5, -12] as [number, number, number], type: "boulder", color: new THREE.Color(1, 0.6, 0.0) },
    { pos: [-4, -3.5, -16] as [number, number, number], type: "slope", color: new THREE.Color(1, 0.3, 0.05) },
    { pos: [12, -3.5, -6] as [number, number, number], type: "crater", color: new THREE.Color(1, 0.2, 0.1) },
  ], []);

  const ringsRef = useRef<THREE.Mesh[]>([]);

  useFrame(({ clock }) => {
    ringsRef.current.forEach((ring, i) => {
      if (!ring) return;
      const t = (clock.getElapsedTime() + i * 0.7) % 2;
      ring.scale.setScalar(1 + t * 0.8);
      (ring.material as THREE.MeshBasicMaterial).opacity = (1 - t / 2) * 0.6;
    });
  });

  if (!visible) return null;

  return (
    <group>
      {markers.map((m, i) => (
        <group key={i} position={m.pos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.6, 0.8, 32]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh
            ref={(el) => { if (el) ringsRef.current[i] = el; }}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.8, 1.0, 32]} />
            <meshBasicMaterial color={m.color} transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <pointLight color={m.color} intensity={0.8} distance={5} />
        </group>
      ))}
    </group>
  );
}

function Trajectory({ visible }: { visible: boolean }) {
  const pointRef = useRef<THREE.Mesh>(null);
  const progress = useRef(0);

  const curve = useMemo(() => {
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 12, 0),
      new THREE.Vector3(-1, 8, -2),
      new THREE.Vector3(1, 4, -3),
      new THREE.Vector3(2, 0, -4),
      new THREE.Vector3(3, -3.8, -5),
    ]);
  }, []);

  const points = useMemo(() => curve.getPoints(80), [curve]);
  const lineGeo = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);

  useFrame(({ clock }) => {
    if (!pointRef.current) return;
    progress.current = (clock.getElapsedTime() * 0.15) % 1;
    const p = curve.getPoint(progress.current);
    pointRef.current.position.copy(p);
  });

  if (!visible) return null;

  return (
    <group>
      <primitive object={new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: new THREE.Color(0, 0.85, 1), transparent: true, opacity: 0.5 }))} />
      <mesh ref={pointRef}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={new THREE.Color(0, 1, 0.5)} />
      </mesh>
      <pointLight position={[0, 0, 0]} color={new THREE.Color(0, 0.85, 1)} intensity={0.5} distance={3} />
    </group>
  );
}

function DataParticles({ visible }: { visible: boolean }) {
  const count = 300;
  const meshRef = useRef<THREE.Points>(null);

  const { positions, velocities } = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const velocities = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 30;
      positions[i * 3 + 1] = Math.random() * 20 - 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 30;
      velocities[i * 3] = (Math.random() - 0.5) * 0.02;
      velocities[i * 3 + 1] = Math.random() * 0.03 + 0.01;
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02;
    }
    return { positions, velocities };
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions.slice(), 3));
    return g;
  }, []);

  useFrame(() => {
    if (!meshRef.current || !visible) return;
    const pos = meshRef.current.geometry.attributes.position;
    for (let i = 0; i < count; i++) {
      let x = pos.getX(i) + velocities[i * 3];
      let y = pos.getY(i) + velocities[i * 3 + 1];
      let z = pos.getZ(i) + velocities[i * 3 + 2];
      if (y > 16) y = -5;
      pos.setXYZ(i, x, y, z);
    }
    pos.needsUpdate = true;
  });

  if (!visible) return null;

  return (
    <points ref={meshRef} geometry={geo}>
      <pointsMaterial
        color={new THREE.Color(0, 0.85, 1)}
        size={0.08}
        transparent
        opacity={0.5}
        sizeAttenuation
      />
    </points>
  );
}

function CameraController({ scrollProgress, mousePos }: { scrollProgress: number; mousePos: { x: number; y: number } }) {
  const { camera } = useThree();
  const targetPos = useRef(new THREE.Vector3(0, 20, 60));
  const currentPos = useRef(new THREE.Vector3(0, 20, 60));
  const targetLook = useRef(new THREE.Vector3(0, 0, 0));

  useFrame(({ clock }) => {
    const s = scrollProgress;
    const t = clock.getElapsedTime();

    // Camera path based on scroll
    let tx = 0, ty = 0, tz = 0;
    let lx = 0, ly = 0, lz = 0;

    if (s < 0.05) {
      // Deep space - far back
      tx = 0; ty = 15; tz = 80;
      lx = 0; ly = 0; lz = 0;
    } else if (s < 0.15) {
      // Moon approach
      const p = (s - 0.05) / 0.1;
      tx = 0; ty = lerp(15, 5, p); tz = lerp(80, 35, p);
      lx = 0; ly = lerp(0, -2, p); lz = 0;
    } else if (s < 0.3) {
      // Lander arrival - orbiting moon
      const p = (s - 0.15) / 0.15;
      tx = lerp(0, 5, p); ty = lerp(5, 18, p); tz = lerp(35, 25, p);
      lx = 0; ly = lerp(-2, 8, p); lz = 0;
    } else if (s < 0.6) {
      // AI activation & scanning - looking down at lander
      const p = (s - 0.3) / 0.3;
      tx = lerp(5, 8, p); ty = lerp(18, 22, p); tz = lerp(25, 20, p);
      lx = 0; ly = lerp(8, 5, p); lz = lerp(0, -5, p);
    } else if (s < 0.8) {
      // Hazard detection & decision
      const p = (s - 0.6) / 0.2;
      tx = lerp(8, 12, p); ty = lerp(22, 16, p); tz = lerp(20, 18, p);
      lx = lerp(0, 3, p); ly = lerp(5, -2, p); lz = lerp(-5, -6, p);
    } else if (s < 0.95) {
      // Landing sequence
      const p = (s - 0.8) / 0.15;
      tx = lerp(12, 6, p); ty = lerp(16, 4, p); tz = lerp(18, 12, p);
      lx = lerp(3, 2, p); ly = lerp(-2, -3, p); lz = lerp(-6, -5, p);
    } else {
      // Final hero shot - pull back wide
      const p = Math.min((s - 0.95) / 0.05, 1);
      tx = lerp(6, -5, p); ty = lerp(4, 12, p); tz = lerp(12, 40, p);
      lx = lerp(2, 0, p); ly = lerp(-3, -2, p); lz = lerp(-5, -3, p);
    }

    // Mouse parallax
    const mx = mousePos.x * 1.5;
    const my = mousePos.y * 0.8;

    targetPos.current.set(tx + mx, ty - my, tz);
    targetLook.current.set(lx, ly, lz);

    // Smooth camera movement
    currentPos.current.lerp(targetPos.current, 0.04);
    camera.position.copy(currentPos.current);
    camera.lookAt(targetLook.current);

    // Subtle camera shake during landing
    if (s > 0.88 && s < 0.98) {
      camera.position.x += (Math.random() - 0.5) * 0.02;
      camera.position.y += (Math.random() - 0.5) * 0.02;
    }
  });

  return null;
}

export default function LunarScene({ phase, scrollProgress, mousePos }: Props) {
  const showMoon = scrollProgress >= 0.03;
  const showTerrain = scrollProgress >= 0.25;
  const showLander = scrollProgress >= 0.15;
  const showHazards = scrollProgress >= 0.6;
  const showSafeZone = scrollProgress >= 0.78;
  const showTrajectory = scrollProgress >= 0.82;
  const showParticles = scrollProgress >= 0.3 && scrollProgress < 0.9;

  return (
    <>
      <PerspectiveCamera makeDefault fov={60} near={0.1} far={500} position={[0, 20, 60]} />
      <CameraController scrollProgress={scrollProgress} mousePos={mousePos} />

      {/* Background stars */}
      <Stars radius={200} depth={60} count={6000} factor={3} saturation={0.1} fade speed={0.3} />

      {/* Earth in background */}
      <mesh position={[-40, 20, -120]}>
        <sphereGeometry args={[12, 32, 32]} />
        <meshStandardMaterial
          color={new THREE.Color(0.1, 0.3, 0.7)}
          roughness={0.8}
          emissive={new THREE.Color(0.02, 0.08, 0.2)}
          emissiveIntensity={0.3}
        />
      </mesh>
      <directionalLight position={[80, 30, -60]} intensity={0.8} color={new THREE.Color(0.7, 0.85, 1)} />

      {showMoon && (
        <Moon scrollProgress={scrollProgress} phase={phase} />
      )}
      {showTerrain && (
        <LunarTerrain visible={showTerrain} phase={phase} scrollProgress={scrollProgress} />
      )}
      {showLander && (
        <Lander visible={showLander} phase={phase} scrollProgress={scrollProgress} />
      )}
      {showHazards && (
        <HazardMarkers visible={showHazards} />
      )}
      {showSafeZone && (
        <SafeZone visible={showSafeZone} />
      )}
      {showTrajectory && (
        <Trajectory visible={showTrajectory} />
      )}
      {showParticles && (
        <DataParticles visible={showParticles} />
      )}

      {/* Sun rim light */}
      <directionalLight position={[-30, 8, -20]} intensity={3} color={new THREE.Color(1, 0.96, 0.88)} />
      <directionalLight position={[10, -5, 10]} intensity={0.1} color={new THREE.Color(0.2, 0.3, 0.5)} />
    </>
  );
}
