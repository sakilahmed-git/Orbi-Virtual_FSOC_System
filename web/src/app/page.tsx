"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import "./landing.css";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export default function Home() {
  const [apiStatus, setApiStatus] = useState<"checking" | "online" | "offline">("checking");

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

      <section className="ol-hero">
        <div className="ol-hero-copy">
          <div className="ol-eyebrow"><span /> OPTICAL LINKS, ENGINEERED WITH EVIDENCE</div>
          <h1>Turn <em>light</em> into<br /><span>possibility.</span></h1>
          <p>Design, stress and verify free-space optical communication links with a software-in-the-loop testbed — before hardware is in the loop.</p>
          <div className="ol-hero-actions">
            <Link className="ol-button ol-button-dark" href="/mission">Open Mission Control <span>→</span></Link>
            <Link className="ol-button ol-button-quiet" href="/demo">Run a backend scenario <span>↗</span></Link>
          </div>
          <div className="ol-proof-line"><span className="ol-proof-glyph">⌁</span> MODEL THE LINK. EXPOSE THE LIMITS. MEASURE THE RESPONSE.</div>
        </div>

        <div className="ol-visual" aria-label="Illustration of two optical terminals connected by a laser link">
          <div className="ol-nebula ol-nebula-blue" />
          <div className="ol-nebula ol-nebula-pink" />
          <svg className="ol-orbits" viewBox="0 0 900 650" aria-hidden="true">
            <defs>
              <linearGradient id="ol-beam" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#ff72cb" />
                <stop offset=".48" stopColor="#b79bff" />
                <stop offset="1" stopColor="#62d8ff" />
              </linearGradient>
              <filter id="ol-beam-glow" x="-40%" y="-400%" width="180%" height="900%">
                <feGaussianBlur stdDeviation="8" />
              </filter>
            </defs>
            <ellipse cx="500" cy="320" rx="330" ry="238" transform="rotate(-27 500 320)" fill="none" stroke="#ffffff" strokeOpacity=".45" />
            <ellipse cx="500" cy="320" rx="255" ry="185" transform="rotate(22 500 320)" fill="none" stroke="#d9d7ff" strokeOpacity=".36" />
            <path d="M190 414 C330 360 488 322 720 205" stroke="url(#ol-beam)" strokeWidth="20" strokeOpacity=".22" filter="url(#ol-beam-glow)" fill="none" />
            <path d="M190 414 C330 360 488 322 720 205" stroke="url(#ol-beam)" strokeWidth="3" fill="none" />
            <path d="M190 414 C330 360 488 322 720 205" stroke="#ffffff" strokeWidth=".8" strokeOpacity=".9" fill="none" />
            <g transform="translate(190 414) rotate(-17)">
              <rect x="-18" y="-18" width="36" height="36" rx="5" fill="#d6e8f8" stroke="#ffffff" strokeWidth="1.5" />
              <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#233e5b" />
              <rect x="-76" y="-16" width="50" height="32" fill="#142c49" stroke="#b6d7f2" />
              <rect x="26" y="-16" width="50" height="32" fill="#142c49" stroke="#b6d7f2" />
              {Array.from({ length: 5 }, (_, i) => <g key={i} stroke="#6486a7" strokeWidth=".8"><path d={`M${-68 + i * 9} -16 v32`} /><path d={`M${34 + i * 9} -16 v32`} /></g>)}
              <circle cx="0" cy="0" r="4" fill="#ff81d2" />
            </g>
            <g transform="translate(720 205) rotate(14)">
              <rect x="-18" y="-18" width="36" height="36" rx="5" fill="#d6e8f8" stroke="#ffffff" strokeWidth="1.5" />
              <rect x="-12" y="-12" width="24" height="24" rx="3" fill="#233e5b" />
              <rect x="-76" y="-16" width="50" height="32" fill="#142c49" stroke="#b6d7f2" />
              <rect x="26" y="-16" width="50" height="32" fill="#142c49" stroke="#b6d7f2" />
              {Array.from({ length: 5 }, (_, i) => <g key={i} stroke="#6486a7" strokeWidth=".8"><path d={`M${-68 + i * 9} -16 v32`} /><path d={`M${34 + i * 9} -16 v32`} /></g>)}
              <circle cx="0" cy="0" r="4" fill="#6ee5ff" />
            </g>
            <circle cx="190" cy="414" r="35" fill="none" stroke="#ff7fd2" strokeOpacity=".6" />
            <circle cx="190" cy="414" r="53" fill="none" stroke="#ff7fd2" strokeOpacity=".3" />
            <circle cx="720" cy="205" r="35" fill="none" stroke="#70ddff" strokeOpacity=".6" />
            <circle cx="720" cy="205" r="53" fill="none" stroke="#70ddff" strokeOpacity=".3" />
            <g fill="#ffffff" opacity=".8">{Array.from({ length: 35 }, (_, i) => <circle key={i} cx={(i * 137 + 29) % 880} cy={(i * 83 + 19) % 610} r={i % 5 === 0 ? 1.6 : .8} />)}</g>
          </svg>
          <div className="ol-visual-label ol-label-tx"><span className="ol-pulse pink" /> TRANSMITTER <b>SC-1</b><small>EVENT-BASED BEACON</small></div>
          <div className="ol-visual-label ol-label-rx"><span className="ol-pulse cyan" /> RECEIVER <b>SC-2</b><small>TRACK &amp; ACQUIRE</small></div>
          <div className="ol-visual-coordinates">LINK GEOMETRY / CONCEPT VIEW<br />NOT TO SCALE</div>
          <div className="ol-visual-index">01 <span /> 04</div>
        </div>

        <div className="ol-hero-bottom">
          <div><b>01</b><span>Define mission conditions</span></div>
          <div><b>02</b><span>Run the verified pipeline</span></div>
          <div><b>03</b><span>Inspect measured outcomes</span></div>
        </div>
      </section>

      <section className="ol-platform" id="platform">
        <div className="ol-section-kicker"><span>THE PLATFORM</span><i /> FROM SIGNAL TO EVIDENCE</div>
        <div className="ol-platform-heading">
          <h2>Optical link behaviour,<br /><em>made inspectable.</em></h2>
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
          <h2>From acquisition<br />to <em>confidence.</em></h2>
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
        <div className="ol-usecases-head"><h2>Built for hard<br /><em>mission questions.</em></h2><p>Explore sensitivity to vibration, clutter and sensor noise; compare event-based processing with a frame-camera baseline; and measure how control performance changes under disturbance.</p></div>
        <div className="ol-usecase-grid">
          <article className="ol-usecase-card ol-usecase-blue"><span>01 / SENSOR</span><div className="ol-usecase-art"><div className="ol-grid-art" /><div className="ol-particle" /><div className="ol-particle p2" /><div className="ol-particle p3" /></div><h3>Event stream vs. frames</h3><p>Compare event detections with exposure-averaged frame-camera measurements.</p><Link href="/demo">Inspect the stream <span>→</span></Link></article>
          <article className="ol-usecase-card ol-usecase-violet"><span>02 / DISTURBANCE</span><div className="ol-usecase-art"><div className="ol-wave-art"><i /><i /><i /></div></div><h3>Vibration &amp; clutter</h3><p>Vary the disturbance profile and inspect the frequency estimate and detection response.</p><Link href="/demo">Change scenario inputs <span>→</span></Link></article>
          <article className="ol-usecase-card ol-usecase-dark"><span>03 / CONTROL</span><div className="ol-usecase-art"><div className="ol-control-art"><i /><i /><i /><b /></div></div><h3>Controller comparison</h3><p>Run frame-based, event-only and Scintilla control paths against a shared generated scenario.</p><Link href="/compare">Compare control paths <span>→</span></Link></article>
        </div>
      </section>

      <section className="ol-research" id="research">
        <div className="ol-research-copy">
          <div className="ol-section-kicker"><span>RESEARCH &amp; VALIDATION</span><i /> TRACEABLE OUTPUTS</div>
          <h2>Make every result<br />worth <em>examining.</em></h2>
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
