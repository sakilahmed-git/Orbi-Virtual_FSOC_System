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

type TransitionContextValue = { enterSpace: (href: string) => void };
type TransitionPhase = "idle" | "launch" | "arrival";
type FlightStage = "cabin" | "ignition" | "ascent" | "orbit" | "satellite" | "interface";

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function SpaceEntryTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [stage, setStage] = useState<FlightStage>("cabin");
  const target = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [typedHeadline, setTypedHeadline] = useState("");
  const [typedSubline, setTypedSubline] = useState("");

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
    setStage("cabin");
    setPhase("launch");

    // Short, precise beats: let the FPV motion do the storytelling.
    later(() => setStage("ignition"), 800);
    later(() => setStage("ascent"), 1550);
    later(() => setStage("orbit"), 2350);
    later(() => {
      if (target.current) router.push(target.current);
    }, 3100);
  }, [clearTimers, later, pathname, phase, router]);

  useEffect(() => {
    const transmissions: Record<FlightStage, [string, string]> = {
      cabin: ["Buckle up. We're going to space.", "FLIGHT COMPUTER  /  TRANSMISSION IN"],
      ignition: ["IGNITION", "THRUST NOMINAL"],
      ascent: ["ASCENT", "ATMOSPHERIC EXIT"],
      orbit: ["ORBIT LOCK", "OPTICAL TARGET ACQUISITION"],
      satellite: ["LINK ACQUIRED", "FSO SYSTEM ONLINE"],
      interface: ["MISSION READY", "LIVE TELEMETRY"],
    };
    const [headline, subline] = transmissions[stage];
    setTypedHeadline("");
    setTypedSubline("");
    let headlineIndex = 0;
    let sublineIndex = 0;
    const headlineTimer = setInterval(() => {
      headlineIndex += 1;
      setTypedHeadline(headline.slice(0, headlineIndex));
      if (headlineIndex >= headline.length) {
        clearInterval(headlineTimer);
        const sublineTimer = setInterval(() => {
          sublineIndex += 1;
          setTypedSubline(subline.slice(0, sublineIndex));
          if (sublineIndex >= subline.length) clearInterval(sublineTimer);
        }, 20);
      }
    }, 29);
    return () => clearInterval(headlineTimer);
  }, [stage, phase]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setPhase("arrival");
    setStage("satellite");
    clearTimers();
    // Let the live scene breathe before revealing the instruments.
    later(() => setStage("interface"), 1750);
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
          className={`space-entry space-entry--${phase} space-entry--${stage}`}
          aria-live="polite"
          role="status"
          aria-label="Orbital launch sequence"
        >
          <div className="space-entry__wash" />
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
        context.enterSpace(href);
      }}
      {...props}
    >
      {children}
    </a>
  );
}
