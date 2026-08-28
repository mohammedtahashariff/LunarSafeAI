import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Play, Pause, RotateCcw, AlertTriangle, ShieldCheck, RefreshCw } from 'lucide-react';

interface TerrainViewer3DProps {
  runData: any;
  config: any;
}

export default function TerrainViewer3D({ runData, config }: TerrainViewer3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  
  // Simulation states
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [simState, setSimState] = useState<string>('READY'); // READY, NAVIGATING, REPLANNING, SUCCESS, ABORT
  const [exaggeration, setExaggeration] = useState<number>(1.5);
  const [dynamicObstacles, setDynamicObstacles] = useState<any[]>([]);
  const [obstacleText, setObstacleText] = useState<string>('');

  // Three.js References
  const sceneRef = useRef<THREE.Scene | null>(null);
  const landerRef = useRef<THREE.Group | null>(null);
  const pathMeshRef = useRef<THREE.Line | null>(null);
  const terrainMeshRef = useRef<THREE.Mesh | null>(null);
  const obstaclesGroupRef = useRef<THREE.Group | null>(null);
  
  // Animation path state
  const pathCoordsRef = useRef<any[]>([]);
  const currentPathIdxRef = useRef<number>(0);
  const currentPosRef = useRef<THREE.Vector3>(new THREE.Vector3(50, 20, 450));
  
  const hasResults = runData && runData.results;
  const results = hasResults ? runData.results : null;
  const path = results?.navigation_astar?.path || [];
  const bestZone = results?.best_candidate;
  const regionId = results?.region_id || runData?.payload?.region_id || null;

  // DEM height data loaded from actual image
  const [demHeights, setDemHeights] = useState<Float32Array | null>(null);
  const [demW, setDemW] = useState(100);
  const [demH, setDemH] = useState(100);

  // Load DEM image and extract height values
  useEffect(() => {
    const demUrl = results?.files?.dem_png
      || (regionId ? `/api/region_data/${regionId}/dem_tile.png` : '/api/demo_data/synthetic_dem.png');

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = demUrl;
    img.onload = () => {
      // Draw DEM image to offscreen canvas to read pixel data
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const pixels = imageData.data; // RGBA

      // Extract heights from pixel values
      // DEM is stored as 16-bit PNG; when loaded as 8-bit via canvas,
      // we use the red channel (0-255) and scale to [0, 50] meters
      const heights = new Float32Array(img.width * img.height);
      for (let i = 0; i < img.width * img.height; i++) {
        const r = pixels[i * 4];
        const g = pixels[i * 4 + 1];
        // Use R + G/256 for better precision from 16-bit PNG rendered as 8-bit
        const normalizedHeight = (r + g / 256.0) / 255.0;
        heights[i] = normalizedHeight * 50.0; // Scale to 0-50m
      }

      setDemW(img.width);
      setDemH(img.height);
      setDemHeights(heights);
    };
    img.onerror = () => {
      // Fallback: generate a flat heightfield
      setDemHeights(null);
    };
  }, [runData, regionId]);

  // Initialize path coords on data load
  useEffect(() => {
    if (path.length > 0) {
      pathCoordsRef.current = path;
      currentPathIdxRef.current = 0;
      // Start lander at high hover position
      const first = path[0];
      currentPosRef.current.set(first[0] - 250, 45, first[1] - 250);
      if (landerRef.current) {
        landerRef.current.position.copy(currentPosRef.current);
      }
      setSimState('READY');
      setIsPlaying(false);
    }
  }, [runData]);

  // Main Three.js Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    
    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#030712');
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(60, mountRef.current.clientWidth / 400, 0.1, 1000);
    camera.position.set(0, 180, 280);
    
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, 400);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);
    
    // 2. Controls & Lighting
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.maxPolarAngle = Math.PI / 2.1; // Don't go below ground
    controls.minDistance = 50;
    controls.maxDistance = 600;
    
    const ambientLight = new THREE.AmbientLight('#ffffff', 0.25);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight('#ffffff', 0.85);
    dirLight.position.set(200, 300, 200);
    dirLight.castShadow = true;
    scene.add(dirLight);
    
    // 3. Grid Helper
    const gridHelper = new THREE.GridHelper(500, 50, '#1f2937', '#111827');
    gridHelper.position.y = -0.5;
    scene.add(gridHelper);

    // 4. Group for Dynamic Obstacles
    const obsGroup = new THREE.Group();
    scene.add(obsGroup);
    obstaclesGroupRef.current = obsGroup;
    
    // 5. Build 3D Terrain Heightfield
    build3DTerrain(scene);
    
    // 6. Build Lander 3D Mesh
    buildLander(scene);
    
    // 7. Draw 3D Path
    draw3DPath(scene);

    // Animation Loop
    let animationId: number;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Update Orbit controls
      controls.update();
      
      // Update lander animation frame
      if (isPlaying && landerRef.current && pathCoordsRef.current.length > 0) {
        updateLanderMovement();
      }
      
      renderer.render(scene, camera);
    };
    
    animate();
    
    // Resize Handler
    const handleResize = () => {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / 400;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, 400);
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationId);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [exaggeration, runData, demHeights]);

  // Builds the 3D heightfield terrain using actual DEM data
  const build3DTerrain = (scene: THREE.Scene) => {
    // Use actual DEM dimensions for geometry segments
    const segW = demHeights ? Math.min(demW, 200) : 100;
    const segH = demHeights ? Math.min(demH, 200) : 100;
    
    // Standard Plane Geometry segment maps
    const geometry = new THREE.PlaneGeometry(500, 500, segW - 1, segH - 1);
    geometry.rotateX(-Math.PI / 2); // Lay flat
    
    const pos = geometry.attributes.position;
    
    if (demHeights && demW > 0 && demH > 0) {
      // ── Use actual DEM pixel heights ──
      // Find min/max for centering
      let hMin = Infinity, hMax = -Infinity;
      for (let i = 0; i < demHeights.length; i++) {
        if (demHeights[i] < hMin) hMin = demHeights[i];
        if (demHeights[i] > hMax) hMax = demHeights[i];
      }
      const hCenter = (hMin + hMax) / 2;
      
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i); // ranges [-250, 250]
        const vz = pos.getZ(i); // ranges [-250, 250]
        
        // Re-map vertex to DEM pixel coordinates
        const px = ((vx + 250) / 500) * (demW - 1);
        const py = ((vz + 250) / 500) * (demH - 1);
        
        // Bilinear interpolation for smooth sampling
        const x0 = Math.floor(px);
        const y0 = Math.floor(py);
        const x1 = Math.min(x0 + 1, demW - 1);
        const y1 = Math.min(y0 + 1, demH - 1);
        const fx = px - x0;
        const fy = py - y0;
        
        const h00 = demHeights[y0 * demW + x0];
        const h10 = demHeights[y0 * demW + x1];
        const h01 = demHeights[y1 * demW + x0];
        const h11 = demHeights[y1 * demW + x1];
        
        const h = (1 - fx) * (1 - fy) * h00 + fx * (1 - fy) * h10 +
                  (1 - fx) * fy * h01 + fx * fy * h11;
        
        // Scale height with exaggeration, centered around midpoint
        pos.setY(i, (h - hCenter) * exaggeration);
      }
    } else {
      // Fallback: flat terrain with subtle noise
      for (let i = 0; i < pos.count; i++) {
        const vx = pos.getX(i);
        const vz = pos.getZ(i);
        const lx = vx + 250;
        const ly = vz + 250;
        let h = 25.0 + 2.0 * Math.sin(lx / 80.0) * Math.cos(ly / 100.0);
        pos.setY(i, (h - 25.0) * exaggeration);
      }
    }
    
    geometry.computeVertexNormals();
    
    // Apply texture or standard material color
    // We fetch the hazard map image as the texture overlay
    const textureLoader = new THREE.TextureLoader();
    let material;
    
    if (results) {
      const tex = textureLoader.load(results.files.hazard_map_png);
      material = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: 0.8,
        metalness: 0.1,
        flatShading: true
      });
    } else {
      // Default lunar gray material
      material = new THREE.MeshStandardMaterial({
        color: '#374151',
        roughness: 0.9,
        flatShading: true
      });
    }
    
    const terrainMesh = new THREE.Mesh(geometry, material);
    terrainMesh.receiveShadow = true;
    scene.add(terrainMesh);
    terrainMeshRef.current = terrainMesh;
    
    // Draw 3D Landing Zone Rings
    if (bestZone) {
      const ringGeo = new THREE.RingGeometry(10, 11, 32);
      ringGeo.rotateX(-Math.PI / 2);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#10b981', side: THREE.DoubleSide });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.set(bestZone.x - 250, 0.5, bestZone.y - 250);
      scene.add(ring);
    }
  };

  // Constructs a modular lander body
  const buildLander = (scene: THREE.Scene) => {
    const lander = new THREE.Group();
    
    // Central cabin body (gold foil octagon)
    const bodyGeo = new THREE.CylinderGeometry(4, 4.5, 4, 8);
    const bodyMat = new THREE.MeshStandardMaterial({ color: '#ca8a04', metalness: 0.8, roughness: 0.2 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 2;
    lander.add(body);
    
    // Rocket nozzles (grey)
    const nozzleGeo = new THREE.ConeGeometry(1, 2, 8);
    const nozzleMat = new THREE.MeshStandardMaterial({ color: '#374151', metalness: 0.9 });
    const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
    nozzle.position.y = 0;
    nozzle.rotateX(Math.PI);
    lander.add(nozzle);
    
    // 4 Lander pads/legs
    const legGeo = new THREE.CylinderGeometry(0.2, 0.2, 5);
    const legMat = new THREE.MeshStandardMaterial({ color: '#d1d5db', metalness: 0.9 });
    
    const footGeo = new THREE.CylinderGeometry(1.2, 1.2, 0.3, 8);
    const footMat = new THREE.MeshStandardMaterial({ color: '#ca8a04', metalness: 0.9 });
    
    const directions = [
      { x: 3.5, z: 3.5, rx: -0.5, rz: 0.5 },
      { x: -3.5, z: 3.5, rx: -0.5, rz: -0.5 },
      { x: 3.5, z: -3.5, rx: 0.5, rz: 0.5 },
      { x: -3.5, z: -3.5, rx: 0.5, rz: -0.5 }
    ];
    
    directions.forEach(d => {
      const leg = new THREE.Mesh(legGeo, legMat);
      leg.position.set(d.x, 1, d.z);
      leg.rotation.set(d.rx, 0, d.rz);
      lander.add(leg);
      
      const foot = new THREE.Mesh(footGeo, footMat);
      foot.position.set(d.x * 1.4, -0.8, d.z * 1.4);
      lander.add(foot);
    });
    
    lander.scale.set(0.7, 0.7, 0.7);
    scene.add(lander);
    landerRef.current = lander;
  };

  // Draws the A* planned route line
  const draw3DPath = (scene: THREE.Scene) => {
    if (path.length === 0) return;
    
    const points = path.map((pt: any) => {
      // Re-map coordinate to [-250, 250] matching 3D scale
      // Start hover height is 45, descending slowly to ground
      return new THREE.Vector3(pt[0] - 250, 2, pt[1] - 250);
    });
    
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color: '#06b6d4', linewidth: 3 });
    const pathLine = new THREE.Line(geometry, material);
    scene.add(pathLine);
    pathMeshRef.current = pathLine;
  };

  // Update lander position along coordinates frame
  const updateLanderMovement = () => {
    const coords = pathCoordsRef.current;
    if (coords.length === 0) return;
    
    const targetIdx = currentPathIdxRef.current;
    if (targetIdx >= coords.length) {
      setIsPlaying(false);
      setSimState('SUCCESS');
      return;
    }
    
    const nextNode = coords[targetIdx];
    const target3D = new THREE.Vector3(
      nextNode[0] - 250,
      2 + (1.0 - targetIdx / coords.length) * 35.0, // Descends gradually
      nextNode[1] - 250
    );
    
    // Step size interpolation
    const step = 1.8;
    const distance = currentPosRef.current.distanceTo(target3D);
    
    if (distance < step) {
      // Reached node, target next
      currentPosRef.current.copy(target3D);
      currentPathIdxRef.current = targetIdx + 1;
    } else {
      // Interpolate towards target
      const dir = new THREE.Vector3().subVectors(target3D, currentPosRef.current).normalize();
      currentPosRef.current.addScaledVector(dir, step);
    }
    
    // Update mesh position
    if (landerRef.current) {
      landerRef.current.position.copy(currentPosRef.current);
    }
  };

  // Handles injection of dynamic obstacles
  const injectDynamicObstacle = () => {
    if (simState !== 'NAVIGATING') {
      alert("Please START the navigation simulation before placing obstacles.");
      return;
    }
    
    // Place obstacle along the path (e.g. 5 nodes ahead of current index)
    const coords = pathCoordsRef.current;
    const currentIdx = currentPathIdxRef.current;
    const targetNodeIdx = Math.min(currentIdx + 6, coords.length - 2);
    
    if (targetNodeIdx <= currentIdx) {
      alert("Lander is too close to destination to inject obstacles.");
      return;
    }
    
    const obsNode = coords[targetNodeIdx];
    const obsX = obsNode[0];
    const obsY = obsNode[1];
    
    // Add to state
    const newObstacle = { x: obsX, y: obsY, radius_m: 6.0 };
    const updatedList = [...dynamicObstacles, newObstacle];
    setDynamicObstacles(updatedList);
    
    // Draw 3D obstacle sphere
    if (obstaclesGroupRef.current) {
      const sphereGeo = new THREE.SphereGeometry(6, 16, 16);
      const sphereMat = new THREE.MeshStandardMaterial({ color: '#ef4444', roughness: 0.1 });
      const sphere = new THREE.Mesh(sphereGeo, sphereMat);
      sphere.position.set(obsX - 250, 1, obsY - 250);
      obstaclesGroupRef.current.add(sphere);
    }
    
    setSimState('REPLANNING');
    setIsPlaying(false);
    
    // Trigger API call to replan path!
    // Current position of lander mapped back to [0, 500] coordinates
    const startPt = [Math.round(currentPosRef.current.x + 250), Math.round(currentPosRef.current.z + 250)];
    const goalPt = [bestZone.x, bestZone.y];
    
    fetch('/api/navigation/replan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_point: startPt,
        goal_point: goalPt,
        dynamic_obstacles: updatedList
      })
    })
    .then(res => res.json())
    .then(data => {
      if (data.status === 'SUCCESS' && data.path.length > 0) {
        // Path replanned successfully!
        pathCoordsRef.current = data.path;
        currentPathIdxRef.current = 0;
        
        // Redraw 3D line
        if (sceneRef.current && pathMeshRef.current) {
          sceneRef.current.remove(pathMeshRef.current);
          
          const points = data.path.map((pt: any) => new THREE.Vector3(pt[0] - 250, 2, pt[1] - 250));
          const geometry = new THREE.BufferGeometry().setFromPoints(points);
          const material = new THREE.LineBasicMaterial({ color: '#ca8a04', linewidth: 3 }); // Redrawn path is gold
          const pathLine = new THREE.Line(geometry, material);
          sceneRef.current.add(pathLine);
          pathMeshRef.current = pathLine;
        }
        
        setSimState('NAVIGATING');
        setIsPlaying(true);
        setObstacleText('Obstacle detected. Route updated dynamically!');
      } else {
        // Cost blocked, trigger abort sequence
        setSimState('ABORT');
        setIsPlaying(true); // Re-play animation to fly lander up
        setObstacleText('WARNING: Navigation blocked! Triggering EMERGENCY ABORT.');
      }
    })
    .catch(err => {
      console.error(err);
      setSimState('ABORT');
    });
  };

  const handlePlayPause = () => {
    if (simState === 'READY') {
      setSimState('NAVIGATING');
    }
    setIsPlaying(!isPlaying);
  };

  const handleReset = () => {
    setIsPlaying(false);
    setSimState('READY');
    setDynamicObstacles([]);
    setObstacleText('');
    
    // Clear dynamic obstacle spheres
    if (obstaclesGroupRef.current) {
      while(obstaclesGroupRef.current.children.length > 0){
        obstaclesGroupRef.current.remove(obstaclesGroupRef.current.children[0]);
      }
    }
    
    if (path.length > 0) {
      pathCoordsRef.current = path;
      currentPathIdxRef.current = 0;
      const first = path[0];
      currentPosRef.current.set(first[0] - 250, 45, first[1] - 250);
      if (landerRef.current) {
        landerRef.current.position.copy(currentPosRef.current);
      }
      
      // Restore original blue path
      if (sceneRef.current && pathMeshRef.current) {
        sceneRef.current.remove(pathMeshRef.current);
        draw3DPath(sceneRef.current);
      }
    }
  };

  // Fly lander back up to orbit in abort state
  useEffect(() => {
    if (simState === 'ABORT' && isPlaying) {
      const abortTimer = setInterval(() => {
        if (landerRef.current) {
          landerRef.current.position.y += 2.5; // Ascend vertically
          if (landerRef.current.position.y > 100) {
            setIsPlaying(false);
            clearInterval(abortTimer);
          }
        }
      }, 50);
      return () => clearInterval(abortTimer);
    }
  }, [simState, isPlaying]);

  return (
    <div className="space-y-4">
      {/* 3D view container */}
      <div className="bg-aerospace-900 border border-aerospace-750 p-4 rounded-lg relative">
        <div className="flex justify-between items-center text-xs font-mono text-aerospace-400 mb-3">
          <span>Three.js Lunar terrain viewer</span>
          <span className="flex items-center gap-2">
            Exaggeration:
            <input 
              type="range" 
              min="0.5" 
              max="3.0" 
              step="0.5" 
              value={exaggeration} 
              onChange={(e) => setExaggeration(parseFloat(e.target.value))}
              className="accent-cyan-500 w-24 h-1 bg-aerospace-800 rounded-lg appearance-none cursor-pointer"
            />
            {exaggeration}x
          </span>
        </div>
        
        <div ref={mountRef} className="bg-black rounded overflow-hidden relative" />
        
        {/* Simulator Status Overlay */}
        <div className="absolute top-16 left-8 bg-aerospace-950/90 border border-aerospace-750 p-4 rounded-lg shadow-2xl text-xs font-mono space-y-2 pointer-events-none min-w-[220px]">
          <div className="text-[10px] text-cyan-400 border-b border-aerospace-800 pb-1 uppercase">Lander telemetry</div>
          <div className="flex justify-between">
            <span>Mission status:</span>
            <span className={`font-bold ${
              simState === 'SUCCESS' ? 'text-emerald-400' :
              simState === 'ABORT' ? 'text-red-500 animate-pulse' :
              simState === 'NAVIGATING' ? 'text-cyan-400' : 'text-aerospace-400'
            }`}>{simState}</span>
          </div>
          <div className="flex justify-between">
            <span>Altitude (Y):</span>
            <span className="text-white">
              {landerRef.current ? `${(landerRef.current.position.y / exaggeration).toFixed(1)}m` : '0.0m'}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Horizontal pos:</span>
            <span className="text-white">
              {landerRef.current ? `[${Math.round(landerRef.current.position.x + 250)}, ${Math.round(landerRef.current.position.z + 250)}]` : 'N/A'}
            </span>
          </div>
          
          {obstacleText && (
            <div className="pt-2 border-t border-aerospace-800 text-[10px] text-yellow-500 font-bold leading-normal">
              {obstacleText}
            </div>
          )}
        </div>
      </div>

      {/* Simulator controls */}
      <div className="bg-aerospace-900 border border-aerospace-700/60 p-4 rounded-lg flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button 
            onClick={handlePlayPause}
            disabled={path.length === 0 || simState === 'SUCCESS' || simState === 'ABORT'}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-aerospace-800 disabled:text-aerospace-500 font-mono text-xs font-bold rounded text-white flex items-center gap-1.5 transition"
          >
            {isPlaying ? <Pause size={14} /> : <Play size={14} />} {isPlaying ? 'PAUSE' : 'START SIMULATION'}
          </button>
          
          <button 
            onClick={handleReset}
            disabled={path.length === 0}
            className="px-4 py-2 bg-aerospace-800 hover:bg-aerospace-700 disabled:opacity-40 font-mono text-xs font-bold rounded text-aerospace-200 border border-aerospace-700 flex items-center gap-1.5 transition"
          >
            <RotateCcw size={14} /> RESET
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={injectDynamicObstacle}
            disabled={simState !== 'NAVIGATING'}
            className="px-4 py-2 bg-red-950/80 hover:bg-red-900/90 border border-red-700 disabled:opacity-40 font-mono text-xs font-bold rounded text-red-200 flex items-center gap-1.5 transition"
          >
            <AlertTriangle size={14} /> ADD DYNAMIC OBSTACLE
          </button>
        </div>
      </div>
    </div>
  );
}
