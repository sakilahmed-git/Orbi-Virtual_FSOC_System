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

const launchDialogue = [
  { text: "Control, we’re picking up a signal beyond the Moon.", speaker: "ASTRONAUT KNOX", src: "/audio/astro1.mp3" },
  { text: "Copy that. Engines are on. Let’s go find out.", speaker: "MISSION CONTROL · TALIA", src: "/audio/missioncontrol1.mp3" },
  { text: "Earth is behind us. The signal’s getting stronger.", speaker: "ASTRONAUT KNOX", src: "/audio/astro2.mp3" },
  { text: "Visual contact. Two satellites, one steady signal.", speaker: "ASTRONAUT KNOX", src: "/audio/astro3.mp3" },
  { text: "Easy… matching their orbit. Keep the link steady.", speaker: "MISSION CONTROL · TALIA", src: "/audio/missioncontrol2.mp3" },
  { text: "Link confirmed. Mission Control, you’re back in.", speaker: "ASTRONAUT KNOX", src: "/audio/astro4.mp3" },
] as const;


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
    setStage("cabin");
    setPhase("launch");

    // Give the transmission a cinematic beat: the words finish typing, breathe,
    // and remain readable while the flight visuals continue behind them.
    later(() => setStage("ignition"), 1600);
    later(() => setStage("ascent"), 3400);
    later(() => setStage("orbit"), 6100);
    later(() => {
      if (target.current) {
        // Persist the hand-off before navigation so the 3D scene can pick it
        // up even if it mounts after the transition component dispatches events.
        window.sessionStorage.setItem("orbi:cinematic-entry", "1");
        router.push(target.current);
      }
    }, 24000);
  }, [clearTimers, later, pathname, phase, router]);

  useEffect(() => {
    if (phase === "idle") return;
    let cancelled = false;
    let headlineTimer: ReturnType<typeof setInterval> | undefined;
    let currentAudio: HTMLAudioElement | undefined;

    const typeText = (text: string, setter: (value: string) => void, speed: number) =>
      new Promise<void>((resolve) => {
        let index = 0;
        setter("");
        headlineTimer = setInterval(() => {
          if (cancelled) {
            clearInterval(headlineTimer);
            resolve();
            return;
          }
          index += 1;
          setter(text.slice(0, index));
          if (index >= text.length) {
            clearInterval(headlineTimer);
            resolve();
          }
        }, speed);
      });

    const runLaunchDialogue = async () => {
      for (const line of launchDialogue) {
        if (cancelled) return;
        setTypedHeadline("");
        setTypedSubline(line.speaker);
        currentAudio = new Audio(line.src);
        currentAudio.preload = "auto";
        let finishAudio!: () => void;
        const audioFinished = new Promise<void>((resolve) => {
          finishAudio = resolve;
          if (!currentAudio) resolve();
          else {
            currentAudio.onended = resolve;
            currentAudio.onerror = resolve;
          }
        });
        const typingFinished = typeText(line.text, setTypedHeadline, 48);
        try {
          await currentAudio.play();
        } catch {
          // Never stall the typewriter if the browser blocks audio playback.
          finishAudio();
        }
        await Promise.all([typingFinished, audioFinished]);
        if (cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 320));
      }
    };

    const runStatusMessage = async () => {
      const arrivalMessages: Record<"satellite" | "interface", [string, string]> = {
        satellite: ["Two satellites. One narrow beam.", "ACQUIRE  /  TRACK  /  MAINTAIN THE OPTICAL LINK"],
        interface: ["What happens when the link drifts?", "ORBI USES LEARNING TO PREDICT, REACQUIRE & RECOVER"],
      };
      const [headline, subline] = arrivalMessages[isInterfaceStage ? "interface" : "satellite"];
      setTypedHeadline("");
      setTypedSubline("");
      await typeText(headline, setTypedHeadline, 44);
      if (cancelled) return;
      await new Promise((resolve) => setTimeout(resolve, 180));
      await typeText(subline, setTypedSubline, 24);
    };

    if (phase === "launch") void runLaunchDialogue();
    else void runStatusMessage();

    return () => {
      cancelled = true;
      if (headlineTimer) clearInterval(headlineTimer);
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }
    };
  }, [phase, isInterfaceStage]);

  useEffect(() => {
    if (phase !== "launch" || !target.current || pathname === "/" || pathname !== target.current) return;
    target.current = null;
    setPhase("arrival");
    setStage("satellite");
    window.dispatchEvent(new Event("orbi:cinematic-entry"));
    clearTimers();
    // Hold the real 3D scene long enough for the acquisition message to land.
    later(() => setStage("interface"), 3400);
    later(() => {
      setPhase("idle");
      setStage("cabin");
    }, 6400);
  }, [pathname, phase, clearTimers, later]);


  useEffect(() => () => clearTimers(), [clearTimers]);

  return (
    <TransitionContext.Provider value={{ enterSpace }}>
      <div className={`orbi-transition-content orbi-transition-content--${phase} orbi-transition-content--${stage}`}>{children}</div>
      {phase !== "idle" && (
        <div
          className={`orbi-transition-overlay orbi-transition-overlay--${phase} orbi-transition-overlay--${stage} ${phase === "launch" ? "orbi-transition-overlay--flight" : ""}`}
          aria-live="polite"
          role="status"
          aria-label="Orbital launch sequence"
        >
          <div className="orbi-cinema__wash" />
          <div className="orbi-cinema__cockpit" aria-hidden="true">
            <div className="orbi-cinema__cockpit-top"><span>ORBI / FPV</span><span>CAM 01 · LIVE</span></div>
            <i className="orbi-cinema__cockpit-corner orbi-cinema__cockpit-corner--tl" />
            <i className="orbi-cinema__cockpit-corner orbi-cinema__cockpit-corner--tr" />
            <i className="orbi-cinema__cockpit-corner orbi-cinema__cockpit-corner--bl" />
            <i className="orbi-cinema__cockpit-corner orbi-cinema__cockpit-corner--br" />
            <div className="orbi-cinema__reticle"><i /></div>
            <div className="orbi-cinema__cockpit-bottom"><span>ATTITUDE <b>STABLE</b></span><span>VELOCITY <b>INCREASING</b></span></div>
          </div>
          <div className="orbi-cinema__stars" aria-hidden="true">
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
          <div className="orbi-cinema__satellite-field" aria-hidden="true">
            <div className="orbi-cinema__planet-horizon" />
            <div className="orbi-cinema__optical-beam"><i /></div>
            <div className="orbi-cinema__satellite orbi-cinema__satellite--near"><span className="orbi-cinema__solar-panel" /><b /><span className="orbi-cinema__solar-panel" /></div>
            <div className="orbi-cinema__satellite orbi-cinema__satellite--far"><span className="orbi-cinema__solar-panel" /><b /><span className="orbi-cinema__solar-panel" /></div>
            <span className="orbi-cinema__satellite-label orbi-cinema__satellite-label--near">SPACECRAFT A / TRANSMITTER</span>
            <span className="orbi-cinema__satellite-label orbi-cinema__satellite-label--far">SPACECRAFT B / RECEIVER</span>
          </div>

          <div className="orbi-cinema__hud">
            <span className="orbi-cinema__brand"><b>◉</b> ORBI <i>MISSION SYSTEMS</i></span>
            <span className="orbi-cinema__readout">
              {stage === "cabin" ? "CABIN SECURE" : stage === "ignition" ? "ENGINE IGNITION" : stage === "ascent" ? "ATMOSPHERIC ASCENT" : stage === "orbit" ? "ORBITAL INSERTION" : stage === "satellite" ? "ORBIT ESTABLISHED" : "MISSION CONTROL"}
              <b>{stage === "cabin" ? "01—06" : stage === "ignition" ? "02—06" : stage === "ascent" ? "03—06" : stage === "orbit" ? "04—06" : stage === "satellite" ? "05—06" : "06—06"}</b>
            </span>
            <div className="orbi-cinema__progress"><i /></div>
            <strong className="orbi-cinema__headline" aria-live="polite">
              <span>{typedHeadline}<i className="orbi-cinema__typing-cursor" aria-hidden="true" /></span>
              <em>{typedSubline}{typedSubline.length > 0 && <i className="orbi-cinema__typing-cursor orbi-cinema__typing-cursor--sub" aria-hidden="true" />}</em>
            </strong>
            <div className="orbi-cinema__steps">
              <span className={["cabin", "ignition", "ascent"].includes(stage) ? "is-current" : "is-done"}><i /> ASCENT</span>
              <span className={["orbit"].includes(stage) ? "is-current" : ["satellite", "interface"].includes(stage) ? "is-done" : ""}><i /> ORBIT</span>
              <span className={stage === "interface" ? "is-current" : ""}><i /> MISSION CONTROL</span>
            </div>
          </div>
          <div className="orbi-cinema__flash" aria-hidden="true" />
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
