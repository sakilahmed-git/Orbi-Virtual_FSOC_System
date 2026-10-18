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

function TypewriterText({ text, className, speed = 92 }: { text: string; className?: string; speed?: number }) {
  const [visibleText, setVisibleText] = useState("");

  useEffect(() => {
    setVisibleText("");
    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setVisibleText(text.slice(0, index));
      if (index >= text.length) window.clearInterval(timer);
    }, speed);
    return () => window.clearInterval(timer);
  }, [text, speed]);

  return <span className={className}>{visibleText}<i className="space-entry__type-caret" aria-hidden="true" /></span>;
}

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function SpaceEntryTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const [stage, setStage] = useState<FlightStage>("cabin");
  const target = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

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

    // One continuous first-person flight: cabin -> ignition -> atmospheric ascent -> orbit.
    later(() => setStage("ignition"), 2400);
    later(() => setStage("ascent"), 4800);
    later(() => setStage("orbit"), 6200);
    later(() => {
      if (!target.current) return;
      window.sessionStorage.setItem("orbi:cinematic-entry", "1");
      router.push(target.current);
    }, 10800);
  }, [clearTimers, later, pathname, phase, router]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setPhase("arrival");
    setStage("satellite");
    clearTimers();
    // The scene arrives first. Only then does the mission interface assemble around it.
    later(() => setStage("interface"), 3200);
    later(() => {
      setPhase("idle");
      setStage("cabin");
    }, 5000);
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
          aria-label="Orbital transition sequence"
        >
          <div className="space-entry__wash" />
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

          <div className="orbi-warp-field" aria-hidden="true">
            <div className="orbi-warp-field__nebula" />
            <div className="orbi-warp-field__grid" />
            <div className="orbi-warp-field__rings">
              <i />
              <i />
              <i />
            </div>
            <div className="orbi-warp-field__core">
              <i />
              <b />
            </div>
            <div className="orbi-warp-field__scan" />
            <div className="orbi-warp-field__horizon" />
          </div>

          <div className="space-entry__hud">
            <span className="space-entry__brand"><b>◉</b> ORBI <i>MISSION SYSTEMS</i></span>
            <span className="space-entry__readout">
              {stage === "cabin" ? "SYSTEMS ONLINE" : stage === "ignition" ? "SIGNAL LOCK" : stage === "ascent" ? "PHASE SHIFT" : stage === "orbit" ? "ORBITAL SYNC" : stage === "satellite" ? "TARGET ACQUIRED" : "MISSION CONTROL"}
              <b>{stage === "cabin" ? "01—06" : stage === "ignition" ? "02—06" : stage === "ascent" ? "03—06" : stage === "orbit" ? "04—06" : stage === "satellite" ? "05—06" : "06—06"}</b>
            </span>
            <div className="space-entry__progress"><i /></div>
            <strong className="space-entry__headline">
              <TypewriterText key={`headline-${stage}`} text={stage === "cabin" ? "Beyond the interface." : stage === "ignition" ? "Locking the signal." : stage === "ascent" ? "Entering the field." : stage === "orbit" ? "Space, in perfect sync." : stage === "satellite" ? "Target acquired." : "Mission control, online."} />

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
