"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";

const beats = [
  { phase: "01 / ESTABLISH", title: "Link acquisition", sub: "ORBITAL WIDE · SYSTEM INITIALISATION" },
  { phase: "02 / ACQUIRE", title: "Lock the receiver", sub: "TELEPHOTO PUSH · BEACON SEARCH" },
  { phase: "03 / TRACK", title: "Hold the optical path", sub: "BEAM-RIDE · POINTING CORRECTION" },
  { phase: "04 / ADAPT", title: "Control under disturbance", sub: "ORBITAL CLOSE-UP · ADAPTIVE RESPONSE" },
  { phase: "05 / VERIFY", title: "Signal integrity", sub: "PULL-BACK · LINK CONFIRMATION" },
];

function makeTerminal(accent: string, receiver = false) {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: "#b8c7d0", metalness: 0.82, roughness: 0.28 });
  const dark = new THREE.MeshStandardMaterial({ color: "#122c3b", metalness: 0.72, roughness: 0.28 });
  const glass = new THREE.MeshPhysicalMaterial({ color: accent, emissive: accent, emissiveIntensity: 1.2, metalness: 0.25, roughness: 0.16, transmission: 0.15 });
  const core = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.48, 0.56), dark);
  group.add(core);
  const bevel = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.06, 0.6), metal);
  bevel.position.y = 0.25;
  group.add(bevel);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.22, 0.18, 32), metal);
  lens.rotation.x = Math.PI / 2;
  lens.position.z = receiver ? 0.38 : -0.38;
  group.add(lens);
  const optic = new THREE.Mesh(new THREE.SphereGeometry(0.13, 24, 16), glass);
  optic.position.z = receiver ? 0.5 : -0.5;
  group.add(optic);
  for (const side of [-1, 1]) {
    const panel = new THREE.Group();
    panel.position.x = side * 1.02;
    const wing = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.56), dark);
    panel.add(wing);
    for (let i = 0; i < 5; i++) {
      const cell = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.064, 0.54),
        new THREE.MeshStandardMaterial({ color: "#6e9eb4", metalness: 0.45, roughness: 0.3, emissive: "#183c53", emissiveIntensity: 0.3 }),
      );
      cell.position.x = -0.38 + i * 0.19;
      panel.add(cell);
    }
    const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.18, 12), metal);
    hinge.rotation.z = Math.PI / 2;
    hinge.position.x = -side * 0.52;
    panel.add(hinge);
    group.add(panel);
  }
  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.53, 0.012, 8, 64),
    new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.8 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -0.28;
  group.add(halo);
  return group;
}

