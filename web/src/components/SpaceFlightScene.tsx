"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

type Phase = "idle" | "launch" | "arrival";
type Stage = "cabin" | "ignition" | "ascent" | "orbit" | "satellite" | "interface";

export default function SpaceFlightScene({ phase, stage }: { phase: Phase; stage: Stage }) {
  if (phase === "idle") return null;
  return (
    <div className="orbi-flight-scene" aria-hidden="true">
      <Canvas
        dpr={[1, 1.6]}
        camera={{ position: [0, 1.8, 12], fov: 48, near: 0.1, far: 240 }}
        gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      >
        <color attach="background" args={["#020713"]} />
        <fog attach="fog" args={["#020713", 22, 100]} />
        <ambientLight intensity={0.52} />
        <directionalLight position={[-8, 7, 6]} intensity={2.6} color="#bfeaff" />
        <pointLight position={[4, 1, -2]} intensity={28} color="#237bff" distance={45} />
        <pointLight position={[-8, -3, -12]} intensity={14} color="#27d7ff" distance={38} />
        <Stars />
        <Earth />
        <OrbitalArchitecture />
        <Satellite />
        <FlightCamera phase={phase} stage={stage} />
      </Canvas>
    </div>
  );
}

function Stars() {
  const points = useMemo(() => {
    const values = new Float32Array(1800 * 3);
    let seed = 7429;
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
    for (let i = 0; i < values.length; i += 3) {
      values[i] = (rand() - .5) * 150;
      values[i + 1] = (rand() - .5) * 100;
      values[i + 2] = -rand() * 135 - 8;
    }
    return values;
  }, []);
  const ref = useRef<THREE.Points>(null);
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.z += dt * .0018; });
  return <points ref={ref}><bufferGeometry><bufferAttribute attach="attributes-position" args={[points, 3]} /></bufferGeometry><pointsMaterial color="#b7e8ff" size={0.105} sizeAttenuation transparent opacity={0.88} depthWrite={false} /></points>;
}

function Earth() {
  const group = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (group.current) group.current.rotation.y += dt * .035; });
  return (
    <group ref={group} position={[0, -7.2, -23]}>
      <mesh>
        <sphereGeometry args={[9.3, 72, 72]} />
        <meshStandardMaterial color="#071c3c" roughness={0.86} metalness={0.12} emissive="#061a38" emissiveIntensity={0.72} />
      </mesh>
      <mesh scale={1.035}>
        <sphereGeometry args={[9.3, 64, 64]} />
        <meshBasicMaterial color="#258fff" transparent opacity={0.13} side={THREE.BackSide} blending={THREE.AdditiveBlending} depthWrite={false} />
      </mesh>
      <mesh rotation={[0.16, 0.3, -0.12]} position={[0, 0, 0]}>
        <sphereGeometry args={[9.34, 64, 64]} />
        <meshBasicMaterial color="#4acfff" wireframe transparent opacity={0.055} depthWrite={false} />
      </mesh>
      <mesh rotation={[0.2, 0.1, 0]}>
        <torusGeometry args={[9.55, 0.055, 8, 160, Math.PI * 1.12]} />
        <meshBasicMaterial color="#83eaff" transparent opacity={0.8} />
      </mesh>
    </group>
  );
}

