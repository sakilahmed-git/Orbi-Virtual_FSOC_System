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

      <section className="orbi-showcase" aria-labelledby="hero-title">
        <div className="orbi-hero-stage">
          <div className="orbi-hero-copy">
            <div className="orbi-eyebrow"><span /> VIRTUAL FSOC LABORATORY <span className="orbi-eyebrow-rule" /></div>
            <h1 id="hero-title">Engineer the next generation of <em>optical links.</em></h1>
            <p>A software-in-the-loop testbed for acquisition, tracking and control of free-space optical communication links.</p>
            <div className="orbi-hero-actions">
              <button className="orbi-primary-action" onClick={runLiveScenario} disabled={running || apiStatus !== "online"}>
                {running ? "Running experiment…" : "Run live experiment"} <span>↗</span>
              </button>
              <Link className="orbi-secondary-action" href="/mission">Explore the workspace <span>→</span></Link>
            </div>
            <div className="orbi-trust-line"><span><i /> Reproducible scenarios</span><span><i /> Measured outcomes</span><span><i /> Backend-powered</span></div>
            {runError && <p className="orbi-error" role="alert">{runError}</p>}
          </div>
          <div className="orbi-hero-visual" aria-label="Conceptual free-space optical link visualization">
            <div className="orbi-visual-topline"><span>OPTICAL LINK / SC-01 → SC-02</span><span className={"orbi-live-state " + (apiStatus === "online" ? "is-live" : "")}><i /> {apiStatus === "online" ? "ENGINE ONLINE" : apiStatus === "checking" ? "CONNECTING" : "ENGINE OFFLINE"}</span></div>
            <div className="orbi-space-scene">
              <div className="orbi-earth-horizon"><div className="orbi-earth-atmosphere" /><div className="orbi-earth-continent continent-a" /><div className="orbi-earth-continent continent-b" /></div>
              <div className="orbi-scene-stars" />
              <svg className="orbi-beam-art" viewBox="0 0 760 420" preserveAspectRatio="none" aria-hidden="true">
                <defs>
                  <linearGradient id="orbiBeam" x1="0" y1="1" x2="1" y2="0"><stop offset="0%" stopColor="#D9A45D"/><stop offset="45%" stopColor="#77A8DC"/><stop offset="100%" stopColor="#3C9F96"/></linearGradient>
                  <linearGradient id="orbiBeamCone" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#D9A45D" stopOpacity=".02"/><stop offset="100%" stopColor="#72C8BF" stopOpacity=".2"/></linearGradient>
                  <filter id="orbiBeamSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                </defs>
                <path d="M112 247 Q330 235 630 88 L630 111 Q330 255 112 260Z" fill="url(#orbiBeamCone)"/>
                <path d="M112 253 Q330 245 630 100" stroke="url(#orbiBeam)" strokeWidth="2.4" fill="none" filter="url(#orbiBeamSoft)"/>
                <path d="M112 253 Q330 245 630 100" stroke="#F5FFFF" strokeWidth=".65" strokeDasharray="3 8" opacity=".85" fill="none"/>
                <path d="M112 253 Q370 340 630 100" stroke="#A9D9D7" strokeWidth=".7" strokeDasharray="3 9" opacity=".25" fill="none"/>
                <g transform="translate(112 253)">
                  <circle r="31" fill="#D9A45D" fillOpacity=".08" stroke="#E4BD83" strokeWidth="1.2"/>
                  <circle r="18" fill="#102331" stroke="#E4BD83" strokeWidth="1.2"/>
                  <circle r="8" fill="#D9A45D" fillOpacity=".3" stroke="#F5D7A8"/>
                  <circle r="3" fill="#FFF6E7"/>
                  <path d="M-42 0H-23 M23 0H42 M0 -42V-23 M0 23V42" stroke="#E4BD83" strokeWidth=".8"/>
                </g>
                <g transform="translate(630 100)">
                  <circle r="51" fill="#3C9F96" fillOpacity=".04" stroke="#6FC7BE" strokeDasharray="4 5" strokeWidth="1.2"/>
                  <circle r="31" fill="#3C9F96" fillOpacity=".08" stroke="#6FC7BE" strokeWidth="1.2"/>
                  <circle r="17" fill="#102A32" stroke="#8AD7CF" strokeWidth="1.4"/>
                  <circle r="7" fill="#3C9F96" fillOpacity=".45" stroke="#C7F6EF"/>
                  <circle r="2.5" fill="#FFFFFF"/>
                  <path d="M-59 0H-36 M36 0H59 M0 -59V-36 M0 36V59" stroke="#7DCFC6" strokeWidth=".8"/>
                </g>
                <circle cx="372" cy="211" r="4" fill="#F6FFFF" filter="url(#orbiBeamSoft)"/>
              </svg>
              <div className="orbi-terminal-tag tag-tx"><span>TX</span><div><b>SC-01</b><small>TRANSMITTER</small></div></div>
              <div className="orbi-terminal-tag tag-rx"><span>RX</span><div><b>SC-02</b><small>RECEIVER</small></div></div>
              <div className="orbi-scene-caption"><span>CONCEPTUAL LINK GEOMETRY</span><span>NOT TO SCALE</span></div>
            </div>
            <div className="orbi-visual-foot"><span><i /> SCENARIO-DRIVEN VISUALIZATION</span><span>REAL MEASUREMENTS APPEAR AFTER EXECUTION</span></div>
          </div>
        </div>
        <div className="orbi-data-rail">
          <section className="orbi-data-card orbi-controls-card" aria-label="Scenario parameters">
            <div className="orbi-card-heading"><div><span>01 / CONFIGURE</span><h2>Scenario parameters</h2></div><span className="orbi-card-meta">EDITABLE INPUTS</span></div>
            <label className="orbi-range-control"><span>Vibration frequency <b>{vibrationHz.toFixed(1)} <small>Hz</small></b></span><input type="range" min="1" max="30" step=".1" value={vibrationHz} onChange={(e) => setVibrationHz(Number(e.target.value))} aria-label="Vibration frequency" /><small className="orbi-range-limits"><span>1 Hz</span><span>30 Hz</span></small></label>
            <label className="orbi-range-control"><span>Beacon disturbance <b>{disturbancePx.toFixed(1)} <small>px</small></b></span><input type="range" min=".2" max="8" step=".1" value={disturbancePx} onChange={(e) => setDisturbancePx(Number(e.target.value))} aria-label="Beacon disturbance" /><small className="orbi-range-limits"><span>0.2 px</span><span>8 px</span></small></label>
            <label className="orbi-range-control"><span>Clutter density <b>{clutter.toFixed(2)}</b></span><input type="range" min="0" max="1" step=".01" value={clutter} onChange={(e) => setClutter(Number(e.target.value))} aria-label="Clutter density" /><small className="orbi-range-limits"><span>Low</span><span>High</span></small></label>
            <button className="orbi-run-button" onClick={runLiveScenario} disabled={running || apiStatus !== "online"}>{running ? "Executing…" : "Execute this scenario"} <span>↗</span></button>
          </section>
          <section className="orbi-data-card orbi-results-card" aria-label="Latest backend result">
            <div className="orbi-card-heading"><div><span>02 / MEASURE</span><h2>{runResult ? "Latest result" : "Awaiting first run"}</h2></div><span className={"orbi-result-badge " + (runResult ? "has-result" : "")}>{runResult ? "COMPLETED" : "NO DATA"}</span></div>
            <div className="orbi-result-grid">
              <div><span>Noisy events</span><strong>{runResult ? runResult.events.n_noisy.toLocaleString() : "—"}</strong><small>{runResult ? "events in computed stream" : "Run a scenario to measure"}</small></div>
              <div><span>Detection hit rate</span><strong>{runResult ? (runResult.detections.hit_rate * 100).toFixed(1) + "%" : "—"}</strong><small>{runResult ? runResult.detections.n_hits + " / " + runResult.detections.n_windows + " windows" : "Measured by backend"}</small></div>
              <div><span>Dominant disturbance</span><strong>{runResult?.disturbance.dominant_frequency_hz != null ? runResult.disturbance.dominant_frequency_hz.toFixed(2) : runResult ? "Not detected" : "—"}{runResult?.disturbance.dominant_frequency_hz != null ? <small> Hz</small> : null}</strong><small>{runResult ? "estimated from event data" : "Frequency-domain estimate"}</small></div>
              <div><span>Control RMS error</span><strong>{runResult ? runResult.control_comparison.disturbance_armed.rms_error_px.toFixed(3) : "—"}{runResult ? <small> px</small> : null}</strong><small>{runResult ? "disturbance-informed controller" : "Measured by backend"}</small></div>
            </div>
            {runError && <p className="orbi-error" role="alert">{runError}</p>}
            <div className="orbi-result-footer"><span><i /> {runResult ? "RESULT RECEIVED FROM API" : "NO VALUES ARE SIMULATED HERE"}</span><Link href="/compare">Compare controllers →</Link></div>
          </section>
          <section className="orbi-data-card orbi-process-card" aria-label="Experiment workflow">
            <div className="orbi-card-heading"><div><span>03 / VALIDATE</span><h2>Experiment workflow</h2></div><Link href="/demo">Open demo ↗</Link></div>
            <div className="orbi-process-steps"><div className="complete"><i>1</i><span>Configure</span></div><div className={running ? "active" : ""}><i>2</i><span>Execute</span></div><div className={runResult ? "complete" : ""}><i>3</i><span>Inspect</span></div></div>
            <div className="orbi-process-note">{running ? "The backend is processing the selected scenario." : runResult ? "The run completed. Inspect the measured results or compare controllers." : "Set the disturbance profile, then execute a reproducible backend run."}</div>
            <Link className="orbi-text-link" href="/mission">Explore Mission Control <span>→</span></Link>
          </section>
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
