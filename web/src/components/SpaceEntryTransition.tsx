"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";

type TransitionContextValue = { enterSpace: (href: string) => void };
type Phase = "idle" | "launch" | "arrival";
const TransitionContext = createContext<TransitionContextValue | null>(null);

export function SpaceEntryTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<Phase>("idle");
  const [arrival, setArrival] = useState(false);
  const target = useRef<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const clearTimers = useCallback(() => { timers.current.forEach(clearTimeout); timers.current = []; }, []);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(setTimeout(fn, ms)); }, []);

  const enterSpace = useCallback((href: string) => {
    if (phase !== "idle" || href === pathname) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { router.push(href); return; }
    clearTimers();
    target.current = href;
    setArrival(false);
    setPhase("launch");
    // A single 7.2-second optical-path sequence. The scene advances via CSS,
    // not React stage changes, so animations cannot restart at each beat.
    later(() => {
      if (!target.current) return;
      window.sessionStorage.setItem("orbi:cinematic-entry", "1");
      router.push(target.current);
    }, 7200);
  }, [phase, pathname, router, clearTimers, later]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setArrival(true);
    setPhase("arrival");
    window.dispatchEvent(new Event("orbi:cinematic-entry"));
    clearTimers();
    // The actual 3D viewport is now behind the optical line; the overlay clears
    // only after the dashboard's existing staged reveal has completed.
    later(() => setPhase("idle"), 3600);
  }, [pathname, phase, clearTimers, later]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      <div className={`orbi-transition-content orbi-transition-content--${phase} ${arrival ? "orbi-transition-content--arrival" : ""}`}>{children}</div>
      {phase !== "idle" && (
        <div className={`orbi-optical-transition orbi-optical-transition--${phase}`} role="status" aria-label="Establishing optical communication link">
          <div className="optical-transition__field" aria-hidden="true">
            <div className="optical-transition__glow" />
            <div className="optical-transition__horizon" />
            <div className="optical-transition__grid" />
            <div className="optical-transition__path"><i /><b /></div>
            <div className="optical-transition__terminal optical-transition__terminal--tx"><i /><b /><span /></div>
            <div className="optical-transition__terminal optical-transition__terminal--rx"><i /><b /><span /></div>
            <div className="optical-transition__acquire"><i /><b /><span /></div>
          </div>
          <div className="optical-transition__top"><span><i /> ORBI <b>OPTICAL SYSTEMS</b></span><span>FSOC / LINK ACQUISITION</span></div>
          <div className="optical-transition__copy">
            <span className="optical-transition__eyebrow">{arrival ? "SYSTEM ONLINE / LIVE TELEMETRY" : "FREE-SPACE OPTICAL COMMUNICATION"}</span>
            <h2>{arrival ? "A link you can understand." : "The light finds its way."}</h2>
            <p>{arrival ? "Observe. Predict. Acquire. Recover." : "One beam. Two terminals. A connection held with precision."}</p>
          </div>
          <div className="optical-transition__bottom"><span><i /> TRANSMITTER <b>→</b> RECEIVER</span><span>{arrival ? "MISSION CONTROL" : "ACQUIRING OPTICAL PATH"}</span></div>
        </div>
      )}
    </TransitionContext.Provider>
  );
}

export function OrbitalTransitionLink({ href, className, children, onClick, ...props }: {
  href: string; className?: string; children: ReactNode; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void; "aria-label"?: string;
}) {
  const context = useContext(TransitionContext);
  if (!context) throw new Error("OrbitalTransitionLink must be inside SpaceEntryTransition");
  return <a href={href} className={className} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    context.enterSpace(href);
  }} {...props}>{children}</a>;
}
