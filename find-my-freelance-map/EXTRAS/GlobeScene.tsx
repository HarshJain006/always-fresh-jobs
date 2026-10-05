import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import * as THREE from "three";
import dayAsset from "@/assets/earth-day.asset.json";
import cloudAsset from "@/assets/earth-clouds.asset.json";
import nightAsset from "@/assets/earth-night.asset.json";
import galaxyAsset from "@/assets/milky-way.asset.json";

export type Destination = { name: string; lat: number; lon: number };
export type GlobeAction = { kind: "zoomIn" | "zoomOut" | "reset" | "north"; id: number } | null;

const RADIUS = 2.5;

function CameraControls({ action, onPosition }: { action: GlobeAction; onPosition: (distance: number) => void }) {
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const { camera, size } = useThree();
  const initialDistance = useMemo(() => {
    const minDimension = Math.min(size.width, size.height);
    return THREE.MathUtils.clamp((RADIUS * size.height) / (0.84 * minDimension * Math.tan(THREE.MathUtils.degToRad(22.5))), 6.5, 20);
  }, [size.width, size.height]);

  useEffect(() => {
    camera.position.set(0, 0, initialDistance);
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    onPosition(initialDistance);
  }, [camera, initialDistance, onPosition]);

  useEffect(() => {
    if (!action) return;
    if (action.kind === "reset") {
      camera.position.set(0, 0, initialDistance);
      camera.up.set(0, 1, 0);
    } else if (action.kind === "north") {
      const distance = camera.position.length();
      camera.position.set(0, 0, distance);
      camera.up.set(0, 1, 0);
    } else {
      camera.position.multiplyScalar(action.kind === "zoomIn" ? 0.7 : 1 / 0.7);
      camera.position.setLength(THREE.MathUtils.clamp(camera.position.length(), 2.9, 30));
    }
    camera.lookAt(0, 0, 0);
    controls.current?.update();
    onPosition(camera.position.length());
  }, [action, camera, initialDistance, onPosition]);

  return <OrbitControls ref={controls} enablePan={false} enableDamping dampingFactor={0.07} minDistance={2.9} maxDistance={30} rotateSpeed={0.55} zoomSpeed={0.8} onChange={() => onPosition(camera.position.length())} />;
}

function Earth({ destination, clouds, night }: { destination: Destination | null; clouds: boolean; night: boolean }) {
  const earthRef = useRef<THREE.Group>(null);
  const cloudRef = useRef<THREE.Mesh>(null);
  const targetRef = useRef<THREE.Quaternion | null>(null);
  const [dayMap, cloudMap, nightMap] = useTexture([dayAsset.url, cloudAsset.url, nightAsset.url]);
  if (dayMap) { dayMap.colorSpace = THREE.SRGBColorSpace; dayMap.anisotropy = 8; }
  if (nightMap) nightMap.colorSpace = THREE.SRGBColorSpace;
  if (cloudMap) cloudMap.colorSpace = THREE.SRGBColorSpace;

  useEffect(() => {
    if (destination) {
      const euler = new THREE.Euler(
        THREE.MathUtils.degToRad(destination.lat),
        THREE.MathUtils.degToRad(-90 - destination.lon),
        0,
        "XYZ",
      );
      targetRef.current = new THREE.Quaternion().setFromEuler(euler);
    }
  }, [destination]);

  useFrame((_, rawDelta) => {
    const dt = Math.min(rawDelta, 0.05);
    if (earthRef.current) {
      const target = targetRef.current;
      if (target && earthRef.current.quaternion.angleTo(target) > 0.002) {
        earthRef.current.quaternion.slerp(target, 1 - Math.exp(-2 * dt));
      } else {
        targetRef.current = null;
        earthRef.current.rotation.y -= dt * 0.011;
      }
    }
    if (cloudRef.current) cloudRef.current.rotation.y += dt * 0.006;
  });

  return (
    <group ref={earthRef} rotation={[0, THREE.MathUtils.degToRad(-110), 0]}>
      <mesh>
        <sphereGeometry args={[RADIUS, 96, 64]} />
        {night ? <meshBasicMaterial map={nightMap ?? null} /> : <meshStandardMaterial map={dayMap ?? null} roughness={1} metalness={0} />}
      </mesh>
      {clouds && <mesh ref={cloudRef}>
        <sphereGeometry args={[RADIUS * 1.006, 96, 64]} />
        <meshStandardMaterial map={cloudMap ?? null} alphaMap={cloudMap ?? null} transparent opacity={night ? 0.24 : 0.42} depthWrite={false} roughness={1} />
      </mesh>}
      <mesh>
        <sphereGeometry args={[RADIUS * 1.026, 64, 48]} />
        <meshBasicMaterial color="#74b8ef" transparent opacity={0.055} side={THREE.BackSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Galaxy() {
  const mesh = useRef<THREE.Mesh>(null);
  const map = useTexture(galaxyAsset.url);
  map.colorSpace = THREE.SRGBColorSpace;
  useFrame((_, rawDelta) => {
    if (mesh.current) mesh.current.rotation.y += Math.min(rawDelta, 0.05) * 0.0028;
  });
  return <mesh ref={mesh} rotation={[0.11, 0.55, -0.15]}>
    <sphereGeometry args={[90, 64, 48]} />
    <meshBasicMaterial map={map} side={THREE.BackSide} toneMapped={false} />
  </mesh>;
}

export function GlobeScene({ destination, action, clouds, night, onPosition }: { destination: Destination | null; action: GlobeAction; clouds: boolean; night: boolean; onPosition: (distance: number) => void }) {
  return <Canvas camera={{ position: [0, 0, 10], fov: 45, near: 0.01, far: 200 }} dpr={[1, 1.8]} gl={{ antialias: true, powerPreference: "high-performance" }}>
    <color attach="background" args={["#03050b"]} />
    <ambientLight intensity={1.65} />
    <directionalLight position={[4, 3, 6]} intensity={1.25} />
    <Suspense fallback={null}>
      <Galaxy />
      <Earth destination={destination} clouds={clouds} night={night} />
    </Suspense>
    <CameraControls action={action} onPosition={onPosition} />
  </Canvas>;
}
