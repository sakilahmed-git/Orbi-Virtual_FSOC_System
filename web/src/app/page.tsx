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

  async function runLiveScenario() {
    setRunning(true);
    setRunError("");
    try {
      const result = await runScenario({
        duration_s: 2,
        fps: 240,
        vibration_freq_hz: 17.3,
        vibration_amp_px: 3,
        clutter_level: 0.35,
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
          <div className="ol-eyebrow"><span /> SCINTILLA / OPTICAL LINK TESTBED</div>
          <div className="ol-kicker-live"><i /> SOFTWARE-IN-THE-LOOP · REPRODUCIBLE RUNS</div>
          <h1>Test the link.<br /><em>Trust the evidence.</em></h1>
          <p>Stress a free-space optical link with vibration, clutter and sensor noise. Run the Scintilla pipeline and inspect its measured detections and controller response.</p>
          <div className="ol-hero-actions">
            <button className="ol-button ol-button-dark" onClick={runLiveScenario} disabled={running || apiStatus !== "online"}>
              {running ? "Running pipeline…" : "Run live experiment"} <span>↗</span>
            </button>
            <Link className="ol-button ol-button-quiet" href="/mission">Open Mission Control <span>→</span></Link>
          </div>
          <div className="ol-live-footnote"><span>01</span> CONFIGURE <i /> <span>02</span> COMPUTE <i /> <span>03</span> INSPECT</div>
          {runError && <p className="ol-run-error" role="alert">{runError}</p>}
        </div>
        <div className="ol-live-console">
          <div className="ol-console-top">
            <div><span className="ol-console-eyebrow">SCINTILLA ENGINE / RUN CONSOLE</span><strong>Optical link experiment</strong></div>
            <span className={"ol-console-status " + (apiStatus === "online" ? "online" : "offline")}><i /> {apiStatus === "online" ? "API REACHABLE" : apiStatus === "checking" ? "CHECKING" : "API OFFLINE"}</span>
          </div>
          <div className="ol-link-diagram">
            <div className="ol-starfield" />
            <div className="ol-link-orbit orbit-one" /><div className="ol-link-orbit orbit-two" />
            <div className="ol-link-beam"><span /></div>
            <div className="ol-terminal terminal-tx"><span className="terminal-core">TX</span><b>SC-01</b><small>TRANSMITTER</small></div>
            <div className="ol-terminal terminal-rx"><span className="terminal-core">RX</span><b>SC-02</b><small>RECEIVER</small></div>
            <div className="ol-diagram-label label-left">EVENT STREAM <b>240 FPS</b></div>
            <div className="ol-diagram-label label-right">LINK MODE <b>FSOC / SIM</b></div>
          </div>
          <div className="ol-run-metrics">
            <div><span>NOISY EVENTS</span><strong>{runResult ? runResult.events.n_noisy.toLocaleString() : "—"}</strong><small>{runResult ? "FROM COMPUTED RUN" : "AWAITING RUN"}</small></div>
            <div><span>DETECTION HIT RATE</span><strong>{runResult ? (runResult.detections.hit_rate * 100).toFixed(1) + "%" : "—"}</strong><small>{runResult ? `${runResult.detections.n_hits} / ${runResult.detections.n_windows} WINDOWS` : "MEASURED BY MODEL"}</small></div>
            <div><span>DOMINANT DISTURBANCE</span><strong>{runResult?.disturbance.dominant_frequency_hz != null ? runResult.disturbance.dominant_frequency_hz.toFixed(2) + " Hz" : "—"}</strong><small>{runResult ? "ESTIMATED FROM EVENTS" : "PSD ESTIMATE"}</small></div>
            <div><span>CONTROL RMS</span><strong>{runResult ? runResult.control_comparison.disturbance_armed.rms_error_px.toFixed(3) + " px" : "—"}</strong><small>{runResult ? "SCINTILLA-ARMED" : "BACKEND RESULT"}</small></div>
          </div>
          <div className="ol-console-bottom">
            <span><i /> {runResult ? "RUN COMPLETE · RESULT RECEIVED" : running ? "PIPELINE EXECUTING" : "READY FOR EXPERIMENT"}</span>
            <span>SEED 812 · VIBRATION 17.3 HZ</span>
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
