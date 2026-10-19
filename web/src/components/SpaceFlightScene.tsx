"use client";

import MissionSpace from "@/components/MissionSpace";
import type { MissionSnapshot } from "@/lib/useMissionSimulation";

type Phase = "idle" | "launch" | "arrival";
type Stage = "cabin" | "ignition" | "ascent" | "orbit" | "satellite" | "interface";

/**
 * Reuse the real mission scene for the cinematic handoff.
 * Deliberately do not create a second, decorative satellite or a fake Earth.
 */
const TRANSITION_SNAPSHOT: MissionSnapshot = {
  phase: "CONNECTED",
  time: 0,
  // Match useMissionSimulation's exact t=0 orbital positions so the live
  // dashboard satellites occupy the same coordinates at the handoff frame.
  source: [-6.1, 0, 1.15],
  target: [6.1, 1.637, -0.478],
  currentAxis: [1, 0, 0],
  desiredAxis: [1, 0, 0],
  distanceKm: 1586,
  pointingErrorDeg: 0.04,
  signalDb: -21.8,
  quality: 96,
  dataRate: 9.8,
  latency: 5.94,
  jitter: 0.007,
  confidence: 0.99,
  disturbance: 0,
  adaptive: true,
  learned: true,
  ghost: null,
  uptime: 24,
  cameraOffset: [0, 0],
  beaconVisible: true,
  intelligence: true,
  controller: "scintilla_predictive",
};

export default function SpaceFlightScene({ phase, stage }: { phase: Phase; stage: Stage }) {
  if (phase === "idle" || stage === "interface") return null;

  // Keep the optical link active for the full dialogue and camera journey.
  // The laser should not drop out during ascent/orbit; the transition scene
  // is removed when the interface takes over.
  const simulation = TRANSITION_SNAPSHOT;

  return (
    <div className={`orbi-flight-scene orbi-flight-scene--${phase} orbi-flight-scene--${stage}`} aria-hidden="true">
      <MissionSpace simulation={simulation} ground={false} view="mission" />
    </div>
  );
}
