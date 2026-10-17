"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { runScenario, type RunScenarioResponse } from "@/lib/api";
import "./landing.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");
  const [runResult, setRunResult] = useState<RunScenarioResponse | null>(null);
  const [running, setRunning] = useState(false);
  const [runError, setRunError] = useState("");
  const [vibrationHz, setVibrationHz] = useState(17.3);
  const [disturbancePx, setDisturbancePx] = useState(3);
  const [clutter, setClutter] = useState(0.35);

  async function runLiveScenario() {
    setRunning(true);
    setRunError("");
    try {
      const result = await runScenario({
        duration_s: 2,
        fps: 240,
        vibration_freq_hz: vibrationHz,
        vibration_amp_px: disturbancePx,
        clutter_level: clutter,
        noise_rate_hz_per_px: 5,
        seed: 812,
        scintilla_enabled: true,
      });
      setRunResult(result);
    } catch (error) {
      setRunError(error instanceof Error ? error.message : "Scenario request failed.");
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 3500);
    fetch(API_BASE, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then((data) => setApiStatus(data.service === "scintilla-api" ? "online" : "offline"))
      .catch(() => setApiStatus("offline"))
      .finally(() => window.clearTimeout(timer));
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, []);

  return (
    <main className="orbi-landing" id="top">
      <header className="ol-nav">
        <Link className="ol-brand" href="/" aria-label="Orbi home">
          <span className="ol-mark" aria-hidden="true"><i /></span>
          <span>orbi</span>
        </Link>
        <nav className="ol-links" aria-label="Main navigation">
          <a href="#platform">Platform</a>
          <a href="#workflow">Workflow</a>
          <a href="#use-cases">Use cases</a>
          <a href="#research">Research</a>
        </nav>
        <div className="ol-nav-actions">
          <span className={"ol-api-status " + (apiStatus === "online" ? "is-online" : apiStatus === "offline" ? "is-offline" : "")}>
            <i /> API {apiStatus === "checking" ? "CHECKING" : apiStatus === "online" ? "CONNECTED" : "OFFLINE"}
          </span>
          <Link className="ol-button ol-button-dark ol-nav-cta" href="/mission">Open workspace <span>→</span></Link>
        </div>
      </header>

      <section className="ol-hero ol-hero-console">
        <div className="ol-hero-copy ol-console-intro">
          <div className="ol-eyebrow"><span /> ORBI / VIRTUAL FSOC LABORATORY</div>
          <div className="ol-kicker-live"><i /> MISSION SYSTEMS · EXPERIMENTAL ENVIRONMENT</div>
          <h1>Engineer the<br /><em>invisible link.</em></h1>
          <p>A virtual free-space optical test range for acquisition, tracking and pointing. Shape the disturbance, run a scenario, and evaluate the controller against the same conditions.</p>
          <div className="ol-hero-actions">
            <Link className="ol-button ol-button-dark" href="/mission">Enter mission lab <span>↗</span></Link>
            <button className="ol-button ol-button-quiet" onClick={runLiveScenario} disabled={running || apiStatus !== "online"}>
              {running ? "Executing scenario…" : "Execute a scenario"} <span>→</span>
            </button>
          </div>
          <div className="ol-live-footnote"><span>01</span> DEFINE <i /><span>02</span> EXECUTE <i /><span>03</span> VALIDATE</div>
          {runError && <p className="ol-run-error" role="alert">{runError}</p>}
        </div>
        <div className="ol-live-console ol-lab-console">
          <div className="ol-console-top">
            <div><span className="ol-console-eyebrow">MISSION LAB / 01</span><strong>Acquisition &amp; pointing dynamics</strong></div>
            <span className={"ol-console-status " + (apiStatus === "online" ? "online" : "offline")}><i /> {apiStatus === "online" ? "ENGINE ONLINE" : apiStatus === "checking" ? "CONNECTING" : "ENGINE OFFLINE"}</span>
          </div>
          <div className="ol-lab-scene">
            <div className="lab-grid" />
            <div className="lab-axis lab-axis-x" /><div className="lab-axis lab-axis-y" />
            <div className="lab-target-ring ring-a" /><div className="lab-target-ring ring-b" /><div className="lab-target-ring ring-c" />
            <div className="lab-field-label lab-label-tl">POINTING ERROR <b>{runResult ? runResult.control_comparison.disturbance_armed.rms_error_px.toFixed(3) + " px RMS" : "LIVE SENSOR FIELD"}</b></div>
            <div className="lab-field-label lab-label-tr">SC-02 / RECEIVER <b>ACQUISITION WINDOW</b></div>
            <svg className="lab-optics" viewBox="0 0 720 340" preserveAspectRatio="none" aria-label="Curved optical beam between a transmitter telescope and receiver telescope">
              <defs>
                <linearGradient id="beamGradient" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#ff6ad5"/><stop offset="48%" stopColor="#a28cff"/><stop offset="100%" stopColor="#66eff5"/></linearGradient>
                <linearGradient id="beamCone" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#ff6ad5" stopOpacity=".02"/><stop offset="55%" stopColor="#8eafff" stopOpacity=".1"/><stop offset="100%" stopColor="#66eff5" stopOpacity=".18"/></linearGradient>
                <filter id="beamGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <path d="M82 250 C190 236 270 183 360 163 S515 108 612 78 L612 91 C510 123 440 151 360 174 S190 249 82 263 Z" fill="url(#beamCone)"/>
              <path d="M82 256 C188 242 268 184 360 168 S514 111 612 84" fill="none" stroke="url(#beamGradient)" strokeWidth="2.6" filter="url(#beamGlow)"/>
              <path d="M82 256 C188 242 268 184 360 168 S514 111 612 84" fill="none" stroke="#e9fdff" strokeWidth=".7" strokeDasharray="2 8" opacity=".9"/>
              <path d="M82 256 Q360 330 612 84" fill="none" stroke="#74cde9" strokeWidth=".7" strokeDasharray="3 9" opacity=".25"/>
              <g transform="translate(82 256) rotate(-16)">
                <circle r="29" fill="#f36acb" fillOpacity=".08" stroke="#f36acb" strokeOpacity=".8"/>
                <circle r="17" fill="#102637" stroke="#ff8add" strokeWidth="1.2"/>
                <circle r="7" fill="#ff8add" fillOpacity=".25" stroke="#ffd6f4"/>
                <circle r="2.5" fill="#fff"/>
                <path d="M-37 0H-20 M20 0H37 M0 -37V-20 M0 20V37" stroke="#ff8add" strokeWidth=".8" opacity=".8"/>
              </g>
              <g transform="translate(612 84) rotate(12)">
                <circle r="48" fill="#5ce5f2" fillOpacity=".035" stroke="#5ce5f2" strokeOpacity=".7" strokeDasharray="4 5"/>
                <circle r="29" fill="#5ce5f2" fillOpacity=".05" stroke="#5ce5f2" strokeOpacity=".45"/>
                <circle r="17" fill="#112b3a" stroke="#5ce5f2" strokeWidth="1.5"/>
                <circle r="8" fill="#5ce5f2" fillOpacity=".22" stroke="#c4fbff"/>
                <circle r="3" fill="#d9ffff"/>
                <path d="M-56 0H-34 M34 0H56 M0 -56V-34 M0 34V56" stroke="#6ce4ee" strokeWidth=".8" opacity=".7"/>
              </g>
              <g transform="translate(360 168)"><circle r="5" fill="#eaffff" filter="url(#beamGlow)"/><circle r="12" fill="#9beeff" fillOpacity=".12"/></g>
            </svg>           <div className="lab-terminal lab-transmitter"><span>TX</span><b>SC-01</b><small>BEACON SOURCE</small></div>
            <div className="lab-terminal lab-receiver"><span>RX</span><b>SC-02</b><small>ACQUISITION GATE</small></div>
            <div className="lab-scene-footer"><span><i /> OPTICAL PATH / SIMULATED GEOMETRY</span><span>RANGE <b>42.0 KM</b></span></div>
          </div>
          <div className="ol-lab-controls">
            <div className="lab-control-head"><span>SCENARIO PARAMETERS</span><span>ADJUST BEFORE EXECUTION</span></div>
            <label className="lab-parameter"><span>VIBRATION FREQUENCY</span><b>{vibrationHz.toFixed(1)} <small>Hz</small></b><input aria-label="Vibration frequency" type="range" min="1" max="30" step=".1" value={vibrationHz} onChange={(e) => setVibrationHz(Number(e.target.value))} /></label>
            <label className="lab-parameter"><span>BEACON DISTURBANCE</span><b>{disturbancePx.toFixed(1)} <small>px</small></b><input aria-label="Beacon disturbance" type="range" min=".2" max="8" step=".1" value={disturbancePx} onChange={(e) => setDisturbancePx(Number(e.target.value))} /></label>
            <label className="lab-parameter"><span>CLUTTER DENSITY</span><b>{clutter.toFixed(2)} <small>level</small></b><input aria-label="Clutter density" type="range" min="0" max="1" step=".01" value={clutter} onChange={(e) => setClutter(Number(e.target.value))} /></label>
          </div>
          <div className="ol-run-metrics">
            <div><span>NOISY EVENTS</span><strong>{runResult ? runResult.events.n_noisy.toLocaleString() : "—"}</strong><small>{runResult ? "COMPUTED EVENT COUNT" : "AWAITING EXECUTION"}</small></div>
            <div><span>DETECTION HIT RATE</span><strong>{runResult ? (runResult.detections.hit_rate * 100).toFixed(1) + "%" : "—"}</strong><small>{runResult ? runResult.detections.n_hits + " / " + runResult.detections.n_windows + " WINDOWS" : "BACKEND MEASUREMENT"}</small></div>
            <div><span>DOMINANT DISTURBANCE</span><strong>{runResult?.disturbance.dominant_frequency_hz != null ? runResult.disturbance.dominant_frequency_hz.toFixed(2) + " Hz" : "—"}</strong><small>{runResult ? "EVENT PSD ESTIMATE" : "AWAITING MEASUREMENT"}</small></div>
            <div><span>CONTROL RMS ERROR</span><strong>{runResult ? runResult.control_comparison.disturbance_armed.rms_error_px.toFixed(3) + " px" : "—"}</strong><small>{runResult ? "DISTURBANCE-INFORMED" : "AWAITING MEASUREMENT"}</small></div>
          </div>
          <div className="ol-console-bottom">
            <span><i /> {runResult ? "SCENARIO COMPLETE · MEASUREMENTS RECEIVED" : running ? "COMPUTING SCENARIO · PLEASE WAIT" : "ENGINE READY · NO RUN DATA YET"}</span>
            <span>SEED 812 · REPEATABLE CONFIGURATION</span>
          </div>
        </div>
      </section>

      <section className="ol-platform" id="platform">
        <div className="ol-section-kicker"><span>THE PLATFORM</span><i /> FROM SIGNAL TO EVIDENCE</div>
        <div className="ol-platform-heading">
          <h2>An optical link is<br /><em>a system to test.</em></h2>
          <p>Orbi brings the virtual mission environment and Scintilla’s event-based detection and control pipeline into one workflow. Run the engine, inspect the output, and compare control strategies using the same scenario inputs.</p>
        </div>
        <div className="ol-capabilities">
          <article><span className="ol-cap-number">01 / ACQUIRE</span><div className="ol-cap-icon ol-icon-crosshair">⌖</div><h3>Acquire the beacon</h3><p>Generate a controlled scene, produce sensor events, and evaluate learned beacon detection.</p><Link href="/demo">Configure a backend run <span>↗</span></Link></article>
          <article><span className="ol-cap-number">02 / ESTIMATE</span><div className="ol-cap-icon ol-icon-wave">∿</div><h3>Estimate disturbance</h3><p>Inspect centroid traces and frequency-domain vibration estimates from the computed event stream.</p><Link href="/demo">Run event analysis <span>↗</span></Link></article>
          <article><span className="ol-cap-number">03 / CONTROL</span><div className="ol-cap-icon ol-icon-target">◎</div><h3>Compare controllers</h3><p>Compare conventional control against the disturbance-informed controller on the same generated scenario.</p><Link href="/compare">Open comparison workspace <span>↗</span></Link></article>
        </div>
      </section>

      <section className="ol-workflow" id="workflow">
        <div className="ol-workflow-copy">
          <div className="ol-section-kicker"><span>THE WORKFLOW</span><i /> REPEATABLE EXPERIMENTS</div>
          <h2>From acquisition<br />to <em>measured control.</em></h2>
          <p>Start with a parameterised mission. Run the same processing path every time, then review detector hits, disturbance estimates, and control error rather than relying on decorative telemetry.</p>
          <Link className="ol-button ol-button-light" href="/demo">Run a scenario on the engine <span>→</span></Link>
        </div>
        <div className="ol-workflow-steps">
          <div><span>01</span><section><b>Configure</b><p>Set vibration frequency and amplitude, sensor noise, and random seed.</p></section><i>↗</i></div>
          <div><span>02</span><section><b>Compute</b><p>The FastAPI service runs scene generation, event emulation, detection, disturbance estimation and control comparison.</p></section><i>↗</i></div>
          <div><span>03</span><section><b>Inspect</b><p>Review streamed event data, the frame-camera baseline, PSD output, and controller metrics.</p></section><i>↗</i></div>
        </div>
      </section>

      <section className="ol-usecases" id="use-cases">
        <div className="ol-section-kicker"><span>APPLICATIONS</span><i /> TEST THE FAILURE MODES</div>
        <div className="ol-usecases-head"><h2>Find the limits<br /><em>before deployment.</em></h2><p>Explore sensitivity to vibration, clutter and sensor noise; compare event-based processing with a frame-camera baseline; and measure how control performance changes under disturbance.</p></div>
        <div className="ol-usecase-grid">
          <article className="ol-usecase-card ol-usecase-blue"><span>01 / SENSOR</span><div className="ol-usecase-art"><div className="ol-grid-art" /><div className="ol-particle" /><div className="ol-particle p2" /><div className="ol-particle p3" /></div><h3>Event stream vs. frames</h3><p>Compare event detections with exposure-averaged frame-camera measurements.</p><Link href="/demo">Inspect the stream <span>→</span></Link></article>
          <article className="ol-usecase-card ol-usecase-violet"><span>02 / DISTURBANCE</span><div className="ol-usecase-art"><div className="ol-wave-art"><i /><i /><i /></div></div><h3>Vibration &amp; clutter</h3><p>Vary the disturbance profile and inspect the frequency estimate and detection response.</p><Link href="/demo">Change scenario inputs <span>→</span></Link></article>
          <article className="ol-usecase-card ol-usecase-dark"><span>03 / CONTROL</span><div className="ol-usecase-art"><div className="ol-control-art"><i /><i /><i /><b /></div></div><h3>Controller comparison</h3><p>Run frame-based, event-only and Scintilla control paths against a shared generated scenario.</p><Link href="/compare">Compare control paths <span>→</span></Link></article>
        </div>
      </section>

      <section className="ol-research" id="research">
        <div className="ol-research-copy">
          <div className="ol-section-kicker"><span>RESEARCH &amp; VALIDATION</span><i /> TRACEABLE OUTPUTS</div>
          <h2>Every run should<br />leave <em>evidence.</em></h2>
          <p>Backend-generated results can be repeated with a fixed seed. Exported scenario output and documented assumptions make it easier to inspect what was measured, how it was produced, and where the limits remain.</p>
          <Link className="ol-button ol-button-outline" href="/envelope">Open performance envelope <span>→</span></Link>
        </div>
        <div className="ol-research-panel">
          <div className="ol-panel-head"><span>SCINTILLA / PIPELINE</span><span className={apiStatus === "online" ? "ol-state-online" : "ol-state-offline"}><i /> {apiStatus === "online" ? "API CONNECTED" : apiStatus === "checking" ? "CHECKING API" : "API OFFLINE"}</span></div>
          <div className="ol-pipeline">{["SCENE GENERATION", "EVENT EMULATION", "BEACON DETECTION", "DISTURBANCE PSD", "CONTROL COMPARISON"].map((step, i) => <div key={step}><span>{String(i + 1).padStart(2, "0")}</span><b>{step}</b><i>{i === 4 ? "OUTPUT" : "→"}</i></div>)}</div>
          <div className="ol-panel-foot"><span>COMPUTED BY THE BACKEND</span><span>REPRODUCIBLE INPUT SEED</span></div>
        </div>
      </section>

      <section className="ol-final-cta">
        <div><div className="ol-section-kicker"><span>READY TO TEST?</span><i /> OPEN THE REAL WORKSPACE</div><h2>Make the next link<br /><em>measurable.</em></h2></div>
        <div className="ol-final-actions"><Link className="ol-button ol-button-dark" href="/mission">Open Mission Control <span>→</span></Link><Link className="ol-button ol-button-quiet" href="/demo">Run backend scenario <span>↗</span></Link></div>
      </section>

      <footer className="ol-footer"><Link className="ol-brand" href="#top"><span className="ol-mark" aria-hidden="true"><i /></span><span>orbi</span></Link><span>OPTICAL LINKS, BETTER UNDERSTOOD.</span><div><Link href="/mission">Mission Control</Link><Link href="/demo">Backend scenario</Link><Link href="/compare">Comparison</Link></div><small>ORBI · VIRTUAL FSOC SYSTEM</small></footer>
    </main>
  );
}
