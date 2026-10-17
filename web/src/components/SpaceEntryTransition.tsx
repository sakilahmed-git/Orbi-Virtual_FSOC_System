"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from "react";
import { usePathname, useRouter } from "next/navigation";

type TransitionContextValue = {
  enterSpace: (href: string) => void;
};
type TransitionPhase = "idle" | "launch" | "arrival";

const TransitionContext = createContext<TransitionContextValue | null>(null);

export function SpaceEntryTransition({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [phase, setPhase] = useState<TransitionPhase>("idle");
  const target = useRef<string | null>(null);
  const launchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const arrivalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const enterSpace = useCallback((href: string) => {
    if (phase !== "idle" || href === pathname) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      router.push(href);
      return;
    }
    target.current = href;
    setPhase("launch");
    launchTimer.current = setTimeout(() => {
      if (target.current) router.push(target.current);
    }, 1420);
  }, [pathname, phase, router]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/") return;
    if (pathname === target.current) {
      if (launchTimer.current) clearTimeout(launchTimer.current);
      target.current = null;
      setPhase("arrival");
      arrivalTimer.current = setTimeout(() => setPhase("idle"), 760);
    }
  }, [pathname, phase]);

  useEffect(() => () => {
    if (launchTimer.current) clearTimeout(launchTimer.current);
    if (arrivalTimer.current) clearTimeout(arrivalTimer.current);
  }, []);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      {children}
      {phase !== "idle" && (
        <div className={`space-entry space-entry--${phase}`} aria-live="polite" role="status">
          <div className="space-entry__wash" />
          <div className="space-entry__earth">
            <div className="space-entry__earth-grid" />
            <div className="space-entry__atmosphere" />
          </div>
          <div className="space-entry__stars" aria-hidden="true">
            {Array.from({ length: 34 }, (_, i) => (
              <i key={i} style={{
                "--star-x": `${(i * 37 + 11) % 100}%`,
                "--star-y": `${(i * 53 + 7) % 100}%`,
                "--star-delay": `${(i % 9) * -0.11}s`,
                "--star-size": `${i % 5 === 0 ? 3 : i % 3 === 0 ? 2 : 1}px`,
              } as React.CSSProperties} />
            ))}
          </div>
          <div className="space-entry__tunnel" aria-hidden="true"><i /><i /><i /></div>
          <div className="space-entry__beam" aria-hidden="true" />
          <div className="space-entry__hud">
            <span className="space-entry__brand"><b>◉</b> ORBI <i>MISSION SYSTEMS</i></span>
            <span className="space-entry__readout">TRANSIT SEQUENCE <b>01—04</b></span>
            <div className="space-entry__progress"><i /></div>
            <strong className="space-entry__headline">
              <span>Leaving the atmosphere.</span>
              <em>Entering the link.</em>
            </strong>
            <div className="space-entry__steps">
              <span><i /> ASCENT</span><span><i /> ORBITAL INSERTION</span><span><i /> MISSION CONTROL</span>
            </div>
          </div>
          <div className="space-entry__flash" aria-hidden="true" />
        </div>
      )}
    </TransitionContext.Provider>
  );
}

export function OrbitalTransitionLink({
  href,
  className,
  children,
  onClick,
  ...props
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
