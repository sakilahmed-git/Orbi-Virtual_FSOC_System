"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";
import MissionSpace from "./MissionSpace";
import { useMissionSimulation } from "@/lib/useMissionSimulation";

type TransitionContextValue = { enterSpace: (href: string) => void };
type TransitionPhase = "idle" | "launch" | "arrival";
type FlightStage = "cabin" | "ignition" | "ascent" | "orbit" | "satellite" | "interface";

const TransitionContext = createContext<TransitionContextValue | null>(null);

function CinematicMissionScene() {
  const { snapshot } = useMissionSimulation();
  return (
    <div className="space-entry__scene" aria-hidden="true">
      <MissionSpace simulation={snapshot} ground={false} view="mission" />
    </div>
  );
}

export function SpaceEntryTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [stage, setStage] = useState<FlightStage>("cabin");
  const target = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [typedHeadline, setTypedHeadline] = useState("");
  const [typedSubline, setTypedSubline] = useState("");
  const isInterfaceStage = stage === "interface";

  const clearTimers = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  }, []);

  const later = useCallback((fn: () => void, ms: number) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  const enterSpace = useCallback((href: string) => {
    if (phase !== "idle" || href === pathname) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    clearTimers();
    target.current = href;
    window.sessionStorage.setItem("orbi:cinematic-entry", "1");
    setStage("cabin");
    setPhase("launch");

    // Give the transmission a cinematic beat: the words finish typing, breathe,
    // and remain readable while the flight visuals continue behind them.
    later(() => setStage("ignition"), 620);
    later(() => setStage("ascent"), 1420);
    later(() => setStage("orbit"), 2740);
    later(() => {
      if (target.current) {
        // Persist the hand-off before navigation so the 3D scene can pick it
        // up even if it mounts after the transition component dispatches events.
        window.sessionStorage.setItem("orbi:cinematic-entry", "1");
        router.push(target.current);
      }
    }, 4300);
  }, [clearTimers, later, pathname, phase, router]);

  useEffect(() => {
    if (phase === "idle") return;
    const launchMessage: [string, string] = [
      "Buckle up. We're going to space.",
      "FLIGHT COMPUTER  /  TRANSMISSION IN",
    ];
    const arrivalMessages: Record<"satellite" | "interface", [string, string]> = {
      satellite: ["SATELLITES IN VIEW", "OPTICAL LINK  /  STANDBY"],
      interface: ["MISSION READY", "LIVE TELEMETRY"],
    };
    const messageKey = phase === "launch" ? "launch" : isInterfaceStage ? "interface" : "satellite";
    const [headline, subline] = messageKey === "launch"
      ? launchMessage
      : arrivalMessages[messageKey];

    setTypedHeadline("");
    setTypedSubline("");
    let headlineIndex = 0;
    let sublineIndex = 0;
    let sublineTimer: ReturnType<typeof setInterval> | undefined;

    // Slow, deliberate typewriter timing. Crucially, depend on phase rather
    // than every flight stage, so ignition/ascent/orbit never reset the text.
    const headlineTimer = setInterval(() => {
      headlineIndex += 1;
      setTypedHeadline(headline.slice(0, headlineIndex));
      if (headlineIndex >= headline.length) {
        clearInterval(headlineTimer);
        // A short dramatic pause before the smaller transmission line begins.
        sublineTimer = setInterval(() => {
          sublineIndex += 1;
          setTypedSubline(subline.slice(0, sublineIndex));
          if (sublineIndex >= subline.length) clearInterval(sublineTimer);
        }, 38);
      }
    }, phase === "launch" ? 58 : 48);

    return () => {
      clearInterval(headlineTimer);
      if (sublineTimer) clearInterval(sublineTimer);
    };
  }, [phase, isInterfaceStage]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setPhase("arrival");
    setStage("satellite");
    window.sessionStorage.setItem("orbi:cinematic-entry", "1");
    window.dispatchEvent(new Event("orbi:cinematic-entry"));
    clearTimers();
    // Hold the real 3D scene long enough for the acquisition message to land.
    later(() => setStage("interface"), 2100);
    later(() => {
      setPhase("idle");
      setStage("cabin");
    }, 3900);
  }, [pathname, phase, clearTimers, later]);


  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      <div className={`orbi-transition-content orbi-transition-content--${phase} orbi-transition-content--${stage}`}>{children}</div>
      {phase !== "idle" && (
        <div
          className={`space-entry space-entry--${phase} space-entry--${stage} ${phase === "launch" ? "space-entry--flight" : ""}`}
          aria-live="polite"
          role="status"
          aria-label="Orbital launch sequence"
        >
          <div className="space-entry__wash" />
          <CinematicMissionScene />
          <div className="space-entry__cockpit" aria-hidden="true">
            <div className="space-entry__cockpit-top"><span>ORBI / FPV</span><span>CAM 01 · LIVE</span></div>
            <i className="space-entry__cockpit-corner space-entry__cockpit-corner--tl" />
            <i className="space-entry__cockpit-corner space-entry__cockpit-corner--tr" />
            <i className="space-entry__cockpit-corner space-entry__cockpit-corner--bl" />
            <i className="space-entry__cockpit-corner space-entry__cockpit-corner--br" />
            <div className="space-entry__reticle"><i /></div>
            <div className="space-entry__cockpit-bottom"><span>ATTITUDE <b>STABLE</b></span><span>VELOCITY <b>INCREASING</b></span></div>
          </div>
          <div className="space-entry__stars" aria-hidden="true">
            {Array.from({ length: 76 }, (_, i) => (
              <i key={i} style={{
                "--star-x": `${(i * 37 + 11) % 100}%`,
                "--star-y": `${(i * 53 + 7) % 100}%`,
                "--star-dx": `${(((i * 37 + 11) % 100) - 50) * 0.7}vw`,
                "--star-dy": `${(((i * 53 + 7) % 100) - 50) * 0.7}vh`,
                "--star-delay": `${(i % 11) * -0.09}s`,
                "--star-size": `${i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1}px`,
              } as CSSProperties} />
            ))}
          </div>

          <div className="space-entry__hud">
            <span className="space-entry__brand"><b>◉</b> ORBI <i>MISSION SYSTEMS</i></span>
            <span className="space-entry__readout">
              {stage === "cabin" ? "CABIN SECURE" : stage === "ignition" ? "ENGINE IGNITION" : stage === "ascent" ? "ATMOSPHERIC ASCENT" : stage === "orbit" ? "ORBITAL INSERTION" : stage === "satellite" ? "ORBIT ESTABLISHED" : "MISSION CONTROL"}
              <b>{stage === "cabin" ? "01—06" : stage === "ignition" ? "02—06" : stage === "ascent" ? "03—06" : stage === "orbit" ? "04—06" : stage === "satellite" ? "05—06" : "06—06"}</b>
            </span>
            <div className="space-entry__progress"><i /></div>
            <strong className="space-entry__headline" aria-live="polite">
              <span>{typedHeadline}<i className="space-entry__typing-cursor" aria-hidden="true" /></span>
              <em>{typedSubline}{typedSubline.length > 0 && <i className="space-entry__typing-cursor space-entry__typing-cursor--sub" aria-hidden="true" />}</em>
            </strong>
            <div className="space-entry__steps">
              <span className={["cabin", "ignition", "ascent"].includes(stage) ? "is-current" : "is-done"}><i /> ASCENT</span>
              <span className={["orbit"].includes(stage) ? "is-current" : ["satellite", "interface"].includes(stage) ? "is-done" : ""}><i /> ORBIT</span>
              <span className={stage === "interface" ? "is-current" : ""}><i /> MISSION CONTROL</span>
            </div>
          </div>
          <div className="space-entry__flash" aria-hidden="true" />
        </div>
      )}
    </TransitionContext.Provider>
  );
}

export function OrbitalTransitionLink({
  href, className, children, onClick, ...props
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLAnchorElement>) => void;
  "aria-label"?: string;
}) {
  const context = useContext(TransitionContext);
  if (!context) throw new Error("OrbitalTransitionLink must be inside SpaceEntryTransition");
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        event.currentTarget.classList.add("orbi-launch-trigger");
        context.enterSpace(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
