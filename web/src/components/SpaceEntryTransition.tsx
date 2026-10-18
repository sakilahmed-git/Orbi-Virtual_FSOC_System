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
    }, 5400);
  }, [phase, pathname, router, clearTimers, later]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setArrival(true);
    setPhase("arrival");
    window.dispatchEvent(new Event("orbi:cinematic-entry"));
    clearTimers();
    // The destination route is live underneath. Fade the optical overlay away
    // quickly so the real Mission Control UI is revealed, not held behind it.
    later(() => setPhase("idle"), 1800);
  }, [pathname, phase, clearTimers, later]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      <div className={`orbi-transition-content orbi-transition-content--${phase} ${arrival ? "orbi-transition-content--arrival" : ""}`}>{children}</div>
      {phase !== "idle" && (
        <div className={`orbi-optical-transition orbi-optical-transition--${phase}`} role="status" aria-label="Approaching satellite and opening Mission Control cockpit">
          <div className="cockpit-scene" aria-hidden="true">
            <div className="cockpit-scene__stars" />
            <div className="cockpit-scene__planet"><i /><b /></div>
            <div className="cockpit-scene__satellite cockpit-scene__satellite--near">
              <i className="cockpit-scene__body" /><b className="cockpit-scene__dish" /><span className="cockpit-scene__panel cockpit-scene__panel--left" /><span className="cockpit-scene__panel cockpit-scene__panel--right" />
            </div>
            <div className="cockpit-scene__satellite cockpit-scene__satellite--far">
              <i className="cockpit-scene__body" /><b className="cockpit-scene__dish" /><span className="cockpit-scene__panel cockpit-scene__panel--left" /><span className="cockpit-scene__panel cockpit-scene__panel--right" />
            </div>
            <div className="cockpit-scene__approach-line" />
            <div className="cockpit-scene__vignette" />
            <div className="cockpit-scene__frame cockpit-scene__frame--top" />
            <div className="cockpit-scene__frame cockpit-scene__frame--left" />
            <div className="cockpit-scene__frame cockpit-scene__frame--right" />
            <div className="cockpit-scene__frame cockpit-scene__frame--bottom" />
            <div className="cockpit-scene__door cockpit-scene__door--left" />
            <div className="cockpit-scene__door cockpit-scene__door--right" />
            <div className="cockpit-scene__hud"><span>RELATIVE RANGE <b>02.4 KM</b></span><span>OPTICAL LOCK <b><i /></b></span><span>ATTITUDE <b>STABLE</b></span></div>
          </div>
          <div className="optical-transition__top"><span><i /> ORBI <b>MISSION APPROACH</b></span><span>{arrival ? "COCKPIT OPEN / CONTROL TRANSFERRED" : "RENDEZVOUS SEQUENCE"}</span></div>
          <div className="optical-transition__copy">
            <span className="optical-transition__eyebrow">{arrival ? "MISSION CONTROL / ONLINE" : "APPROACHING ORBITAL TERMINAL"}</span>
            <h2>{arrival ? "Welcome to Mission Control." : "Closing the distance."}</h2>
            <p>{arrival ? "The cockpit opens. Your live workspace is ready." : "Bringing the optical terminal into view. Preparing control handoff."}</p>
          </div>
          <div className="optical-transition__bottom"><span><i /> RANGE DECREASING <b>→</b> DOCKING ALIGNMENT</span><span>{arrival ? "DASHBOARD READY" : "APPROACH / AUTO"}</span></div>
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