function Satellite() {
  const rig = useRef<THREE.Group>(null);
  const panelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#173f72", metalness: .72, roughness: .28, emissive: "#0b3a72", emissiveIntensity: .45 }), []);
  const gold = "#d8e7f5";
  useFrame((state, dt) => {
    if (!rig.current) return;
    rig.current.rotation.y += dt * .12;
    rig.current.rotation.z = Math.sin(state.clock.elapsedTime * .25) * .055;
  });
  return (
    <group ref={rig} position={[2.1, 1.05, -6.5]} rotation={[0.24, -0.38, -0.12]} scale={1.08}>
      <mesh castShadow>
        <boxGeometry args={[1.18, .78, .68]} />
        <meshStandardMaterial color="#b7c9dc" metalness={.82} roughness={.24} />
      </mesh>
      <mesh position={[0, 0, .355]}>
        <boxGeometry args={[.7, .44, .025]} />
        <meshStandardMaterial color="#122c4e" metalness={.65} roughness={.25} />
      </mesh>
      <mesh position={[0, .43, 0]} rotation={[0, 0, .18]}>
        <cylinderGeometry args={[.11, .11, .16, 24]} />
        <meshStandardMaterial color={gold} metalness={.9} roughness={.2} />
      </mesh>
      <mesh position={[0, .63, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[.22, .018, 8, 32]} />
        <meshStandardMaterial color="#e4f5ff" metalness={.7} roughness={.22} />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side} position={[side * 1.75, 0, 0]}>
          <mesh position={[0, 0, 0]} material={panelMat}>
            <boxGeometry args={[2.15, .94, .045]} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[-.9 + i * .36, 0, .027]}>
              <boxGeometry args={[.018, .91, .012]} />
              <meshBasicMaterial color="#6ccaff" transparent opacity={.75} />
            </mesh>
          ))}
          <mesh position={[0, 0, .032]}>
            <boxGeometry args={[2.1, .025, .012]} />
            <meshBasicMaterial color="#9beaff" transparent opacity={.8} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, -.52, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.14, .22, .26, 20]} />
        <meshStandardMaterial color="#6b91b3" metalness={.78} roughness={.3} />
      </mesh>
      <pointLight position={[0, .5, 1.1]} intensity={2.2} distance={7} color="#8beaff" />
    </group>
  );
}

function OrbitalArchitecture() {
  const rings = useRef<THREE.Group>(null);
  useFrame((_, dt) => { if (rings.current) rings.current.rotation.z += dt * .018; });
  return (
    <group ref={rings} position={[0, -.3, -8]} rotation={[1.08, .18, -.16]}>
      {[4.3, 5.1, 6.05].map((radius, i) => (
        <mesh key={radius}>
          <torusGeometry args={[radius, i === 1 ? .014 : .009, 6, 180]} />
          <meshBasicMaterial color={i === 1 ? "#68dfff" : "#4589ff"} transparent opacity={i === 1 ? .44 : .2} depthWrite={false} />
        </mesh>
      ))}
      <mesh rotation={[.2, .5, 0]}>
        <torusGeometry args={[3.15, .012, 6, 160]} />
        <meshBasicMaterial color="#9deeff" transparent opacity={.35} depthWrite={false} />
      </mesh>
    </group>
  );
}

function FlightCamera({ phase, stage }: { phase: Phase; stage: Stage }) {
  const elapsed = useRef(0);
  const previous = useRef(phase);
  useFrame(({ camera }, dt) => {
    if (previous.current !== phase) {
      previous.current = phase;
      elapsed.current = 0;
    }
    elapsed.current += dt;
    const t = elapsed.current;
    const smooth = (v: number) => { const x = THREE.MathUtils.clamp(v, 0, 1); return x * x * (3 - 2 * x); };
    const launch = phase === "launch";
    const arrival = phase === "arrival";
    const target = new THREE.Vector3();
    if (launch) {
      const p = smooth(t / 7.9);
      camera.position.set(
        THREE.MathUtils.lerp(0, 1.1, p) + Math.sin(t * .34) * .055,
        THREE.MathUtils.lerp(1.8, .8, p) + Math.sin(t * .55) * .04,
        THREE.MathUtils.lerp(12, 3.9, p)
      );
      target.set(THREE.MathUtils.lerp(0, 1.25, p), THREE.MathUtils.lerp(-2.2, .75, p), THREE.MathUtils.lerp(-23, -6.5, p));
      if (stage === "orbit") target.x += Math.sin(t * .28) * .24;
    } else if (arrival) {
      const p = smooth(t / 2.6);
      camera.position.set(THREE.MathUtils.lerp(1.1, 0, p), THREE.MathUtils.lerp(.8, 1.8, p), THREE.MathUtils.lerp(3.9, 12, p));
      target.set(THREE.MathUtils.lerp(1.25, 0, p), THREE.MathUtils.lerp(.75, -2.2, p), THREE.MathUtils.lerp(-6.5, -23, p));
    }
    camera.lookAt(target);
    camera.fov = launch ? THREE.MathUtils.lerp(48, 56, smooth(t / 7.9)) : 48;
    camera.updateProjectionMatrix();
  });
  return null;
}
