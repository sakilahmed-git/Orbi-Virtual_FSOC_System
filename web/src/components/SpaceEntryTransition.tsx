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
  const lastPath = useRef(pathname);

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
    later(() => setStage("ignition"), 850);
    later(() => setStage("ascent"), 1650);
    later(() => setStage("orbit"), 2600);
    later(() => {
      if (target.current) router.push(target.current);
    }, 3250);
  }, [clearTimers, later, pathname, phase, router]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setPhase("arrival");
    setStage("satellite");
    clearTimers();
    // The scene arrives first. Only then does the mission interface assemble around it.
    later(() => setStage("interface"), 950);
    later(() => {
      setPhase("idle");
      setStage("cabin");
    }, 2050);
  }, [pathname, phase, clearTimers, later]);

  useEffect(() => {
    lastPath.current = pathname;
  }, [pathname]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      {children}
      {phase !== "idle" && (
        <div
          className={`space-entry space-entry--${phase} space-entry--${stage}`}
          aria-live="polite"
          role="status"
          aria-label="Orbital launch sequence"
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

          <div className="fpv-flight-scene" aria-hidden="true">
            <div className="fpv-cabin-glow" />
            <div className="fpv-window">
              <div className="fpv-window-sky" />
              <div className="fpv-earth">
                <div className="fpv-earth-clouds" />
                <svg className="fpv-earth-land" viewBox="0 0 520 520" role="presentation">
                  <path d="M104 105 150 72 195 88 215 120 198 151 220 175 202 208 168 219 153 255 125 245 108 208 81 191 76 152Z" />
                  <path d="M208 260 243 276 260 315 249 354 230 398 213 373 205 332 187 298Z" />
                  <path d="M275 105 312 81 352 95 378 122 414 128 430 159 403 184 366 179 346 207 311 194 288 166 260 153Z" />
                  <path d="M335 220 373 207 408 226 416 263 397 299 379 332 353 315 340 277 317 251Z" />
                  <path d="M431 340 457 350 468 373 448 392 426 377Z" />
                </svg>
              </div>
              <div className="fpv-atmosphere-line" />
              <div className="fpv-window-reflection" />
              <div className="fpv-window-rim" />
            </div>

            <div className="fpv-horizon" />
            <div className="fpv-cabin-left" />
            <div className="fpv-cabin-right" />
            <div className="fpv-overhead" />
            <div className="fpv-console">
              <div className="fpv-console-screen"><span /><i /><b /></div>
              <div className="fpv-console-screen fpv-console-screen--small"><span /><i /></div>
              <div className="fpv-console-lights"><i /><i /><i /><i /><i /></div>
            </div>
            <div className="fpv-seat fpv-seat--left" />
            <div className="fpv-seat fpv-seat--right" />
            <div className="fpv-seat-shoulder fpv-seat-shoulder--left" />
            <div className="fpv-seat-shoulder fpv-seat-shoulder--right" />
            <div className="fpv-vignette" />
            <div className="fpv-motion-blur" />
            <div className="fpv-ignition-flare" />
            <div className="fpv-orbit-satellite">
              <svg viewBox="0 0 180 112" role="presentation">
                <defs><linearGradient id="satMetal" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#f7fbff"/><stop offset="1" stopColor="#607b90"/></linearGradient></defs>
                <g stroke="#d5e9f3" strokeWidth="2" fill="none"><path d="M90 52 90 20M90 52 118 66M90 52 62 66"/></g>
                <rect x="75" y="34" width="30" height="35" rx="4" fill="url(#satMetal)" stroke="#f3fbff" />
                <rect x="12" y="35" width="49" height="34" rx="2" fill="#163c60" stroke="#8bd5ed" />
                <rect x="119" y="35" width="49" height="34" rx="2" fill="#163c60" stroke="#8bd5ed" />
                <path d="M24 35v34M36 35v34M48 35v34M131 35v34M143 35v34M155 35v34M12 46h49M12 58h49M119 46h49M119 58h49" stroke="#5ba8d2" strokeWidth="1" />
                <circle cx="90" cy="50" r="6" fill="#e5f8ff" /><path d="M90 69v16m-9-4h18" stroke="#e8f6fc" strokeWidth="2"/>
              </svg>
            </div>
          </div>

          <div className="space-entry__hud">
            <span className="space-entry__brand"><b>◉</b> ORBI <i>MISSION SYSTEMS</i></span>
            <span className="space-entry__readout">
              {stage === "cabin" ? "CABIN SECURE" : stage === "ignition" ? "ENGINE IGNITION" : stage === "ascent" ? "ATMOSPHERIC ASCENT" : stage === "orbit" ? "ORBITAL INSERTION" : stage === "satellite" ? "ORBIT ESTABLISHED" : "MISSION CONTROL"}
              <b>{stage === "cabin" ? "01—06" : stage === "ignition" ? "02—06" : stage === "ascent" ? "03—06" : stage === "orbit" ? "04—06" : stage === "satellite" ? "05—06" : "06—06"}</b>
            </span>
            <div className="space-entry__progress"><i /></div>
            <strong className="space-entry__headline">
              <span>{stage === "cabin" ? "We're leaving Earth." : stage === "ignition" ? "Engines are live." : stage === "ascent" ? "Feel the lift." : stage === "orbit" ? "Earth, falling away." : stage === "satellite" ? "Orbit established." : "Welcome to mission control."}</span>
              <em>{stage === "cabin" ? "Buckle up. You're riding inside the rocket." : stage === "ignition" ? "Cabin locked. Thrust building." : stage === "ascent" ? "The atmosphere turns to midnight." : stage === "orbit" ? "The stars come into focus." : stage === "satellite" ? "Your satellite comes into view." : "Now the instruments come alive."}</em>
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
