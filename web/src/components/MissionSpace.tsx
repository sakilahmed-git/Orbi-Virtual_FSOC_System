"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { MissionSnapshot, Vec3 } from "@/lib/useMissionSimulation";
type View = "mission" | "terminal-a" | "terminal-b";
export type SceneTarget = "a" | "b" | "ground" | "link";
type SharedState = {
  a: THREE.Vector3;
  b: THREE.Vector3;
  draggingA: boolean;
  draggingB: boolean;
  manualA: boolean;
  manualB: boolean;
};
export default function MissionSpace({
  simulation,
  ground,
  view,
  onSelect,
}: {
  simulation: MissionSnapshot;
  ground: boolean;
  view: View;
  onSelect?: (t: SceneTarget) => void;
}) {
  const shared = useRef<SharedState>({
    a: new THREE.Vector3(...simulation.source),
    b: new THREE.Vector3(...simulation.target),
    draggingA: false,
    draggingB: false,
    manualA: false,
    manualB: false,
  });
  const grid = useRef<THREE.GridHelper>(null);
  /*
   * Keep simulation positions synchronized until the user manually
   * moves a satellite. Once moved, the manual position remains stable.
   */
  useEffect(() => {
    const s = shared.current;
    if (!s.manualA && !s.draggingA) {
      s.a.set(...simulation.source);
    }
    if (!s.manualB && !s.draggingB) {
      s.b.set(...simulation.target);
    }
  }, [simulation.source, simulation.target]);
  useEffect(() => {
    const material = grid.current?.material;
    const materials = Array.isArray(material) ? material : material ? [material] : [];
    materials.forEach((item) => {
      item.transparent = true;
      item.opacity = 0.22;
      item.depthWrite = false;
      item.needsUpdate = true;
    });
  }, []);
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        position: [0, 6.5, 18],
        fov: 43,
        near: 0.1,
        far: 100,
      }}
      gl={{
        antialias: true,
        powerPreference: "high-performance",
      }}
      onCreated={({ gl }) => {
        gl.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      }}
    >
      <color attach="background" args={["#020817"]} />
      <fog
        attach="fog"
        args={["#020817", 18, 52]}
      />
      <ambientLight intensity={0.42} />
      <directionalLight
        position={[7, 10, 7]}
        intensity={1.8}
        color="#b9dcff"
      />
      <directionalLight
        position={[-8, 4, -4]}
        intensity={0.45}
        color="#6aaeff"
      />
      <pointLight
        position={[0, 2, 0]}
        intensity={1.8}
        color="#3159ff"
      />
      <CameraRig view={view} shared={shared} />
      <Starfield />
{/* Background interaction surface.
          Satellites are closer to the camera, so their pointer events
          take priority over this surface. */}
      <mesh
        position={[0, 0, -22]}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <EndpointSystem onSelect={onSelect}
        side="a"
        position={simulation.source}
        axis={simulation.currentAxis}
        disturbance={simulation.disturbance}
        shared={shared}
        aimTarget={shared.current.b}
                connected={simulation.phase === "CONNECTED"}
      />
      {ground ? (
        <GroundStation position={shared.current.b.toArray() as Vec3} onSelect={onSelect} />
      ) : (
        <EndpointSystem onSelect={onSelect}
          side="b"
          position={simulation.target}
          axis={simulation.desiredAxis}
          disturbance={simulation.disturbance}
          shared={shared}
          aimTarget={shared.current.a}
                    connected={simulation.phase === "CONNECTED"}
        />
      )}
      {simulation.phase !== "READY" &&
        simulation.phase !== "DISCONNECTING" && (
          <OpticalLink onSelect={onSelect}
            simulation={simulation}
            shared={shared}
            ground={ground}
          />
        )}
      {simulation.ghost && (
        <GhostMarker position={simulation.ghost} />
      )}
      <gridHelper
        ref={grid}
        args={[
          42,
          42,
          "#102b43",
          "#091a2b",
        ]}
        position={[0, -5, 0]}
      />
      <InteractionHint />
    </Canvas>
  );
}
/* -------------------------------------------------------------------------- */
/* CAMERA                                                                      */
/* -------------------------------------------------------------------------- */
function CameraRig({ view, shared }: { view: View; shared: React.MutableRefObject<SharedState> }) {
  const { camera, gl } = useThree();
  const orbit = useRef({
    yaw: 0,
    pitch: 0.32,
    distance: 18,
    active: false,
    lastX: 0,
    lastY: 0,
  });
  const initialized = useRef(false);
  const cinematic = useRef({
    active: false,
    elapsed: 0,
    start: new THREE.Vector3(),
    pass: new THREE.Vector3(),
    wide: new THREE.Vector3(),
    source: new THREE.Vector3(),
    midpoint: new THREE.Vector3(),
  });
  const presets: Record<
    View,
    [number, number, number]
  > = {
    mission: [0, 6.5, 18],
    "terminal-a": [-8, 3, 9],
    "terminal-b": [8, 3, 9],
  };
  useEffect(() => {
    const p = presets[view];
    const position = new THREE.Vector3(...p);
    orbit.current.distance = position.length();
    orbit.current.yaw = Math.atan2(
      position.x,
      position.z
    );
    orbit.current.pitch = Math.asin(
      THREE.MathUtils.clamp(
        position.y / orbit.current.distance,
        -0.95,
        0.95
      )
    );
    initialized.current = true;
  }, [view]);
  useEffect(() => {
    let started = false;
    const startCinematicEntry = () => {
      if (started) return;
      started = true;
      window.sessionStorage.removeItem("orbi:cinematic-entry");
      const c = cinematic.current;
      c.active = true;
      c.elapsed = 0;
      c.source.copy(shared.current.a);
      c.midpoint.copy(shared.current.a).add(shared.current.b).multiplyScalar(0.5);
      // Start beside the real source satellite, pass it, then pull back to frame
      // both endpoints. This is camera choreography, not a satellite spin.
      c.start.copy(c.source).add(new THREE.Vector3(0.35, 1.15, 4.4));
      c.pass.copy(c.source).add(new THREE.Vector3(-2.1, 1.25, 1.65));
      c.wide.set(0, 6.5, 18);
      camera.position.copy(c.start);
      camera.lookAt(c.source);
    };
    window.addEventListener("orbi:cinematic-entry", startCinematicEntry);
    if (window.sessionStorage.getItem("orbi:cinematic-entry") === "1") {
      startCinematicEntry();
    }
    return () => window.removeEventListener("orbi:cinematic-entry", startCinematicEntry);
  }, [camera, shared]);
  useEffect(() => {
    const canvas = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      if (orbit.current.active) return;
      event.preventDefault();
      orbit.current.distance = THREE.MathUtils.clamp(
        orbit.current.distance +
          event.deltaY * 0.012,
        7,
        38
      );
    };
    canvas.addEventListener("wheel", onWheel, {
      passive: false,
    });
    return () => {
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);
  useEffect(() => {
    const canvas = gl.domElement;
    const onPointerMove = (event: PointerEvent) => {
      if (!orbit.current.active) return;
      const dx =
        event.clientX - orbit.current.lastX;
      const dy =
        event.clientY - orbit.current.lastY;
      orbit.current.lastX = event.clientX;
      orbit.current.lastY = event.clientY;
      orbit.current.yaw -= dx * 0.006;
      orbit.current.pitch -= dy * 0.005;
      orbit.current.pitch = THREE.MathUtils.clamp(
        orbit.current.pitch,
        -1.15,
        1.15
      );
    };
    const onPointerUp = () => {
      orbit.current.active = false;
      canvas.style.cursor = "grab";
    };
    window.addEventListener(
      "pointermove",
      onPointerMove
    );
    window.addEventListener(
      "pointerup",
      onPointerUp
    );
    return () => {
      window.removeEventListener(
        "pointermove",
        onPointerMove
      );
      window.removeEventListener(
        "pointerup",
        onPointerUp
      );
    };
  }, [gl]);
  useFrame((_, dt) => {
    if (!initialized.current) return;
    const o = orbit.current;
    const cp = Math.cos(o.pitch);
    const sp = Math.sin(o.pitch);
    const sy = Math.sin(o.yaw);
    const cy = Math.cos(o.yaw);
    const desired = new THREE.Vector3(
      o.distance * cp * sy,
      o.distance * sp,
      o.distance * cp * cy
    );
    if (cinematic.current.active) {
      const c = cinematic.current;
      c.elapsed += dt;
      const t = THREE.MathUtils.clamp(c.elapsed / 3.15, 0, 1);
      const ease = (v: number) => v * v * (3 - 2 * v);
      const lookTarget = new THREE.Vector3();
      if (t < 0.34) {
        const local = ease(t / 0.34);
        camera.position.copy(c.start).lerp(c.pass, local);
        lookTarget.copy(c.source).lerp(c.source.clone().add(new THREE.Vector3(0.8, 0.1, 0)), local);
      } else if (t < 0.7) {
        const local = ease((t - 0.34) / 0.36);
        const wideStart = c.midpoint.clone().add(new THREE.Vector3(0, 2.8, 8.5));
        camera.position.copy(c.pass).lerp(wideStart, local);
        lookTarget.copy(c.source).lerp(c.midpoint, local);
      } else {
        const local = ease((t - 0.7) / 0.3);
        const wideStart = c.midpoint.clone().add(new THREE.Vector3(0, 2.8, 8.5));
        camera.position.copy(wideStart).lerp(desired, local);
        lookTarget.copy(c.midpoint).lerp(new THREE.Vector3(0, 0, 0), local);
      }
      camera.lookAt(lookTarget);
      if (t >= 1) c.active = false;
      return;
    }
    camera.position.lerp(
      desired,
      1 - Math.exp(-dt * 5)
    );
    camera.lookAt(0, 0, 0);
  });
  return (
    <CameraInteraction
      onStart={(x, y) => {
        orbit.current.active = true;
        orbit.current.lastX = x;
        orbit.current.lastY = y;
        gl.domElement.style.cursor = "grabbing";
      }}
    />
  );
}
function CameraInteraction({
  onStart,
}: {
  onStart: (x: number, y: number) => void;
}) {
  return (
    <mesh
      position={[0, 0, -21]}
      onPointerDown={(event) => {
        event.stopPropagation();
        onStart(
          event.nativeEvent.clientX,
          event.nativeEvent.clientY
        );
      }}
    >
      <planeGeometry args={[90, 90]} />
      <meshBasicMaterial
        transparent
        opacity={0}
        depthWrite={false}
      />
    </mesh>
  );
}
/* -------------------------------------------------------------------------- */
/* STARFIELD                                                                    */
/* -------------------------------------------------------------------------- */
function Starfield() {
  const positions = useMemo(() => {
    const a = new Float32Array(1200);
    for (let i = 0; i < a.length; i += 3) {
      const n = i / 3;
      a[i] =
        ((n * 79) % 59 - 29) * 0.65;
      a[i + 1] =
        ((n * 47) % 43 - 21) * 0.5;
      a[i + 2] =
        -8 - ((n * 31) % 50) * 0.45;
    }
    return a;
  }, []);
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.035}
        color="#b9ddff"
        sizeAttenuation
        transparent
        opacity={0.85}
      />
    </points>
  );
}
/* -------------------------------------------------------------------------- */
/* ORBIT PATH                                                                   */
/* -------------------------------------------------------------------------- */
/* -------------------------------------------------------------------------- */
/* INTERACTIVE SATELLITE                                                       */
/* -------------------------------------------------------------------------- */
function EndpointSystem({
  side,
  position,
  axis,
  shared,
  aimTarget,
  connected,
  onSelect,
}: {
  side: "a" | "b";
  position: Vec3;
  axis: Vec3;
  disturbance: number;
  shared: React.MutableRefObject<SharedState>;
  aimTarget: THREE.Vector3;
  connected: boolean;
  onSelect?: (t: SceneTarget) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const selectRef = useRef(onSelect);
  useEffect(() => { selectRef.current = onSelect; });
  const { camera, gl } = useThree();
  const drag = useRef({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    startPosition: new THREE.Vector3(),
    plane: new THREE.Plane(),
    cameraDirection: new THREE.Vector3(),
  });
  const simulationPosition = useMemo(
    () => new THREE.Vector3(...position),
    [position]
  );
  useFrame((_, dt) => {
    if (!group.current) return;
    const state = shared.current;
    const dragging =
      side === "a"
        ? state.draggingA
        : state.draggingB;
    const manual =
      side === "a"
        ? state.manualA
        : state.manualB;
    if (!dragging && !manual) {
      group.current.position.lerp(
        simulationPosition,
        1 - Math.exp(-dt * 6)
      );
    }
    /*
     * Keep the shared position synchronized with the
     * actual rendered position.
     */
    if (side === "a") {
      state.a.copy(group.current.position);
    } else {
      state.b.copy(group.current.position);
    }
    /*
     * Always point the optical head toward the other
     * endpoint. This fixes the receiver being backwards.
     */
    const direction = aimTarget
      .clone()
      .sub(group.current.position);
    if (direction.lengthSq() > 0.0001) {
      direction.normalize();
      const desiredQuaternion =
        new THREE.Quaternion().setFromUnitVectors(
          new THREE.Vector3(1, 0, 0),
          direction
        );
      group.current.quaternion.slerp(
        desiredQuaternion,
        1 - Math.exp(-dt * 7)
      );
    }
    // Keep the satellite body orientation stable. Disturbance is visualized
    // by the optical-link/simulation indicators rather than spinning the whole craft.
  });
  useEffect(() => {
    const onMove = (event: PointerEvent) => {
      if (!drag.current.active || !group.current) {
        return;
      }
      if (Math.abs(event.clientX - drag.current.startX) + Math.abs(event.clientY - drag.current.startY) > 4) drag.current.moved = true;
      const rect = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(
        ((event.clientX - rect.left) /
          rect.width) *
          2 -
          1,
        -(
          ((event.clientY - rect.top) /
            rect.height) *
            2 -
          1
        )
      );
      const raycaster =
        new THREE.Raycaster();
      raycaster.setFromCamera(
        ndc,
        camera
      );
      /*
       * Shift + drag = move along camera depth.
       */
      if (event.shiftKey) {
        const dy =
          event.clientY -
          drag.current.startY;
        const next =
          drag.current.startPosition
            .clone()
            .addScaledVector(
              drag.current.cameraDirection,
              -dy * 0.025
            );
        next.x = THREE.MathUtils.clamp(
          next.x,
          -35,
          35
        );
        next.y = THREE.MathUtils.clamp(
          next.y,
          -25,
          25
        );
        next.z = THREE.MathUtils.clamp(
          next.z,
          -35,
          35
        );
        group.current.position.copy(next);
        return;
      }
      /*
       * Normal drag = movement across a plane
       * facing the camera.
       */
      const hit = new THREE.Vector3();
      if (
        raycaster.ray.intersectPlane(
          drag.current.plane,
          hit
        )
      ) {
        const delta =
          hit.clone().sub(
            drag.current.plane
              .coplanarPoint(
                new THREE.Vector3()
              )
          );
        /*
         * Recalculate against the original
         * drag plane using the initial grab point.
         */
        const startHit = new THREE.Vector3();
        const startRay =
          new THREE.Ray();
        startRay.origin.copy(
          camera.position
        );
        startRay.direction
          .copy(
            drag.current.cameraDirection
          )
          .negate();
        /*
         * Simpler stable movement:
         * use the camera-facing plane and
         * convert screen movement to world movement.
         */
        const scale =
          drag.current.startPosition
            .distanceTo(camera.position) *
          0.0015;
        const dx =
          event.clientX -
          drag.current.startX;
        const dy =
          event.clientY -
          drag.current.startY;
        const right =
          new THREE.Vector3()
            .setFromMatrixColumn(
              camera.matrixWorld,
              0
            )
            .normalize();
        const up =
          new THREE.Vector3()
            .setFromMatrixColumn(
              camera.matrixWorld,
              1
            )
            .normalize();
        const next =
          drag.current.startPosition
            .clone()
            .addScaledVector(
              right,
              dx * scale
            )
            .addScaledVector(
              up,
              -dy * scale
            );
        next.x = THREE.MathUtils.clamp(
          next.x,
          -35,
          35
        );
        next.y = THREE.MathUtils.clamp(
          next.y,
          -25,
          25
        );
        next.z = THREE.MathUtils.clamp(
          next.z,
          -35,
          35
        );
        group.current.position.copy(next);
        void delta;
        void startHit;
        void startRay;
      }
    };
    const onUp = () => {
      if (!drag.current.active) return;
      if (!drag.current.moved) selectRef.current?.(side);
      drag.current.active = false;
      if (side === "a") {
        shared.current.draggingA = false;
        if (drag.current.moved) shared.current.manualA = true;
      } else {
        shared.current.draggingB = false;
        if (drag.current.moved) shared.current.manualB = true;
      }
      gl.domElement.style.cursor =
        "grab";
    };
    window.addEventListener(
      "pointermove",
      onMove
    );
    window.addEventListener(
      "pointerup",
      onUp
    );
    return () => {
      window.removeEventListener(
        "pointermove",
        onMove
      );
      window.removeEventListener(
        "pointerup",
        onUp
      );
    };
  }, [camera, gl, side]);
  const startDrag = (
    event: ThreeEvent<PointerEvent>
  ) => {
    event.stopPropagation();
    if (!group.current) return;
    const cameraDirection =
      new THREE.Vector3();
    camera.getWorldDirection(
      cameraDirection
    );
    drag.current.active = true;
    drag.current.moved = false;
    drag.current.startX =
      event.nativeEvent.clientX;
    drag.current.startY =
      event.nativeEvent.clientY;
    drag.current.startPosition.copy(
      group.current.position
    );
    drag.current.cameraDirection.copy(
      cameraDirection
    );
    drag.current.plane.setFromNormalAndCoplanarPoint(
      cameraDirection,
      group.current.position
    );
    if (side === "a") {
      shared.current.draggingA = true;
    } else {
      shared.current.draggingB = true;
    }
    gl.domElement.style.cursor =
      "grabbing";
  };
  const resetPosition = (
    event: ThreeEvent<MouseEvent>
  ) => {
    event.stopPropagation();
    if (!group.current) return;
    group.current.position.copy(
      simulationPosition
    );
    if (side === "a") {
      shared.current.a.copy(
        simulationPosition
      );
      shared.current.manualA = false;
    } else {
      shared.current.b.copy(
        simulationPosition
      );
      shared.current.manualB = false;
    }
  };
  return (
    <group
      ref={group}
      onPointerDown={startDrag}
      onDoubleClick={resetPosition}
    >
      <Satellite side={side} connected={connected} />
      <Beacon side={side} connected={connected} />
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* SATELLITE                                                                    */
/* -------------------------------------------------------------------------- */
function Satellite({
  side,
  connected,
}: {
  side: "a" | "b";
  connected: boolean;
}) {
  const isEmitter = side === "a";
  const accent = isEmitter ? "#ff3f68" : "#32d8ff";
  const accentSoft = isEmitter ? "#ff9aad" : "#a0f1ff";
  const panelBlue = isEmitter ? "#103c91" : "#0c5378";
  const panelGlow = isEmitter ? "#1b4fd0" : "#087b9c";
  return (
    <group>
      {/* ========================= SPACECRAFT BUS ========================= */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.35, 1.16, 1.34]} />
        <meshStandardMaterial
          color="#657b93"
          metalness={0.94}
          roughness={0.19}
        />
      </mesh>
      {/* recessed equipment deck */}
      <mesh position={[-0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.72, 0.88, 1.12]} />
        <meshStandardMaterial
          color="#101b2b"
          metalness={0.86}
          roughness={0.25}
        />
      </mesh>
      {/* front structural collar */}
      <mesh position={[0.88, 0, 0]}>
        <boxGeometry args={[0.18, 0.96, 1.12]} />
        <meshStandardMaterial
          color="#91a5b8"
          metalness={0.95}
          roughness={0.16}
        />
      </mesh>
      {/* top/bottom structural rails */}
      <mesh position={[-0.08, 0.62, 0]}>
        <boxGeometry args={[1.9, 0.075, 1.15]} />
        <meshStandardMaterial
          color="#b7c5d2"
          metalness={0.95}
          roughness={0.16}
        />
      </mesh>
      <mesh position={[-0.08, -0.62, 0]}>
        <boxGeometry args={[1.9, 0.075, 1.15]} />
        <meshStandardMaterial
          color="#405267"
          metalness={0.95}
          roughness={0.2}
        />
      </mesh>
      {/* rear equipment cap */}
      <mesh position={[-1.03, 0, 0]}>
        <boxGeometry args={[0.16, 0.76, 0.98]} />
        <meshStandardMaterial
          color="#26374c"
          metalness={0.88}
          roughness={0.22}
        />
      </mesh>
      {/* ========================= OPTICAL TERMINAL ========================= */}
      <group>
        {/* precision outer housing */}
        <mesh
          position={[1.28, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
          castShadow
        >
          <cylinderGeometry args={[0.46, 0.5, 0.66, 32]} />
          <meshStandardMaterial
            color="#c8d6e3"
            metalness={0.98}
            roughness={0.12}
          />
        </mesh>
        {/* dark optical barrel */}
        <mesh
          position={[1.63, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.34, 0.39, 0.27, 32]} />
          <meshStandardMaterial
            color="#111a2b"
            metalness={0.94}
            roughness={0.14}
          />
        </mesh>
        {/* outer accent ring */}
        <mesh
          position={[1.79, 0, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <torusGeometry args={[0.28, 0.045, 12, 36]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={connected ? 1 : 0.72}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* optical aperture */}
        <mesh
          position={[1.81, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <cylinderGeometry args={[0.205, 0.205, 0.045, 32]} />
          <meshBasicMaterial
            color={accent}
            transparent
            opacity={connected ? 1 : 0.68}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {/* aperture inner glass */}
        <mesh
          position={[1.835, 0, 0]}
          rotation={[0, 0, Math.PI / 2]}
        >
          <circleGeometry args={[0.145, 32]} />
          <meshBasicMaterial
            color={accentSoft}
            transparent
            opacity={connected ? 0.92 : 0.5}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        {connected && (
          <>
            <pointLight
              position={[1.95, 0, 0]}
              color={accent}
              intensity={isEmitter ? 5.5 : 4.8}
              distance={5}
              decay={2}
            />
            <mesh position={[1.91, 0, 0]}>
              <sphereGeometry args={[0.42, 24, 24]} />
              <meshBasicMaterial
                color={accent}
                transparent
                opacity={0.075}
                blending={THREE.AdditiveBlending}
                depthWrite={false}
              />
            </mesh>
          </>
        )}
      </group>
      {/* ========================= SOLAR ARRAYS ========================= */}
      <SolarPanel
        y={1.72}
        color={panelBlue}
        glow={panelGlow}
        connected={connected}
        side={side}
      />
      <SolarPanel
        y={-1.72}
        color={panelBlue}
        glow={panelGlow}
        connected={connected}
        side={side}
      />
      {/* ========================= AVIONICS ========================= */}
      <mesh position={[-0.18, 0.75, 0.04]} castShadow>
        <boxGeometry args={[0.76, 0.22, 0.34]} />
        <meshStandardMaterial
          color="#213e63"
          emissive="#0b3e83"
          emissiveIntensity={0.65}
          metalness={0.82}
          roughness={0.18}
        />
      </mesh>
      <mesh position={[-0.18, 0.765, 0.215]}>
        <boxGeometry args={[0.46, 0.035, 0.035]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={connected ? 0.95 : 0.35}
        />
      </mesh>
      {/* rear antenna / attitude hardware */}
      <mesh position={[-0.78, 0, 0.69]}>
        <cylinderGeometry args={[0.13, 0.13, 0.25, 16]} />
        <meshStandardMaterial
          color="#9fb0bf"
          metalness={0.94}
          roughness={0.17}
        />
      </mesh>
      <mesh position={[-0.78, 0, 0.84]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      {/* side status light */}
      <mesh position={[-0.35, 0, 0.682]}>
        <boxGeometry args={[0.72, 0.11, 0.018]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={connected ? 0.9 : 0.28}
        />
      </mesh>
    </group>
  );
}
function SolarPanel({
  y,
  color,
  glow,
  connected,
  side,
}: {
  y: number;
  color: string;
  glow: string;
  connected: boolean;
  side: "a" | "b";
}) {
  const accent = side === "a" ? "#ff3f68" : "#32d8ff";
  return (
    <group position={[0, y, 0]}>
      {/* Broad photovoltaic wing.
          It lives above/below the spacecraft so the X-axis optical
          terminal has a completely unobstructed corridor. */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[2.7, 0.075, 4.8]} />
        <meshStandardMaterial
          color={color}
          metalness={0.74}
          roughness={0.22}
          emissive={glow}
          emissiveIntensity={connected ? 0.72 : 0.38}
        />
      </mesh>
      {/* Photovoltaic cell grid */}
      {[-0.9, 0, 0.9].map((x) => (
        <mesh key={`cell-x-${x}`} position={[x, 0.045, 0]}>
          <boxGeometry args={[0.018, 0.012, 4.62]} />
          <meshBasicMaterial color="#70add5" transparent opacity={0.7} />
        </mesh>
      ))}
      {[-1.8, -0.9, 0, 0.9, 1.8].map((z) => (
        <mesh key={`cell-z-${z}`} position={[0, 0.046, z]}>
          <boxGeometry args={[2.58, 0.012, 0.018]} />
          <meshBasicMaterial color="#70add5" transparent opacity={0.68} />
        </mesh>
      ))}
      {/* Aluminium perimeter frame */}
      <mesh position={[0, 0.055, 2.43]}>
        <boxGeometry args={[2.86, 0.08, 0.075]} />
        <meshStandardMaterial color="#b8c6d1" metalness={0.95} roughness={0.16} />
      </mesh>
      <mesh position={[0, 0.055, -2.43]}>
        <boxGeometry args={[2.86, 0.08, 0.075]} />
        <meshStandardMaterial color="#b8c6d1" metalness={0.95} roughness={0.16} />
      </mesh>
      <mesh position={[1.43, 0.055, 0]}>
        <boxGeometry args={[0.075, 0.08, 4.86]} />
        <meshStandardMaterial color="#b8c6d1" metalness={0.95} roughness={0.16} />
      </mesh>
      <mesh position={[-1.43, 0.055, 0]}>
        <boxGeometry args={[0.075, 0.08, 4.86]} />
        <meshStandardMaterial color="#b8c6d1" metalness={0.95} roughness={0.16} />
      </mesh>
      {/* Dual mounting booms */}
      {[-0.75, 0.75].map((x) => (
        <mesh
          key={`boom-${x}`}
          position={[x, y > 0 ? -0.67 : 0.67, 0]}
        >
          <boxGeometry args={[0.12, 1.15, 0.12]} />
          <meshStandardMaterial color="#9eafbd" metalness={0.93} roughness={0.18} />
        </mesh>
      ))}
      {/* Hinge blocks */}
      {[-0.75, 0.75].map((x) => (
        <mesh key={`hinge-${x}`} position={[x, y > 0 ? -0.12 : 0.12, 0]}>
          <cylinderGeometry args={[0.12, 0.12, 0.26, 16]} />
          <meshStandardMaterial color="#718698" metalness={0.94} roughness={0.17} />
        </mesh>
      ))}
      {/* Array health/status lamps */}
      <mesh position={[0, 0.065, y > 0 ? 2.18 : -2.18]}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial
          color={accent}
          transparent
          opacity={connected ? 1 : 0.35}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* BEACON                                                                      */
/* -------------------------------------------------------------------------- */
function Beacon({
  side,
  connected,
}: {
  side: "a" | "b";
  connected: boolean;
}) {
  const light = useRef<THREE.PointLight>(null);
  const isEmitter = side === "a";
  const color = isEmitter ? "#ff3f68" : "#32d8ff";
  useFrame(({ clock }) => {
    if (!light.current) return;
    const t = clock.getElapsedTime();
    light.current.intensity =
      (connected ? 2.6 : 1.25) +
      Math.sin(t * 10) * (connected ? 0.75 : 0.35);
  });
  return (
    <group position={[2.02, 0, 0]}>
      <mesh>
        <sphereGeometry args={[0.14, 24, 24]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.32, 24, 24]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={connected ? 0.13 : 0.055}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <pointLight
        ref={light}
        color={color}
        intensity={2}
        distance={4}
        decay={2}
      />
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* GROUND STATION                                                               */
/* -------------------------------------------------------------------------- */
function GroundStation({
  position,
  onSelect,
}: {
  position: Vec3;
  onSelect?: (t: SceneTarget) => void;
}) {
  return (
    <group
      position={position}
      onClick={(e) => { e.stopPropagation(); onSelect?.("ground"); }}
      onPointerOver={() => { document.body.style.cursor = "pointer"; }}
      onPointerOut={() => { document.body.style.cursor = ""; }}
    >
      <mesh>
        <cylinderGeometry
          args={[1.55, 1.8, 0.35, 32]}
        />
        <meshStandardMaterial
          color="#48617b"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>
      <mesh
        position={[0, 0.7, 0]}
        rotation={[0, 0, -0.55]}
      >
        <cylinderGeometry
          args={[
            0.72,
            0.2,
            1.4,
            30,
            1,
            true,
          ]}
        />
        <meshStandardMaterial
          color="#c1d0dd"
          metalness={0.75}
          roughness={0.25}
        />
      </mesh>
      <pointLight
        position={[0.1, 1.25, 0]}
        color="#ff4eb7"
        intensity={2}
        distance={4}
      />
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* OPTICAL LINK                                                                 */
/* -------------------------------------------------------------------------- */
function AcquisitionCorridor({
  shared,
}: {
  shared: React.MutableRefObject<SharedState>;
}) {
  const corridor = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!corridor.current) return;
    const a = shared.current.a.clone();
    const b = shared.current.b.clone();
    const direction = b.clone().sub(a);
    const length = direction.length();
    if (length < 0.01) return;
    const start = a.clone().add(direction.clone().normalize().multiplyScalar(2.15));
    const end = b.clone().sub(direction.clone().normalize().multiplyScalar(1.8));
    const actual = end.clone().sub(start);
    corridor.current.position.copy(start.clone().add(end).multiplyScalar(0.5));
    corridor.current.scale.set(1, actual.length(), 1);
    corridor.current.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      actual.normalize(),
    );
    const pulse = 0.04 + (Math.sin(clock.getElapsedTime() * 2.5) + 1) * 0.018;
    const material = corridor.current.material as THREE.MeshBasicMaterial;
    material.opacity = pulse;
  });
  return (
    <mesh ref={corridor} renderOrder={20}>
      <cylinderGeometry args={[0.045, 0.045, 1, 10]} />
      <meshBasicMaterial
        color="#3f9ed0"
        transparent
        opacity={0.05}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
function OpticalLink({
  simulation,
  shared,
  ground,
  onSelect,
}: {
  simulation: MissionSnapshot;
  shared: React.MutableRefObject<SharedState>;
  ground: boolean;
  onSelect?: (t: SceneTarget) => void;
}) {
  const hit = useRef<THREE.Mesh>(null);
  const halo = useRef<THREE.Mesh>(null);
  const beam = useRef<THREE.Mesh>(null);
  const core = useRef<THREE.Mesh>(null);
  const pulseA = useRef<THREE.Mesh>(null);
  const pulseB = useRef<THREE.Mesh>(null);
  const pulseC = useRef<THREE.Mesh>(null);
  const connected = simulation.phase === "CONNECTED";
  const acquiring = ![
    "CONNECTED",
    "DISTURBANCE",
    "CORRECTING",
    "TRACK",
  ].includes(simulation.phase);
  useFrame(({ clock }, dt) => {
    if (
      !halo.current ||
      !hit.current ||
      !beam.current ||
      !core.current ||
      !pulseA.current ||
      !pulseB.current ||
      !pulseC.current
    ) {
      return;
    }
    const a = shared.current.a.clone();
    const b = shared.current.b.clone();
    const direction = b.clone().sub(a);
    const length = direction.length();
    if (length < 0.01) return;
    direction.normalize();
    const start = a
      .clone()
      .add(direction.clone().multiplyScalar(2.16));
    const end = b
      .clone()
      .sub(
        direction.clone().multiplyScalar(
          ground ? 0.42 : 2.0
        )
      );
    const actual = end.clone().sub(start);
    const actualLength = actual.length();
    if (actualLength < 0.01) return;
    const middle = start.clone().add(end).multiplyScalar(0.5);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      actual.clone().normalize()
    );
    const smooth = 1 - Math.exp(-dt * 14);
    for (const object of [
      halo.current,
      hit.current,
      beam.current,
      core.current,
    ]) {
      object.position.lerp(middle, smooth);
      object.scale.set(1, actualLength, 1);
      object.quaternion.slerp(quaternion, smooth);
    }
    const pulseTime = clock.getElapsedTime() * (
      connected ? 0.55 : 0.3
    );
    const move = (phase: number) => {
      const t = (pulseTime + phase) % 1;
      return start.clone().lerp(end, t);
    };
    pulseA.current.position.lerp(move(0), smooth);
    pulseB.current.position.lerp(move(0.33), smooth);
    pulseC.current.position.lerp(move(0.66), smooth);
    const pulseScale = connected ? 1.15 : 0.8;
    pulseA.current.scale.setScalar(pulseScale);
    pulseB.current.scale.setScalar(pulseScale);
    pulseC.current.scale.setScalar(pulseScale);
  });
  const color = acquiring
    ? "#69c9ff"
    : connected
      ? "#ff4169"
      : "#ff6a78";
  return (
    <group>
      {/* invisible click target for the link inspector */}
      <mesh
        ref={hit}
        renderOrder={99}
        onClick={(e) => { e.stopPropagation(); onSelect?.("link"); }}
        onPointerOver={() => { document.body.style.cursor = "pointer"; }}
        onPointerOut={() => { document.body.style.cursor = ""; }}
      >
        <cylinderGeometry args={[0.4, 0.4, 1, 12]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} depthTest={false} />
      </mesh>
      {/* broad atmospheric halo */}
      <mesh ref={halo} renderOrder={100}>
        <cylinderGeometry args={[0.19, 0.19, 1, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={connected ? 0.12 : 0.055}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* primary optical link */}
      <mesh ref={beam} renderOrder={101}>
        <cylinderGeometry
          args={[
            connected ? 0.07 : acquiring ? 0.04 : 0.055,
            connected ? 0.07 : acquiring ? 0.04 : 0.055,
            1,
            14,
          ]}
        />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={connected ? 0.92 : acquiring ? 0.42 : 0.78}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* white-hot optical core */}
      <mesh ref={core} renderOrder={102}>
        <cylinderGeometry args={[0.021, 0.021, 1, 10]} />
        <meshBasicMaterial
          color="#fff5f7"
          transparent
          opacity={connected ? 0.9 : 0.6}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </mesh>
      {/* travelling data packets */}
      {[pulseA, pulseB, pulseC].map((ref, index) => (
        <mesh
          key={index}
          ref={ref}
          renderOrder={103}
        >
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial
            color={connected ? "#ffffff" : "#bcecff"}
            transparent
            opacity={connected ? 0.95 : 0.55}
            blending={THREE.AdditiveBlending}
            depthTest={false}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* GHOST MARKER                                                                 */
/* -------------------------------------------------------------------------- */
function GhostMarker({
  position,
}: {
  position: Vec3;
}) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry
          args={[0.6, 18, 18]}
        />
        <meshBasicMaterial
          color="#78a6ff"
          wireframe
          transparent
          opacity={0.36}
        />
      </mesh>
      <pointLight
        color="#6e9eff"
        intensity={0.7}
        distance={3}
      />
    </group>
  );
}
/* -------------------------------------------------------------------------- */
/* INTERACTION HINT                                                             */
/* -------------------------------------------------------------------------- */
function InteractionHint() {
  return (
    <group position={[0, -4.65, 0]}>
      <mesh>
        <planeGeometry args={[0.01, 0.01]} />
        <meshBasicMaterial
          transparent
          opacity={0}
        />
      </mesh>
    </group>
  );
}