export default function OpticalCinema() {
  const hostRef = useRef<HTMLDivElement>(null);
  const [beatIndex, setBeatIndex] = useState(0);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      host.dataset.webgl = "unavailable";
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.8));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.domElement.className = "orbi-cinema-canvas";
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.prepend(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#071724");
    scene.fog = new THREE.FogExp2("#071724", 0.018);
    const camera = new THREE.PerspectiveCamera(43, host.clientWidth / host.clientHeight, 0.1, 180);
    camera.position.set(0, 9, 22);

    scene.add(new THREE.HemisphereLight("#b9e4f3", "#07111e", 1.65));
    const key = new THREE.DirectionalLight("#f1fbff", 3.3);
    key.position.set(-8, 12, 10);
    scene.add(key);
    const rim = new THREE.PointLight("#4bd8d0", 26, 38);
    rim.position.set(6, 2, -3);
    scene.add(rim);
    const warm = new THREE.PointLight("#e7a95c", 17, 24);
    warm.position.set(-7, -1, 3);
    scene.add(warm);

    const earthGroup = new THREE.Group();
    earthGroup.position.set(0, -13, -20);
    scene.add(earthGroup);
    const earth = new THREE.Mesh(
      new THREE.SphereGeometry(17, 96, 64),
      new THREE.MeshStandardMaterial({ color: "#17475d", roughness: 0.9, metalness: 0.08 }),
    );
    earthGroup.add(earth);
    const landMat = new THREE.MeshStandardMaterial({ color: "#4f8b83", roughness: 1, transparent: true, opacity: 0.75 });
    for (const [x, y, z, sx, sy, sz, rot] of [
      [-9, 3, 13, 2.5, 1.2, 0.45, -0.4], [-3, 5, 15, 1.6, 2.2, 0.35, 0.3],
      [5, 2, 15, 3.4, 1.1, 0.35, 0.8], [9, 5, 12, 1.8, 2.6, 0.3, -0.5],
      [0, -1, 16, 2.7, 0.7, 0.25, -0.2],
    ]) {
      const land = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 2), landMat);
      land.position.set(x, y, z); land.scale.set(sx, sy, sz); land.rotation.z = rot;
      earthGroup.add(land);
    }
    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(17.28, 96, 64),
      new THREE.ShaderMaterial({
        vertexShader: "varying vec3 vNormal; varying vec3 vView; void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0); vNormal=normalize(normalMatrix*normal); vView=normalize(-mv.xyz); gl_Position=projectionMatrix*mv; }",
        fragmentShader: "varying vec3 vNormal; varying vec3 vView; void main(){ float rim=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),3.0); gl_FragColor=vec4(0.22,0.72,0.82,rim*0.62); }",
        blending: THREE.AdditiveBlending, side: THREE.BackSide, transparent: true, depthWrite: false,
      }),
    );
    earthGroup.add(atmosphere);

    const tx = makeTerminal("#e8ad62");
    tx.position.set(-7, 1.1, 0.8);
    tx.rotation.set(0.25, 0.4, -0.15);
    scene.add(tx);
    const rx = makeTerminal("#62e1d1", true);
    rx.position.set(7, 4.0, -2.4);
    rx.rotation.set(-0.18, -0.5, 0.12);
    scene.add(rx);

    const path = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-7, 1.1, 0.8),
      new THREE.Vector3(-3.8, 1.2, -0.15),
      new THREE.Vector3(0, 2.5, -1.1),
      new THREE.Vector3(3.4, 3.6, -2),
      new THREE.Vector3(7, 4.0, -2.4),
    ]);
    const beam = new THREE.Mesh(
      new THREE.TubeGeometry(path, 180, 0.035, 8, false),
      new THREE.MeshBasicMaterial({ color: "#6bd9ed", transparent: true, opacity: 0.94 }),
    );
    scene.add(beam);
    const beamAura = new THREE.Mesh(
      new THREE.TubeGeometry(path, 180, 0.13, 8, false),
      new THREE.MeshBasicMaterial({ color: "#43b9df", transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(beamAura);
    const packet = new THREE.Mesh(
      new THREE.SphereGeometry(0.13, 20, 16),
      new THREE.MeshBasicMaterial({ color: "#f4ffff" }),
    );
    scene.add(packet);
    const packetGlow = new THREE.PointLight("#75e8ff", 6, 5);
    scene.add(packetGlow);

    const ringMaterial = new THREE.MeshBasicMaterial({ color: "#5bd9d0", transparent: true, opacity: 0.52 });
    const receiverRings = [0.75, 1.05, 1.38].map((r) => {
      const mesh = new THREE.Mesh(new THREE.TorusGeometry(r, 0.012, 8, 80), ringMaterial.clone());
      mesh.position.copy(rx.position);
      mesh.rotation.x = Math.PI / 2;
      scene.add(mesh);
      return mesh;
    });
    const scanRings = [1.7, 2.35, 3.0].map((r) => {
      const mesh = new THREE.Mesh(
        new THREE.TorusGeometry(r, 0.008, 6, 100),
        new THREE.MeshBasicMaterial({ color: "#77c9eb", transparent: true, opacity: 0.19 }),
      );
      mesh.position.set(0, 1.5, -1.4);
      mesh.rotation.set(0.9, 0.2, -0.45);
      scene.add(mesh);
      return mesh;
    });

    const starCount = 1600;
    const starPositions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      starPositions[i * 3] = (Math.random() - 0.5) * 105;
      starPositions[i * 3 + 1] = (Math.random() - 0.5) * 70;
      starPositions[i * 3 + 2] = -8 - Math.random() * 65;
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: "#b4d9e8", size: 0.055, transparent: true, opacity: 0.78 }));
    scene.add(stars);

    const grid = new THREE.GridHelper(42, 42, "#2e6b80", "#1d485c");
    grid.position.set(0, -4.8, -3);
    const gridMaterials = Array.isArray(grid.material) ? grid.material : [grid.material];
    gridMaterials.forEach((m) => { m.transparent = true; m.opacity = 0.2; });
    scene.add(grid);

    const shotTargets = [
      { pos: new THREE.Vector3(0, 4.4, 21), look: new THREE.Vector3(0, 1.2, -1.8), fov: 43 },
      { pos: new THREE.Vector3(2.0, 3.4, 10.5), look: new THREE.Vector3(6.4, 3.8, -2.2), fov: 34 },
      { pos: new THREE.Vector3(-1.0, 2.3, 8.2), look: new THREE.Vector3(0, 2.5, -1.3), fov: 39 },
      { pos: new THREE.Vector3(10.2, 6.2, 6.8), look: new THREE.Vector3(6.6, 3.9, -2.2), fov: 31 },
      { pos: new THREE.Vector3(0, 7.2, 19), look: new THREE.Vector3(0, 1.8, -2.8), fov: 47 },
    ];
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let lastBeat = -1;
    let lastWidth = host.clientWidth;
    let lastHeight = host.clientHeight;
    const clock = new THREE.Clock();
    const animate = () => {
      frame = window.requestAnimationFrame(animate);
      const t = clock.getElapsedTime();
      const beatDuration = reducedMotion ? 100000 : 3.6;
      const beat = Math.floor(t / beatDuration) % beats.length;
      const local = (t % beatDuration) / beatDuration;
      if (beat !== lastBeat) {
        lastBeat = beat;
        setBeatIndex(beat);
      }
      const target = shotTargets[beat];
      const cutEase = local < 0.13 ? 1 - Math.pow(1 - local / 0.13, 3) : local > 0.82 ? Math.pow((local - 0.82) / 0.18, 2) : 1;
      const drift = reducedMotion ? 0 : Math.sin(t * 0.32) * 0.22;
      const nextPos = target.pos.clone().add(new THREE.Vector3(drift, Math.sin(t * 0.23) * 0.1, 0));
      camera.position.lerp(nextPos, 0.035 + cutEase * 0.1);
      const look = target.look.clone().add(new THREE.Vector3(0, Math.sin(t * 0.35) * 0.08, 0));
      camera.lookAt(look);
      camera.fov += (target.fov - camera.fov) * 0.06;
      camera.updateProjectionMatrix();
      tx.rotation.y = 0.4 + Math.sin(t * 0.45) * 0.07;
      rx.rotation.y = -0.5 + Math.sin(t * 0.38 + 1) * 0.05;
      earthGroup.rotation.y = t * 0.012;
      stars.rotation.y = t * 0.0025;
      const packetPosition = path.getPoint((t * 0.28) % 1);
      packet.position.copy(packetPosition);
      packetGlow.position.copy(packetPosition);
      beam.material && ((beam.material as THREE.MeshBasicMaterial).opacity = 0.8 + Math.sin(t * 4) * 0.15);
      receiverRings.forEach((ring, i) => {
        const pulse = 1 + ((t * 0.28 + i * 0.3) % 1) * 0.18;
        ring.scale.setScalar(pulse);
        (ring.material as THREE.MeshBasicMaterial).opacity = 0.45 - ((t * 0.28 + i * 0.3) % 1) * 0.22;
      });
      scanRings.forEach((ring, i) => {
        ring.rotation.z += reducedMotion ? 0 : 0.0009 * (i + 1);
        (ring.material as THREE.MeshBasicMaterial).opacity = beat === 1 ? 0.34 : beat === 3 ? 0.24 : 0.1;
      });
      if (host.clientWidth !== lastWidth || host.clientHeight !== lastHeight) {
        lastWidth = host.clientWidth; lastHeight = host.clientHeight;
        renderer.setSize(lastWidth, lastHeight);
        camera.aspect = lastWidth / Math.max(1, lastHeight);
        camera.updateProjectionMatrix();
      }
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      window.cancelAnimationFrame(frame);
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material];
          materials.forEach((material) => material.dispose());
        }
      });
      renderer.domElement.remove();
    };
  }, []);

  const beat = beats[beatIndex];

  return (
    <div className="orbi-cinema" ref={hostRef} aria-label="Cinematic 3D optical-link sequence">
      <div className="orbi-cinema-vignette" aria-hidden="true" />
      <div className="orbi-cinema-cut" aria-hidden="true" />
      <div className="orbi-cinema-top">
        <span><i /> ORBI / MISSION VISUALISATION</span>
        <span className="orbi-cinema-rec"><b /> REC <strong>LIVE RENDER</strong></span>
      </div>
      <div className="orbi-cinema-beat">
        <span className="orbi-cinema-kicker">{beat.phase}</span>
        <h3>{beat.title}</h3>
        <p>{beat.sub}</p>
      </div>
      <div className="orbi-cinema-coordinates"><span>SC-01 / TX</span><i /><span>OPTICAL PATH</span><i /><span>SC-02 / RX</span></div>
      <div className="orbi-cinema-bottom">
        <span>REAL-TIME 3D SCENE <b>·</b> PROCEDURAL OPTICS</span>
        <span className="orbi-cinema-progress">{beats.map((item, i) => <i key={item.phase} className={i === beatIndex ? "active" : ""} />)}</span>
        <span>SHOT 0{beatIndex + 1} / 05</span>
      </div>
      <span className="orbi-cinema-corner top-left" aria-hidden="true">FSC / 01</span>
      <span className="orbi-cinema-corner bottom-right" aria-hidden="true">OPTICAL ENGINEERING / ORBI</span>
    </div>
  );
}
