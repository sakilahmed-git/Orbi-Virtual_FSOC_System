"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import MissionSpace, { type SceneTarget } from "./MissionSpace";
import { useMissionSimulation, type MissionSnapshot, } from "@/lib/useMissionSimulation";
import { fetchVerifiedResults, type VerifiedResults, } from "@/lib/api";
type Phase = "READY" | "SEARCH" | "DETECT" | "IDENTIFY" | "ACQUIRE" | "ALIGN" | "CONNECTED" | "DISTURBANCE" | "CORRECTING";
type View = "mission" | "terminal-a" | "terminal-b";
type LogItem = {
    id: number;
    time: string;
    title: string;
    detail: string;
    tone: "blue" | "green" | "amber" | "red" | "gray";
};
const stages = [
    "Search",
    "Detect",
    "Identify",
    "Acquire",
    "Align",
    "Track",
    "Maintain",
];
const ui = {
    shell: {
        background: "radial-gradient(ellipse at 50% 35%, #102b45 0%, #061321 52%, #020711 100%)",
        color: "#e3f2ff",
        fontFamily: 'Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        letterSpacing: "-0.012em",
        minHeight: "100vh",
    } as React.CSSProperties,
    topbar: {
        background: "rgba(7,20,34,.96)",
        borderBottom: "1px solid #24445a",
        boxShadow: "0 14px 40px rgba(0,0,0,.35)",
        backdropFilter: "blur(20px)",
    } as React.CSSProperties,
    brand: { color: "#e3f2ff" } as React.CSSProperties,
    brandMark: {
        background: "linear-gradient(145deg,#0d1722 0%,#176fc8 55%,#28c6e8 100%)",
        boxShadow: "0 0 0 4px rgba(32,183,223,.07), 0 5px 16px rgba(40,127,218,.22)",
    } as React.CSSProperties,
    panel: {
        background: "rgba(7,24,39,.96)",
        border: "1px solid #25465b",
        boxShadow: "0 18px 48px rgba(0,0,0,.38)",
        borderRadius: 15,
    } as React.CSSProperties,
    panelHead: {
        color: "#e3f2ff",
        borderBottom: "1px solid #24445a",
    } as React.CSSProperties,
    muted: { color: "#8ca9be" } as React.CSSProperties,
    blue: { color: "#1479d1" } as React.CSSProperties,
    green: { color: "#0aa477" } as React.CSSProperties,
    amber: { color: "#c17b22" } as React.CSSProperties,
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const phaseLabels: Record<Phase, string> = {
    READY: "Standby",
    SEARCH: "Searching",
    DETECT: "Beacon detected",
    IDENTIFY: "Identifying",
    ACQUIRE: "Acquiring",
    ALIGN: "Fine alignment",
    CONNECTED: "Tracking",
    DISTURBANCE: "Disturbance",
    CORRECTING: "Correcting",
};
type PanelState = { x: number; y: number; z: number; min: boolean };
const PANEL_META: Record<string, { t: string; w: number; accent?: string }> = {
    a: { t: "SC-1 · TRANSMITTER", w: 360, accent: "#ff3f68" }, b: { t: "SC-2 · RECEIVER", w: 360, accent: "#32d8ff" },
    gs: { t: "GS-1 · GROUND STATION", w: 340 }, link: { t: "OPTICAL LINK", w: 340 },
    cfg: { t: "CONTROL & MISSION CONFIGURATION", w: 340 }, tel: { t: "MISSION TELEMETRY", w: 330 }, assist: { t: "SCINTILLA ASSISTANT", w: 330 },
    dist: { t: "DISTURBANCE MONITOR", w: 330 }, evid: { t: "EVIDENCE & VALIDATION", w: 330 }, act: { t: "MISSION ACTIVITY", w: 330 }, pkg: { t: "MISSION PACKAGE", w: 300 }, intel: { t: "SCINTILLA INTELLIGENCE · A/B", w: 390, accent: "#8060df" }, xfer: { t: "DATA LINK · LIVE TRANSFER", w: 390 },
};
function defaultPos(id: string, n: number) {
    const W = window.innerWidth, w = PANEL_META[id].w;
    const left = ["a", "cfg"].includes(id), mid = id === "link";
    const x = left ? 88 + n * 26 : mid ? W / 2 - w / 2 : W - w - 14 - n * 26;
    return { x: Math.max(8, x), y: 132 + n * 24 };
}
async function sha256(b: Uint8Array) { const d = await crypto.subtle.digest("SHA-256", b as BufferSource); return Array.from(new Uint8Array(d)).map(x => x.toString(16).padStart(2, "0")).join(""); }
function Spark({ data, color }: { data: number[]; color: string }) {
    const lo = data.length > 1 ? Math.min(...data, 0) : 0, hi = data.length > 1 ? Math.max(...data, 1e-6) : 1;
    const pts = data.map((v, i) => `${i / Math.max(1, data.length - 1) * 300},${28 - (v - lo) / ((hi - lo) || 1) * 26}`).join(" ");
    return <svg viewBox="0 0 300 30" preserveAspectRatio="none" style={{ width: "100%", height: 30, display: "block" }}><polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" vectorEffect="non-scaling-stroke" /></svg>;
}
function FloatingPanel({ id, state, onMove, onFocus, onClose, onMin, children }: { id: string; state: PanelState; onMove: (id: string, x: number, y: number) => void; onFocus: (id: string) => void; onClose: (id: string) => void; onMin: (id: string) => void; children: React.ReactNode }) {
    const drag = useRef<{ dx: number; dy: number } | null>(null);
    const m = PANEL_META[id];
    return (<div className="fp" style={{ left: state.x, top: state.y, width: m.w, zIndex: state.z }} onPointerDown={() => onFocus(id)}>
        <div className="fp-head" onDoubleClick={() => onMin(id)}
            onPointerDown={e => { if ((e.target as HTMLElement).closest("button")) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { dx: e.clientX - state.x, dy: e.clientY - state.y }; }}
            onPointerMove={e => { if (drag.current) onMove(id, clamp(e.clientX - drag.current.dx, 8 - m.w + 140, window.innerWidth - 140), clamp(e.clientY - drag.current.dy, 8, window.innerHeight - 48)); }}
            onPointerUp={() => { drag.current = null; }}>
            <span className="fp-grip">⋮⋮</span><b style={m.accent ? { color: m.accent === "#32d8ff" ? "#0b86a8" : m.accent } : undefined}>{m.t}</b>
            <button aria-label="Collapse" onClick={() => onMin(id)}>{state.min ? "▢" : "–"}</button><button aria-label="Close" onClick={() => onClose(id)}>×</button>
        </div>
        {!state.min && <div className="fp-body" style={{ maxHeight: `calc(100vh - ${state.y + 16}px)` }}>{children}</div>}
    </div>);
}

export default function MissionControl() {
    const { snapshot: sim, establish, disconnect, inject, apply, setConfig, } = useMissionSimulation();
    const [verified, setVerified] = useState<VerifiedResults | null>(null);
    const [eventView, setEventView] = useState(true);
    const [ground, setGround] = useState(false);
    const [power, setPower] = useState(250);
    const [gain, setGain] = useState(0.8);
    const [view, setView] = useState<View>("mission");
    const [missionName, setMissionName] = useState("ORBITAL LINK 01");
    const [showLogs, setShowLogs] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [demoRunning, setDemoRunning] = useState(false);
    const [demoArmed, setDemoArmed] = useState(false);
    const [copied, setCopied] = useState(false);
    const [snapshotSaved, setSnapshotSaved] = useState(false);
    const [logs, setLogs] = useState<LogItem[]>([
        {
            id: 1,
            time: nowTime(),
            title: "Mission console initialized",
            detail: "Simulation telemetry channel is online.",
            tone: "blue",
        },
        {
            id: 2,
            time: nowTime(),
            title: "Optical terminals discovered",
            detail: "SC-1 transmitter and SC-2 receiver available.",
            tone: "gray",
        },
    ]);
    const [panels, setPanels] = useState<Record<string, PanelState>>({});
    const lastPos = useRef<Record<string, { x: number; y: number }>>({});
    const zTop = useRef(30);
    const [evA, setEvA] = useState(true);
    const [evB, setEvB] = useState(true);
    const [tabs, setTabs] = useState<Record<string, string>>({ a: "cam", b: "cam" });
    function openPanel(id: string) {
        setPanels(p => p[id] ? { ...p, [id]: { ...p[id], z: ++zTop.current, min: false } } : { ...p, [id]: { ...(lastPos.current[id] ?? defaultPos(id, Object.keys(p).length % 5)), z: ++zTop.current, min: false } });
    }
    function closePanel(id: string) {
        setPanels(p => { const { [id]: cur, ...rest } = p; if (cur) lastPos.current[id] = { x: cur.x, y: cur.y }; return rest; });
    }
    const movePanel = (id: string, x: number, y: number) => setPanels(p => p[id] ? { ...p, [id]: { ...p[id], x, y } } : p);
    const focusPanel = (id: string) => setPanels(p => p[id] && p[id].z < zTop.current ? { ...p, [id]: { ...p[id], z: ++zTop.current } } : p);
    const minPanel = (id: string) => setPanels(p => p[id] ? { ...p, [id]: { ...p[id], min: !p[id].min } } : p);
    function toggleGroup(ids: string[]) { if (ids.some(i => panels[i])) ids.forEach(closePanel); else ids.forEach(openPanel); }
    function selectFromScene(t: SceneTarget) { openPanel(t === "ground" ? "gs" : t); }
    useEffect(() => { openPanel("a"); openPanel("b"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const phase = sim.phase as Phase;
    const connected = [
        "CONNECTED",
        "DISTURBANCE",
        "CORRECTING",
        "TRACK",
    ].includes(phase);
    const disturbance = sim.disturbance > 0.06;
    const learned = sim.learned;
    const stageMap: Record<string, number> = {
        SEARCH: 0,
        DETECT: 1,
        IDENTIFY: 2,
        LOCK: 2,
        ACQUIRE: 3,
        ALIGN: 4,
        TRACK: 5,
        CONNECTED: 5,
        DISTURBANCE: 5,
        CORRECTING: 5,
    };
    const stageIndex = stageMap[phase] ?? -1;
    const health = useMemo(() => {
        if (!connected)
            return phase === "READY" ? 100 : 68;
        const quality = clamp(sim.quality, 0, 100);
        const pointingPenalty = clamp(sim.pointingErrorDeg * 10, 0, 30);
        const jitterPenalty = clamp(sim.jitter * 35, 0, 20);
        return Math.round(clamp(quality - pointingPenalty - jitterPenalty, 0, 100));
    }, [connected, phase, sim.jitter, sim.pointingErrorDeg, sim.quality]);
    const linkMargin = useMemo(() => {
        if (!connected)
            return null;
        return clamp(8 +
            (sim.signalDb + 30) * 0.42 +
            (power - 250) * 0.012 +
            (gain - 0.8) * 2.4, 0, 30);
    }, [connected, gain, power, sim.signalDb]);
    const confidence = Math.round(clamp(sim.confidence * 100, 0, 100));
    const hist = useRef<{ e: number; j: number; q: number }[]>([]);
    const simRef = useRef(sim);
    useEffect(() => { simRef.current = sim; const h = hist.current; h.push({ e: sim.pointingErrorDeg, j: sim.jitter, q: sim.quality }); if (h.length > 120) h.shift(); }, [sim]);
    const [stats, setStats] = useState<Record<"on" | "off", { acq?: number; rec?: number; peak?: number }>>({ on: {}, off: {} });
    const mark = useRef<{ acq?: number; dist?: number; peak: number; ctl: "on" | "off" }>({ peak: 0, ctl: "on" });
    const prevPhase = useRef(phase);
    useEffect(() => {
        const m = mark.current, p = prevPhase.current, k = sim.intelligence ? "on" : "off";
        if (phase !== p) {
            if (phase === "SEARCH") { m.acq = sim.time; m.ctl = k; }
            if (phase === "CONNECTED" && p === "ALIGN" && m.acq !== undefined) { const v = sim.time - m.acq, c = m.ctl; m.acq = undefined; setStats(s => ({ ...s, [c]: { ...s[c], acq: v } })); }
            if (phase === "DISTURBANCE" && p !== "CORRECTING") { m.dist = sim.time; m.peak = 0; m.ctl = k; }
            if (phase === "CONNECTED" && p === "CORRECTING" && m.dist !== undefined) { const v = sim.time - m.dist, pk = m.peak, c = m.ctl; m.dist = undefined; setStats(s => ({ ...s, [c]: { ...s[c], rec: v, peak: pk } })); }
            prevPhase.current = phase;
        }
        if (m.dist !== undefined) m.peak = Math.max(m.peak, sim.pointingErrorDeg);
    }, [phase, sim]);
    const [ab, setAb] = useState<null | 0 | 1>(null);
    const wasDemo = useRef(false);
    function runAB() { setAb(0); updateIntelligence(false); disconnect(); setDemoRunning(false); setDemoArmed(false); window.setTimeout(() => setDemoRunning(true), 800); }
    useEffect(() => {
        if (wasDemo.current && !demoRunning && ab !== null) { if (ab === 0) { setAb(1); updateIntelligence(true); disconnect(); window.setTimeout(() => setDemoRunning(true), 800); } else setAb(null); }
        wasDemo.current = demoRunning;
    }, [demoRunning]); // eslint-disable-line react-hooks/exhaustive-deps
    const emptyX = { st: "idle" as "idle" | "sending" | "stalled" | "done", total: 0, acked: 0, sent: 0, lost: 0, retx: 0, name: "", txSha: "", rxSha: "", cells: [] as number[], tp: [] as number[], preview: "", bytes: 0 };
    const [xf, setXf] = useState(emptyX);
    const [xtext, setXtext] = useState("SCINTILLA optical-link payload · telemetry packet 0001\nThis message crosses the simulated channel as real packets and is verified end-to-end with SHA-256.");
    const [pkt, setPkt] = useState(256); const [win, setWin] = useState(8); const [arq, setArq] = useState(true);
    const tx = useRef<{ data: Uint8Array; rx: Uint8Array; state: Uint8Array; next: number; retry: number[]; n: number; sent: number; lost: number; retx: number; acked: number; tp: number[]; run: boolean } | null>(null);
    async function startXfer(data: Uint8Array, name: string) {
        const n = Math.ceil(data.length / pkt);
        if (!n) return;
        tx.current = { data, rx: new Uint8Array(data.length), state: new Uint8Array(n), next: 0, retry: [], n, sent: 0, lost: 0, retx: 0, acked: 0, tp: [], run: true };
        setXf({ ...emptyX, st: "sending", total: n, name, bytes: data.length, txSha: await sha256(data) });
        addLog("Transfer started", `${name} · ${data.length} B in ${n} packets (${pkt} B, window ${win}, ARQ ${arq ? "on" : "off"}).`, "blue");
    }
    useEffect(() => {
        if (xf.st !== "sending" && xf.st !== "stalled") return;
        const id = window.setInterval(() => {
            const t = tx.current; if (!t || !t.run) return;
            const s = simRef.current, live = ["CONNECTED", "DISTURBANCE", "CORRECTING", "TRACK"].includes(s.phase);
            let delivered = 0;
            if (live) {
                const pl = clamp((90 - s.quality) / 100 + s.pointingErrorDeg * 0.02 + s.disturbance * 0.2, 0, 0.9);
                for (let i = 0; i < win; i++) {
                    const idx = t.retry.length ? t.retry.shift()! : t.next < t.n ? t.next++ : -1; if (idx < 0) break;
                    t.sent++; if (t.state[idx] === 2) t.retx++;
                    if (Math.random() < pl) { t.lost++; if (arq) { t.state[idx] = 2; t.retry.push(idx); } else t.state[idx] = 3; }
                    else { const o = idx * pkt; t.rx.set(t.data.subarray(o, o + pkt), o); t.state[idx] = 1; t.acked++; delivered += Math.min(pkt, t.data.length - o); }
                }
            }
            t.tp.push(delivered); if (t.tp.length > 60) t.tp.shift();
            const m = Math.min(240, t.n), cells = Array.from({ length: m }, (_, c) => t.state[Math.floor(c * t.n / m)]);
            const snap = { acked: t.acked, sent: t.sent, lost: t.lost, retx: t.retx, cells, tp: [...t.tp] };
            if (t.next >= t.n && !t.retry.length) {
                t.run = false;
                sha256(t.rx).then(r => { setXf(p => ({ ...p, ...snap, st: "done", rxSha: r, preview: new TextDecoder().decode(t.rx.subarray(0, 400)) })); addLog("Transfer finished", `${t.acked}/${t.n} packets delivered, ${t.lost} lost, ${t.retx} retransmitted.`, t.acked === t.n ? "green" : "amber"); });
                return;
            }
            setXf(p => ({ ...p, ...snap, st: live ? "sending" : "stalled" }));
        }, 80);
        return () => window.clearInterval(id);
    }, [xf.st, win, arq, pkt]); // eslint-disable-line react-hooks/exhaustive-deps
    function downloadRx() { const t = tx.current; if (!t) return; const url = URL.createObjectURL(new Blob([t.rx as BlobPart])); const a = document.createElement("a"); a.href = url; a.download = `received-${xf.name}`; a.click(); URL.revokeObjectURL(url); }
    const [q, setQ] = useState(""); const [qOpen, setQOpen] = useState(false); const qRef = useRef<HTMLInputElement>(null);
    useEffect(() => { const f = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); qRef.current?.focus(); } }; window.addEventListener("keydown", f); return () => window.removeEventListener("keydown", f); }, []);
    useEffect(() => {
        fetchVerifiedResults()
            .then(setVerified)
            .catch(() => setVerified(null));
    }, []);
    useEffect(() => {
        if (!demoRunning)
            return;
        if (phase === "READY") {
            setDemoArmed(false);
            establish();
            addLog("Demo sequence started", "Running acquisition using the active adaptive configuration.", "blue");
            return;
        }
        if (connected && !demoArmed && !disturbance) {
            setDemoArmed(true);
            const timer = window.setTimeout(() => {
                inject();
                addLog("Controlled disturbance injected", "Demo is testing reacquisition and adaptive correction.", "amber");
            }, 1600);
            return () => window.clearTimeout(timer);
        }
        if (disturbance && demoArmed) {
            const timer = window.setTimeout(() => {
                apply();
                addLog("Adaptive correction applied", "Controller received the predicted pointing-error event.", "green");
            }, 1300);
            return () => window.clearTimeout(timer);
        }
        if (connected && demoArmed && !disturbance && phase === "CONNECTED") {
            const timer = window.setTimeout(() => {
                setDemoRunning(false);
                setDemoArmed(false);
                addLog("Demo sequence complete", "Link recovered and returned to tracking.", "green");
            }, 2200);
            return () => window.clearTimeout(timer);
        }
    }, [
        apply,
        connected,
        demoArmed,
        demoRunning,
        disturbance,
        establish,
        inject,
        phase,
    ]);
    function addLog(title: string, detail: string, tone: LogItem["tone"]) {
        setLogs((current) => [
            {
                id: Date.now() + Math.random(),
                time: nowTime(),
                title,
                detail,
                tone,
            },
            ...current,
        ].slice(0, 12));
    }
    function updatePower(value: number) {
        setPower(value);
        setConfig({ power: value });
        addLog("Transmission power changed", `Configured optical power to ${value} mW.`, "blue");
    }
    function updateGain(value: number) {
        setGain(value);
        setConfig({ gain: value });
        addLog("Pointing gain changed", `Configured pointing gain to ${value.toFixed(2)}.`, "blue");
    }
    function updateGround(value: boolean) {
        setGround(value);
        setConfig({ ground: value });
        addLog("Endpoint topology changed", value ? "Ground station → SC-2 selected." : "SC-1 → SC-2 selected.", "blue");
    }
    function updateIntelligence(value: boolean) {
        setConfig({ intelligence: value });
        addLog(value ? "Intelligence enabled" : "Intelligence disabled", value
            ? "Predictive PAT/ATP is now controlling the demonstration."
            : "Reactive PAT/ATP is now controlling the demonstration.", value ? "green" : "gray");
    }
    function handleEstablish() {
        establish();
        addLog(learned ? "Reconnection requested" : "Link acquisition requested", learned
            ? "Adaptive search region reused from the previous acquisition."
            : "Starting beacon search and optical acquisition.", "blue");
    }
    function handleDisconnect() {
        disconnect();
        setDemoRunning(false);
        setDemoArmed(false);
        addLog("Link disconnected", "Optical session closed by operator command.", "gray");
    }
    function handleInject() {
        inject();
        addLog("Turbulence injected", "Controlled turbulence disturbance entered the active simulation.", "amber");
    }
    function handleApply() {
        apply();
        addLog("Correction command issued", "Adaptive/reactionary correction sent to the simulation controller.", "green");
    }
    function startDemo() {
        setDemoRunning(true);
        setDemoArmed(false);
        if (phase !== "READY") {
            addLog("Demo armed", "Waiting for the current acquisition state before running the test.", "blue");
        }
    }
    function stopDemo() {
        setDemoRunning(false);
        setDemoArmed(false);
        addLog("Demo stopped", "Operator stopped the automated demonstration sequence.", "gray");
    }
    function exportSnapshot() {
        const payload = {
            mission: missionName,
            exportedAt: new Date().toISOString(),
            phase,
            connected,
            ground,
            configuration: {
                intelligence: sim.intelligence,
                power,
                gain,
            },
            telemetry: {
                uptime: sim.uptime,
                dataRate: sim.dataRate,
                latency: sim.latency,
                signalDb: sim.signalDb,
                quality: sim.quality,
                pointingErrorDeg: sim.pointingErrorDeg,
                jitter: sim.jitter,
                distanceKm: sim.distanceKm,
                confidence: sim.confidence,
            },
            endpoints: {
                source: sim.source,
                target: sim.target,
                currentAxis: sim.currentAxis,
                desiredAxis: sim.desiredAxis,
            },
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${missionName.toLowerCase().replace(/\s+/g, "-")}-telemetry.json`;
        anchor.click();
        URL.revokeObjectURL(url);
        setSnapshotSaved(true);
        window.setTimeout(() => setSnapshotSaved(false), 1800);
        addLog("Telemetry snapshot exported", "Current mission state was packaged into a JSON evidence file.", "green");
    }
    async function copyTelemetry() {
        const text = [
            `${missionName} · ${phaseLabels[phase]}`,
            `Link quality: ${sim.quality.toFixed(1)}%`,
            `Signal: ${sim.signalDb.toFixed(1)} dB`,
            `Latency: ${sim.latency.toFixed(1)} ms`,
            `Pointing error: ${sim.pointingErrorDeg.toFixed(3)}°`,
            `Jitter: ${sim.jitter.toFixed(3)}°/s`,
            `Distance: ${sim.distanceKm.toFixed(0)} km`,
        ].join("\n");
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1600);
            addLog("Telemetry copied", "Current link-health summary copied to clipboard.", "green");
        }
        catch {
            addLog("Clipboard unavailable", "Browser permission prevented copying telemetry.", "amber");
        }
    }
    const statusLabel = phaseLabels[phase] ?? phase;
    const ctlBody = (<div className="sc-control">

                <div><div className="sc-control-row"><span>Transmission power</span><b>{power} mW</b></div><input className="sc-slider" type="range" min={50} max={500} value={power} onChange={e => updatePower(+e.target.value)}/></div>

                <div><div className="sc-control-row"><span>Pointing gain</span><b>{gain.toFixed(2)}</b></div><input className="sc-slider" type="range" min={0.3} max={2} step={0.05} value={gain} onChange={e => updateGain(+e.target.value)}/></div>

                <div><div className="sc-control-row"><span>Endpoint topology</span><b>{ground ? "GS-1 → SC-2" : "SC-1 → SC-2"}</b></div><div className="sc-mode"><button className={!ground ? "active" : ""} onClick={() => updateGround(false)}>Satellite</button><button className={ground ? "active" : ""} onClick={() => updateGround(true)}>Ground → Sat</button></div></div>

                <div className="sc-control-actions"><button className={demoRunning ? "sc-dark red" : "sc-primary"} onClick={demoRunning ? stopDemo : startDemo}>{demoRunning ? "STOP LIVE DEMO" : "RUN LIVE DEMO"}</button><button className="sc-dark" onClick={handleInject}>{disturbance ? "TURBULENCE ACTIVE" : "INJECT TURBULENCE"}</button></div>

                {disturbance && <button className="sc-primary" onClick={handleApply}>{sim.intelligence ? "APPLY PREDICTIVE CORRECTION" : "APPLY REACTIVE CORRECTION"}</button>}

                <div className="sc-mini-grid"><div className="sc-mini"><span>Link margin</span><b>{linkMargin === null ? "—" : `${linkMargin.toFixed(1)} dB`}</b></div><div className="sc-mini"><span>Adaptive state</span><b>{sim.adaptive ? "ACTIVE" : "IDLE"}</b></div><div className="sc-mini"><span>Learned model</span><b>{learned ? "LOADED" : "COLD"}</b></div></div>

              </div>);
    const secTel = (<section className="sc-card">

            <div className="sc-card-head"><span>MISSION TELEMETRY</span><span style={{ color: connected ? "#079b76" : "#1679d1", fontSize: 8 }}>● {connected ? "LIVE" : "SIMULATION"}</span></div>

            <div className="sc-analog-grid">

              <div className="sc-analog">

                <Gauge label="Data rate" value={connected ? `${sim.dataRate.toFixed(1)} Gbps` : "—"} p={connected ? Math.min(100, sim.dataRate / 1.5 * 100) : 0} color="#1bb6e8"/>

              </div>

              <div className="sc-analog">

                <Gauge label="Latency" value={connected ? `${sim.latency.toFixed(1)} ms` : "—"} p={connected ? clamp(100 - sim.latency * 4, 0, 100) : 0} color="#8d69ed"/>

              </div>

              <div className="sc-analog">

                <Gauge label="Signal" value={connected ? `${sim.signalDb.toFixed(1)} dB` : "—"} p={connected ? clamp((sim.signalDb + 45) * 4, 0, 100) : 0} color="#19bfe8"/>

              </div>

              <div className="sc-analog">

                <Gauge label="Link quality" value={connected ? `${sim.quality.toFixed(0)}%` : "—"} p={connected ? sim.quality : 0} color="#08b98a"/>

              </div>

            </div>

            <div className="sc-mini-grid"><div className="sc-mini"><span>Pointing error</span><b>{sim.pointingErrorDeg.toFixed(3)}°</b></div><div className="sc-mini"><span>Slant range</span><b>{sim.distanceKm.toFixed(0)} km</b></div><div className="sc-mini"><span>Jitter RMS</span><b>{sim.jitter.toFixed(3)}°/s</b></div></div>

            <div className="sc-actions"><button className="sc-secondary" onClick={copyTelemetry}>{copied ? "✓ COPIED" : "COPY TELEMETRY"}</button><button className="sc-secondary" onClick={exportSnapshot}>{snapshotSaved ? "✓ EXPORTED" : "EXPORT JSON"}</button></div>

          </section>);
    const secAssist = (<section className="sc-card">

            <div className="sc-card-head"><span>SCINTILLA ASSISTANT</span><span style={{ color: "#1679d1", fontSize: 8 }}>● {sim.intelligence ? "PREDICTIVE" : "REACTIVE"}</span></div>

            <div className="sc-ai"><span className="sc-ai-orb"/><div><b>{disturbance ? (sim.intelligence ? "Correction window detected." : "Pointing error elevated.") : connected ? "Link stable." : phase === "READY" ? "Mission ready." : "Acquisition in progress."}</b><p>{disturbance ? `${confidence}% confidence · ${sim.intelligence ? "predictive correction recommended" : "reactive correction required"}` : learned && phase === "READY" && sim.intelligence ? "Previously learned search region is available for faster reacquisition." : connected ? "Beacon lock is maintained while pointing stability and signal quality are monitored." : "Ready to search for the modulated beacon and execute optical acquisition."}</p></div></div>

            <div className="sc-advisory"><b>{disturbance ? "CONTROL ADVISORY" : "NEXT SYSTEM ACTION"}</b><div style={{ marginTop: 3, color: "#73818d", lineHeight: 1.45 }}>{disturbance ? `${confidence}% confidence · correction can be applied now.` : phase === "READY" ? "Establish the link to begin the acquisition sequence." : "Continue observing beacon visibility, pointing error and signal quality."}</div></div>

            {disturbance && <button className="sc-primary" style={{ width: "calc(100% - 24px)", margin: "0 12px 12px" }} onClick={handleApply}>{sim.intelligence ? "APPLY PREDICTIVE CORRECTION" : "APPLY CORRECTION"}</button>}

          </section>);
        const h = hist.current;
    const miniGrid = (items: [string, string][]) => <div className="fp-pad"><div className="sc-mini-grid">{items.map(([l, v]) => <div className="sc-mini" key={l}><span>{l}</span><b>{v}</b></div>)}</div></div>;
    const okRx = xf.st === "done" && xf.rxSha === xf.txSha;
    const cellCol = ["#dfe7ec", "#1689d5", "#e8a33d", "#d95c68"];
    const eff = xf.sent ? Math.round(xf.acked / xf.sent * 100) : 0;
    const xferBody = (<div>
        <div className="fp-pad" style={{ paddingTop: 10 }}>
            <div className="sc-control-row"><span>Payload</span><b>{xf.name || "none"}</b></div>
            <textarea className="fp-text" value={xtext} onChange={e => setXtext(e.target.value)} rows={3} />
            <div className="sc-control-actions"><button className="sc-primary" disabled={!connected || xf.st === "sending"} onClick={() => startXfer(new TextEncoder().encode(xtext), "message.txt")}>SEND MESSAGE</button><label className="sc-dark" style={{ display: "grid", placeItems: "center", cursor: "pointer", opacity: connected && xf.st !== "sending" ? 1 : .5 }}>SEND FILE…<input type="file" hidden disabled={!connected || xf.st === "sending"} onChange={async e => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; if (f.size > 5e6) { addLog("File too large", "Transfer demo is limited to 5 MB.", "amber"); return; } startXfer(new Uint8Array(await f.arrayBuffer()), f.name); }} /></label></div>
            {!connected && <div className="fp-note">Establish the optical link first — packets only flow while the link is live.</div>}
        </div>
        <div className="fp-pad">
            <div className="sc-control-row"><span>Packet size</span><select className="fp-sel" value={pkt} disabled={xf.st === "sending" || xf.st === "stalled"} onChange={e => setPkt(+e.target.value)}>{[128, 256, 512, 1024].map(v => <option key={v} value={v}>{v} B</option>)}</select></div>
            <div><div className="sc-control-row"><span>Window (packets / tick)</span><b>{win}</b></div><input className="sc-slider" type="range" min={1} max={32} value={win} onChange={e => setWin(+e.target.value)} /></div>
            <div className="sc-control-row"><span>Selective-repeat ARQ</span><button role="switch" aria-checked={arq} onClick={() => setArq(!arq)} style={{ width: 40, height: 23, border: 0, borderRadius: 99, padding: 3, background: arq ? "#1689d5" : "#ccd6dc", cursor: "pointer" }}><i style={{ display: "block", width: 17, height: 17, borderRadius: "50%", background: "#fff", transform: arq ? "translateX(17px)" : "none", transition: "transform .18s" }} /></button></div>
        </div>
        {miniGrid([["State", xf.st === "stalled" ? "LINK DOWN" : xf.st.toUpperCase()], ["Delivered", `${xf.acked}/${xf.total}`], ["Sent", `${xf.sent}`], ["Lost", `${xf.lost}`], ["Retransmits", `${xf.retx}`], ["Efficiency", `${eff}%`]])}
        <div className="fp-pad"><div className="fp-cells">{xf.cells.map((c, i) => <i key={i} style={{ background: cellCol[c] }} />)}</div>
            <div className="fp-note">Packet map · blue delivered · amber lost, awaiting retry · red dropped · grey pending</div>
            <div className="sc-control-row"><span>Goodput (bytes / tick)</span><b>{xf.tp.length ? xf.tp[xf.tp.length - 1] : 0}</b></div><Spark data={xf.tp} color="#1689d5" />
            <div className="fp-note">Loss per packet follows the live link: signal quality, pointing error and turbulence. Channel time is dilated so you can watch it; counts and checksums are real.</div></div>
        {xf.st === "done" && <div className="fp-pad"><div className="sc-mini"><span>TX SHA-256</span><b style={{ fontFamily: "monospace", wordBreak: "break-all" }}>{xf.txSha.slice(0, 32)}…</b></div><div className="sc-mini"><span>RX SHA-256</span><b style={{ fontFamily: "monospace", wordBreak: "break-all", color: okRx ? "#079b76" : "#d95c68" }}>{xf.rxSha.slice(0, 32)}…</b></div>
            <div style={{ fontSize: 10, fontWeight: 800, color: okRx ? "#079b76" : "#d95c68" }}>{okRx ? "✓ INTEGRITY VERIFIED — received data identical to sent data" : "✗ CHECKSUM MISMATCH — packets were lost and not retransmitted"}</div>
            {xf.preview && <pre className="fp-pre">{xf.preview}</pre>}<button className="sc-secondary" onClick={downloadRx}>DOWNLOAD RECEIVED FILE</button></div>}
        {(xf.st === "sending" || xf.st === "stalled") && <div className="fp-pad"><button className="sc-dark red" onClick={() => { if (tx.current) tx.current.run = false; setXf(emptyX); }}>CANCEL TRANSFER</button></div>}
    </div>);
    const fmt = (v?: number, d = 1) => v === undefined ? "—" : v.toFixed(d);
    const best = (a?: number, b?: number, side: "off" | "on" = "on") => a !== undefined && b !== undefined && (side === "on" ? b < a : a < b) ? { color: "#079b76", fontWeight: 800 } : undefined;
    const intelBody = (<div>
        <div className="fp-id" style={{ borderLeft: "3px solid #8060df" }}><div><b>{sim.intelligence ? "PREDICTIVE PAT/ATP ACTIVE" : "CONVENTIONAL PAT/ATP ACTIVE"}</b><span>{sim.intelligence ? (sim.adaptive ? "Learned model loaded · pointing gain ×2.25" : "Learned model cold — connect once to learn") : "Reactive control · fixed gain ×1"}</span></div><em style={{ color: "#8060df" }}>{confidence}% conf.</em></div>
        <div className="fp-pad"><table className="fp-tbl"><thead><tr><th>Measured this session</th><th>Conventional</th><th>SCINTILLA</th></tr></thead><tbody>
            <tr><td>Acquisition time</td><td style={best(stats.off.acq, stats.on.acq, "off")}>{fmt(stats.off.acq)} s</td><td style={best(stats.off.acq, stats.on.acq)}>{fmt(stats.on.acq)} s</td></tr>
            <tr><td>Disturbance recovery</td><td style={best(stats.off.rec, stats.on.rec, "off")}>{fmt(stats.off.rec)} s</td><td style={best(stats.off.rec, stats.on.rec)}>{fmt(stats.on.rec)} s</td></tr>
            <tr><td>Peak error in disturbance</td><td style={best(stats.off.peak, stats.on.peak, "off")}>{fmt(stats.off.peak, 2)}°</td><td style={best(stats.off.peak, stats.on.peak)}>{fmt(stats.on.peak, 2)}°</td></tr></tbody></table>
            <div className="sc-control-actions"><button className="sc-primary" disabled={ab !== null} onClick={runAB}>{ab === null ? "RUN A/B COMPARISON" : ab === 0 ? "RUNNING 1/2 · CONVENTIONAL" : "RUNNING 2/2 · SCINTILLA"}</button><button className="sc-secondary" onClick={() => setStats({ on: {}, off: {} })}>CLEAR RESULTS</button></div>
            <div className="fp-note">A/B runs the same acquisition → turbulence → correction sequence once per controller on the live simulation. Toggle the controller any time from the top bar and operate normally — each run is measured automatically.</div></div>
        <div className="fp-pad"><div className="sc-control-row"><b>Held-out benchmark (synthetic)</b></div>{verified ? <div className="sc-mini-grid"><div className="sc-mini"><span>Classical</span><b>{verified.classical_mean_error_px.toFixed(1)} px</b></div><div className="sc-mini"><span>Learned</span><b>{verified.learned_mean_error_px.toFixed(1)} px</b></div><div className="sc-mini"><span>Scenarios</span><b>{verified.n_scenarios}</b></div></div> : <div className="fp-note">Backend offline — start the FastAPI server to load verified results.</div>}</div>
    </div>);
    const secDist = (<section className="sc-card"><div className="sc-card-head"><span>DISTURBANCE MONITOR</span><span style={{ color: disturbance ? "#c17b22" : "#1679d1", fontSize: 8 }}>● {disturbance ? "ACTIVE" : "LIVE TRACE"}</span></div><div style={{ padding: "7px 12px 11px" }}>
        {([["Pointing error °", h.map(x => x.e), "#ef6b80"], ["Jitter °/s", h.map(x => x.j), "#4d9ee8"], ["Link quality %", h.map(x => x.q), "#7b74d9"]] as [string, number[], string][]).map(([l, d, c]) => <div key={l} style={{ marginBottom: 4 }}><div style={{ fontSize: 8, color: "#788792", fontWeight: 800 }}>{l}</div><Spark data={d} color={c} /></div>)}
        <div className="sc-mini-grid" style={{ marginTop: 4 }}><div className="sc-mini"><span>Jitter</span><b>{sim.jitter.toFixed(3)}°/s</b></div><div className="sc-mini"><span>Error</span><b>{sim.pointingErrorDeg.toFixed(3)}°</b></div><div className="sc-mini"><span>Disturbance</span><b>{sim.disturbance.toFixed(2)}</b></div></div></div></section>);
    const secEvid = (<section className="sc-card"><div className="sc-card-head"><span>EVIDENCE & VALIDATION</span><span style={{ color: verified ? "#079b76" : "#c17b22", fontSize: 8 }}>● {verified ? "VERIFIED" : "BACKEND OFFLINE"}</span></div><div className="sc-verified">{verified ? <><div className="sc-verified-row"><b>{verified.learned_mean_error_px.toFixed(1)} px</b><span>learned mean error (held-out)</span></div><div className="sc-verified-row"><b>{verified.classical_mean_error_px.toFixed(1)} px</b><span>classical baseline mean error</span></div><div className="sc-verified-row"><b>{verified.n_scenarios}</b><span>held-out synthetic scenarios</span></div></> : <div className="sc-verified-row"><span>Start the FastAPI backend to load verified held-out results.</span></div>}</div></section>);
    const cmds: [string, string, () => void][] = [
        ["SC-1 transmitter inspector", "spacecraft satellite", () => openPanel("a")], ["SC-2 receiver inspector", "spacecraft satellite", () => openPanel("b")],
        ["Ground station inspector", "ground gs", () => openPanel("gs")], ["Optical link inspector", "link beam", () => openPanel("link")],
        ["Data link · send file or message", "transfer comms packets", () => openPanel("xfer")], ["SCINTILLA Intelligence A/B", "model compare", () => openPanel("intel")],
        ["Control & mission configuration", "power gain topology", () => openPanel("cfg")], ["Mission telemetry", "gauges signal", () => openPanel("tel")], ["Disturbance monitor", "jitter trace", () => openPanel("dist")],
        ["Scintilla assistant", "advisor", () => openPanel("assist")], ["Evidence & validation", "benchmark", () => openPanel("evid")], ["Mission activity log", "events", () => openPanel("act")], ["Mission package", "name", () => openPanel("pkg")],
        [connected ? "Disconnect link" : "Establish link", "action", connected ? handleDisconnect : handleEstablish], ["Inject turbulence", "action disturbance", handleInject], ["Apply correction", "action", handleApply],
        [demoRunning ? "Stop live demo" : "Run live demo", "action", demoRunning ? stopDemo : startDemo], ["Toggle SCINTILLA Intelligence", "action model", () => updateIntelligence(!sim.intelligence)],
        ["Topology: satellite → satellite", "action", () => updateGround(false)], ["Topology: ground → satellite", "action", () => updateGround(true)],
        ["View: mission", "camera", () => setView("mission")], ["View: SC-1", "camera", () => setView("terminal-a")], ["View: SC-2", "camera", () => setView("terminal-b")],
        ["Export telemetry JSON", "action", exportSnapshot], ["Copy telemetry", "action", copyTelemetry],
        ...logs.map((l): [string, string, () => void] => [l.title, `activity ${l.time} ${l.detail}`, () => openPanel("act")]),
    ];
    const hits = cmds.filter(([l, k]) => q.toLowerCase().split(/\s+/).every(w => (l + " " + k).toLowerCase().includes(w))).slice(0, 8);
    const runHit = (fn: () => void) => { fn(); setQ(""); setQOpen(false); qRef.current?.blur(); };
    const secAct = (<section className="sc-card"><div className="sc-card-head"><span>MISSION ACTIVITY</span><button onClick={() => setShowLogs(v => !v)} style={{ border: 0, background: "transparent", color: "#1679d1", fontSize: 8, fontWeight: 750, cursor: "pointer" }}>{showLogs ? "Hide" : "View all"}</button></div><div className="sc-log">{(showLogs ? logs : logs.slice(0, 4)).map(item => <ActivityItem key={item.id} item={item}/>)}</div></section>);
    const secPkg = (<section className="sc-card" style={{ background: "linear-gradient(135deg,#f7fbfd,#eef5f9)", color: "#13202b" }}><div style={{ padding: 12 }}><div style={{ fontSize: 8, color: "#6d8594", letterSpacing: ".12em", fontWeight: 800 }}>MISSION PACKAGE</div><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 3 }}><b style={{ fontSize: 13 }}>{missionName}</b><span style={{ width: 8, height: 8, borderRadius: "50%", background: connected ? "#1ee0a6" : "#6b7c88", boxShadow: connected ? "0 0 12px rgba(30,224,166,.65)" : "none" }}/></div><input value={missionName} onChange={e => setMissionName(e.target.value)} style={{ width: "100%", marginTop: 9, padding: "8px", borderRadius: 8, border: "1px solid #d8e3ea", background: "#fff", color: "#13202b", outline: "none", fontSize: 9 }}/><div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 5, marginTop: 8, fontSize: 8, color: "#73818d" }}><span>STATE</span><b style={{ textAlign: "right", color: "#13202b" }}>{statusLabel}</b><span>MODEL</span><b style={{ textAlign: "right", color: "#13202b" }}>{sim.intelligence ? "ADAPTIVE" : "REACTIVE"}</b></div></div></section>);
    const linkBtn = <div className="fp-pad"><button className={connected ? "sc-dark red" : "sc-primary"} onClick={connected ? handleDisconnect : handleEstablish} disabled={demoRunning}>{connected ? "DISCONNECT" : learned ? "RECONNECT LINK" : "ESTABLISH LINK"}</button></div>;
    const idCard = (name: string, meta: string, accent: string, live: boolean) => <div className="fp-id" style={{ borderLeft: `3px solid ${accent}` }}><div><b>{name}</b><span>{meta}</span></div><em style={{ color: live ? "#079b76" : "#7b8993" }}>● {live ? "ONLINE" : "READY"}</em></div>;
    const healthBlock = (<>
        <div className="sc-analog-grid" style={{ background: "transparent", padding: 8 }}><div className="sc-analog" style={{ background: "#0d2235", borderColor: "#29465f", color: "#dceafb" }}><Gauge label="System health" value={`${health}%`} p={health} color="#08b98a" /></div><div className="sc-analog" style={{ background: "#0d2235", borderColor: "#29465f", color: "#dceafb" }}><Gauge label="Link quality" value={connected ? `${sim.quality.toFixed(0)}%` : "—"} p={connected ? sim.quality : 0} color="#19bfe8" /></div></div>
        {miniGrid([["Link margin", linkMargin === null ? "—" : `${linkMargin.toFixed(1)} dB`], ["Pointing error", `${sim.pointingErrorDeg.toFixed(3)}°`], ["Confidence", `${confidence}%`], ["Beacon", sim.beaconVisible ? "VISIBLE" : "SEARCHING"], ["Adaptive state", sim.adaptive ? "ACTIVE" : "IDLE"], ["Learned model", learned ? "LOADED" : "COLD"]])}
    </>);
    const inspector = (s: "a" | "b") => {
        const acc = s === "a" ? "#ff3f68" : "#32d8ff", ev = s === "a" ? evA : evB, setEv = s === "a" ? setEvA : setEvB, tab = tabs[s];
        return (<div>
            {idCard(s === "a" ? "SC-1 · TRANSMITTER" : "SC-2 · RECEIVER", `${s === "a" ? "LEO · 500 km" : "LEO · 520 km"} · Optical terminal · ${phaseLabels[phase]}`, acc, connected)}
            <div className="fp-tabs">{[["cam", "Camera & Health"], ["ctl", "Controls"], ["tel", "Telemetry"]].map(([k, l]) => <button key={k} className={tab === k ? "active" : ""} onClick={() => setTabs(x => ({ ...x, [s]: k }))}>{l}</button>)}</div>
            {tab === "cam" && <><CameraPanel title={`${s === "a" ? "SC-1" : "SC-2"} · Event Camera`} eventView={ev} setEventView={setEv} simulation={sim} accent={acc} />{healthBlock}</>}
            {tab === "ctl" && <>{ctlBody}{linkBtn}</>}
            {tab === "tel" && <>{secTel}{secDist}</>}
        </div>);
    };
    const body = (id: string) => {
        if (id === "a" || id === "b") return inspector(id);
        if (id === "cfg") return ctlBody;
        if (id === "tel") return secTel;
        if (id === "assist") return secAssist;
        if (id === "dist") return secDist;
        if (id === "evid") return secEvid;
        if (id === "act") return secAct;
        if (id === "pkg") return secPkg;
        if (id === "xfer") return xferBody;
        if (id === "intel") return intelBody;
        if (id === "link") return (<div>
            {idCard("OPTICAL LINK", `${ground ? "GS-1 → SC-2" : "SC-1 → SC-2"} · ${sim.controller === "scintilla_predictive" ? "Predictive PAT/ATP" : "Reactive PAT/ATP"}`, "#1689d5", connected)}
            <div className="fp-chips">{stages.map((st, i) => <span key={st} className={`fp-chip ${i < stageIndex ? "done" : i === stageIndex ? "cur" : ""}`}>{st}</span>)}</div>
            {miniGrid([["Slant range", `${sim.distanceKm.toFixed(0)} km`], ["Signal", connected ? `${sim.signalDb.toFixed(1)} dB` : "—"], ["Link quality", connected ? `${sim.quality.toFixed(0)}%` : "—"], ["Data rate", connected ? `${sim.dataRate.toFixed(1)} Gbps` : "—"], ["Latency", connected ? `${sim.latency.toFixed(1)} ms` : "—"], ["Link margin", linkMargin === null ? "—" : `${linkMargin.toFixed(1)} dB`], ["Pointing error", `${sim.pointingErrorDeg.toFixed(3)}°`], ["Jitter RMS", `${sim.jitter.toFixed(3)}°/s`], ["Confidence", `${confidence}%`]])}
            <div className="fp-pad"><div className="sc-control-actions"><button className="sc-dark" onClick={handleInject}>{disturbance ? "TURBULENCE ACTIVE" : "INJECT TURBULENCE"}</button><button className={demoRunning ? "sc-dark red" : "sc-primary"} onClick={demoRunning ? stopDemo : startDemo}>{demoRunning ? "STOP LIVE DEMO" : "RUN LIVE DEMO"}</button></div>
                {disturbance && <button className="sc-primary" onClick={handleApply}>{sim.intelligence ? "APPLY PREDICTIVE CORRECTION" : "APPLY REACTIVE CORRECTION"}</button>}</div>
            {linkBtn}
        </div>);
        return (<div>
            {idCard("GS-1 · GROUND STATION", "Bengaluru · Ground terminal", "#ff4eb7", ground && connected)}
            {miniGrid([["Topology", ground ? "GS-1 → SC-2" : "Inactive"], ["Slant range", `${sim.distanceKm.toFixed(0)} km`], ["Signal", connected ? `${sim.signalDb.toFixed(1)} dB` : "—"], ["Link margin", linkMargin === null ? "—" : `${linkMargin.toFixed(1)} dB`], ["Pointing error", `${sim.pointingErrorDeg.toFixed(3)}°`], ["Link state", phaseLabels[phase]]])}
            <div className="fp-pad"><div className="sc-control-row"><span>Endpoint topology</span><b>{ground ? "GS-1 → SC-2" : "SC-1 → SC-2"}</b></div><div className="sc-mode"><button className={!ground ? "active" : ""} onClick={() => updateGround(false)}>Satellite</button><button className={ground ? "active" : ""} onClick={() => updateGround(true)}>Ground → Sat</button></div>
                {!ground && <div className="fp-note">The ground terminal is drawn in the receiver slot when Ground → Sat topology is selected.</div>}</div>
            {linkBtn}
        </div>);
    };
    const dock: [string, string, string[]][] = [["◈", "Mission", ["cfg"]], ["⌘", "Terminals", ["a", "b"]], ["◉", "AI", ["assist", "dist"]], ["⇄", "Comms", ["xfer"]], ["▱", "Data", ["tel", "evid", "act"]], ["⚙", "Settings", ["pkg"]]];
    return (<div className="scintilla-console">
        <style>{`

        .scintilla-console{--ink:#13202b;min-height:100vh;height:100vh;overflow:hidden;background:radial-gradient(circle at 70% -20%,rgba(31,153,220,.08),transparent 34%),linear-gradient(180deg,#f5f8fa,#edf2f5);color:var(--ink);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}

        .scintilla-console *{box-sizing:border-box}

        .sc-topbar{height:68px;display:grid;grid-template-columns:245px minmax(300px,1fr) 300px 185px;align-items:center;gap:16px;padding:0 18px;background:rgba(255,255,255,.95);border-bottom:1px solid #d9e2e7;box-shadow:0 1px 14px rgba(20,35,48,.055);backdrop-filter:blur(20px)}

        .sc-brand{display:flex;align-items:center;gap:10px}.sc-mark{width:27px;height:27px;flex:0 0 27px;transform:none;border-radius:50%;border:4px solid #1c3038;border-right-color:#5d9e9b;background:transparent;box-shadow:none;position:relative}.sc-mark:after{content:"";position:absolute;inset:4px;background:#f8f9f7;border-radius:50%;opacity:1}.sc-brand-title{font-family:Manrope,Inter,ui-sans-serif,sans-serif;font-size:17px;font-weight:700;letter-spacing:-.075em}.sc-brand-sub{font-size:8px;color:#758997;margin-top:3px;letter-spacing:.1em}

        .sc-nav{display:flex;gap:4px}.sc-nav button,.sc-nav a{border:0;background:transparent;color:#667681;text-decoration:none;padding:9px 12px;border-radius:9px;font-size:10px;font-weight:650;cursor:pointer}.sc-nav .active{background:#e9eff3;color:#17232d}

        .sc-search{height:38px;border:1px solid #d9e3e8;border-radius:11px;background:#f8fafb;display:flex;align-items:center;padding:0 12px;color:#83919c;font-size:10px}.sc-operator{display:flex;justify-content:flex-end;align-items:center;gap:9px}.sc-avatar{width:31px;height:31px;border-radius:50%;display:grid;place-items:center;color:#fff;background:#202a33;font-size:9px;font-weight:800}

        .sc-main{height:calc(100vh - 68px);display:grid;grid-template-columns:70px minmax(0,1fr) 348px;min-height:0}

        .sc-rail{background:rgba(248,250,251,.92);border-right:1px solid #dce4e8;padding:12px 8px;display:flex;flex-direction:column;gap:7px}.sc-rail button{height:60px;border:1px solid transparent;background:transparent;border-radius:11px;color:#788792;font-size:8px;display:flex;flex-direction:column;gap:6px;align-items:center;justify-content:center;cursor:pointer}.sc-rail button span{font-size:17px;line-height:1}.sc-rail button.active{background:#fff;border-color:#d9e3e8;color:#1a2a36;box-shadow:0 5px 14px rgba(18,32,45,.06)}

        .sc-center{min-width:0;min-height:0;padding:12px;display:grid;grid-template-rows:minmax(390px,1fr) 278px;gap:12px;overflow:hidden}.sc-space{min-height:0;position:relative;overflow:hidden;border-radius:17px;background:#020817;border:1px solid #152536;box-shadow:0 12px 32px rgba(12,24,35,.15)}.sc-space canvas{display:block}

        .sc-status{position:absolute;z-index:20;top:14px;left:14px;display:grid;grid-template-columns:1.3fr repeat(4,minmax(92px,1fr));width:min(650px,calc(100% - 190px));background:rgba(248,251,253,.96);border:1px solid #d8e1e6;border-radius:13px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.16);backdrop-filter:blur(14px)}.sc-metric{padding:9px 12px;border-right:1px solid #e4eaee;min-width:0}.sc-metric:last-child{border-right:0}.sc-metric-label{font-size:7px;color:#788792;letter-spacing:.08em;text-transform:uppercase}.sc-metric-value{margin-top:4px;font-size:12px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

        .sc-scene-tools{position:absolute;z-index:20;top:14px;right:14px;display:flex;gap:7px}.sc-tool{height:34px;border:1px solid #d8e2e7;border-radius:9px;background:rgba(255,255,255,.95);color:#52616d;padding:0 10px;font-size:9px;font-weight:700;box-shadow:0 7px 18px rgba(0,0,0,.12);cursor:pointer}

        .sc-endpoint{position:absolute;z-index:18;top:88px;width:190px;padding:10px 11px;background:rgba(249,251,252,.96);border:1px solid #dbe4e8;border-radius:11px;box-shadow:0 8px 20px rgba(0,0,0,.13);backdrop-filter:blur(12px)}.sc-endpoint.a{left:14px;border-left:3px solid #ff3f68}.sc-endpoint.b{right:14px;border-left:3px solid #32d8ff}.sc-endpoint-name{font-size:10px;font-weight:800}.sc-endpoint-meta{font-size:8px;color:#778691;margin-top:4px}.sc-endpoint-state{font-size:8px;font-weight:750;margin-top:5px}

        .sc-timeline{position:absolute;z-index:22;left:14px;right:14px;bottom:12px;height:58px;border:1px solid rgba(128,163,187,.28);border-radius:12px;background:rgba(3,10,17,.91);backdrop-filter:blur(16px);display:grid;grid-template-columns:repeat(7,1fr) 130px;align-items:center;padding:0 8px;color:#9aacb8}.sc-stage{position:relative;text-align:center;font-size:7px;height:40px;display:flex;flex-direction:column;justify-content:center;gap:5px}.sc-stage:not(:last-of-type):after{content:"";position:absolute;top:13px;left:58%;right:-42%;height:1px;background:#455866}.sc-stage-dot{position:relative;z-index:2;margin:auto;width:13px;height:13px;border-radius:50%;border:1px solid #687b88;background:#1e2b35;display:grid;place-items:center;font-size:7px}.sc-stage.done .sc-stage-dot{background:#8196a3;color:#fff}.sc-stage.current{color:#fff}.sc-stage.current .sc-stage-dot{background:#fff;color:#0c6c9f;box-shadow:0 0 0 4px rgba(79,190,232,.14)}.sc-action{height:36px;border:0;border-radius:9px;color:#fff;font-size:9px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#087fd3,#16b2e2);box-shadow:0 6px 16px rgba(10,145,216,.28)}.sc-action.danger{background:linear-gradient(135deg,#a94557,#d76b67)}

        .sc-lower{min-height:0;display:grid;grid-template-columns:1fr 1.25fr 1fr;gap:12px}.sc-panel,.sc-card{min-height:0;background:rgba(255,255,255,.97);border:1px solid #dbe4e9;border-radius:14px;box-shadow:0 8px 22px rgba(18,32,45,.055);overflow:hidden}.sc-panel-head,.sc-card-head{height:39px;flex:none;padding:0 12px;border-bottom:1px solid #e7edf0;display:flex;align-items:center;justify-content:space-between;font-size:10px;font-weight:800}.sc-lower>.sc-panel:nth-child(2){overflow-y:auto;overflow-x:hidden;scrollbar-width:thin;scrollbar-color:#b9c9d3 transparent}.sc-lower>.sc-panel:nth-child(2)::-webkit-scrollbar{width:6px}.sc-lower>.sc-panel:nth-child(2)::-webkit-scrollbar-thumb{background:#b9c9d3;border-radius:999px}.sc-lower>.sc-panel:nth-child(2)::-webkit-scrollbar-track{background:transparent}.sc-lower>.sc-panel:nth-child(2)>.sc-panel-head{position:sticky;top:0;z-index:5;background:rgba(255,255,255,.97);backdrop-filter:blur(10px)}

        .sc-control{padding:10px 12px;display:grid;gap:9px}.sc-control-row{display:flex;justify-content:space-between;align-items:center;font-size:9px}.sc-control-row b{font-size:9px}.sc-slider{width:100%;accent-color:#1689d5}.sc-mode{display:flex;gap:5px;margin-top:5px}.sc-mode button{flex:1;height:25px;border:1px solid #dce4e9;background:#f8fafb;border-radius:7px;font-size:8px;color:#64737d;cursor:pointer}.sc-mode button.active{background:#eaf5fb;border-color:#9dd5ea;color:#0c79b3;font-weight:800}.sc-control-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px}.sc-primary,.sc-dark{height:32px;border:0;border-radius:8px;font-size:8px;font-weight:800;cursor:pointer}.sc-primary{background:linear-gradient(135deg,#147fd0,#20b3df);color:#fff}.sc-dark{background:#122431;color:#fff}.sc-dark.red{background:#8d3948}.sc-mini-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}.sc-mini{padding:7px;border:1px solid #e3eaee;border-radius:9px;background:#f8fafb}.sc-mini span{display:block;font-size:7px;color:#82909a}.sc-mini b{display:block;margin-top:3px;font-size:9px}

        .sc-right{min-width:0;min-height:0;overflow:auto;padding:12px 12px 12px 0}.sc-right-inner{display:grid;gap:10px}.sc-gauge-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px}.sc-gauge{padding:10px;border:1px solid #e3eaee;border-radius:11px;background:#fafcfd}.sc-gauge-top{display:flex;justify-content:space-between;align-items:baseline}.sc-gauge-value{font-size:15px;font-weight:800}.sc-bar{height:4px;border-radius:9px;background:#e9eef1;overflow:hidden;margin-top:8px}.sc-bar i{display:block;height:100%;border-radius:9px}.sc-analog-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:10px 12px}.sc-analog{min-width:0;padding:9px 6px 7px;border:1px solid #dfe7eb;border-radius:11px;background:linear-gradient(180deg,#fbfdfe,#f4f8fa);display:grid;place-items:center}.gauge{display:grid;justify-items:center;gap:5px;width:100%;color:#5e6670}.gauge .ring{width:76px;height:76px;border-radius:50%;display:grid;place-items:center;font-size:13px;font-weight:800;position:relative;background:conic-gradient(var(--gauge) calc(var(--p)*1%),#e6edf1 0);box-shadow:inset 0 0 0 7px #f8fbfc,0 2px 8px rgba(18,32,45,.08);isolation:isolate}.gauge .ring:after{content:"";position:absolute;inset:12px;border-radius:50%;background:#fff;border:1px solid #e2e9ed;z-index:-1}.gauge .ring .gauge-value{position:relative;z-index:2;font-size:11px;font-weight:800;white-space:nowrap}.sc-analog .gauge>span{font-size:7px;letter-spacing:.07em;text-transform:uppercase;color:#7a8994;font-weight:800}.sc-actions{display:grid;grid-template-columns:1fr 1fr;gap:7px;padding:0 12px 12px}.sc-secondary{height:30px;border:1px solid #d7e1e6;border-radius:8px;background:#fff;color:#50616c;font-size:8px;font-weight:750;cursor:pointer}

        .sc-ai{margin:10px 12px;padding:10px;border-radius:11px;border:1px solid #dce7ef;background:linear-gradient(135deg,#f4faff,#f8f4ff);display:flex;gap:9px}.sc-ai-orb{width:27px;height:27px;flex:none;border-radius:50%;background:radial-gradient(circle at 32% 28%,#fff,#9fe3ef 22%,#329dc6 50%,#5363b5 78%,#1f2a43);box-shadow:0 0 0 5px rgba(32,183,223,.08),0 5px 14px rgba(40,127,218,.18)}.sc-ai b{font-size:10px}.sc-ai p{font-size:8px;color:#73818d;line-height:1.5;margin:4px 0 0}.sc-advisory{margin:0 12px 12px;padding:9px;border-radius:9px;font-size:8px;border:1px solid #dce6ed;background:#f7fafc}

        .sc-verified{padding:10px 12px;display:grid;gap:7px}.sc-verified-row{display:flex;gap:8px;font-size:8px;color:#74838e;line-height:1.4}.sc-verified-row b{color:#16252f;white-space:nowrap}.sc-log{padding:0 12px 10px}

        @media(max-width:1250px){.sc-topbar{grid-template-columns:220px 1fr 260px}.sc-operator{display:none}.sc-main{grid-template-columns:62px minmax(0,1fr) 310px}.sc-status{width:590px}}

        @media(max-width:1050px){.sc-main{grid-template-columns:62px minmax(0,1fr)}.sc-right{display:none}}

      
/* ORBI FULL-SCREEN MISSION WORKSPACE — one viewport, floating instrument chrome */
.scintilla-console{
  position:fixed!important;inset:0!important;width:100%!important;height:100vh!important;height:100dvh!important;
  min-height:0!important;overflow:hidden!important;background:#071724!important;color:#172632!important;
  isolation:isolate!important;font-family:"Manrope",Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;
}
.scintilla-console .sc-space{
  position:absolute!important;inset:0!important;width:100%!important;height:100%!important;min-height:0!important;
  border:0!important;border-radius:0!important;box-shadow:none!important;background:#071724!important;z-index:0!important;
}
.scintilla-console .sc-space canvas{display:block!important;width:100%!important;height:100%!important;outline:none!important}
.scintilla-console .sc-topbar{
  position:absolute!important;z-index:60!important;top:12px!important;left:12px!important;right:12px!important;
  width:auto!important;height:64px!important;padding:0 22px!important;display:grid!important;
  grid-template-columns:210px auto minmax(140px,1fr) auto!important;gap:18px!important;align-items:center!important;
  border:1px solid #dbe5ea!important;border-radius:18px!important;background:rgba(250,252,253,.94)!important;
  box-shadow:0 14px 42px #061a2722,0 1px 0 #fff inset!important;backdrop-filter:blur(24px)!important;
}
.scintilla-console .sc-brand{gap:10px!important}
.scintilla-console .sc-mark{
  width:34px!important;height:34px!important;flex:0 0 34px!important;transform:none!important;border-radius:50%!important;
  background:conic-gradient(from 35deg,#1a303d 0 72%,#66c9bd 73% 88%,#b8c9d2 89% 100%)!important;box-shadow:none!important;
}
.scintilla-console .sc-mark:after{inset:5px!important;border-radius:50%!important;background:#f8fafb!important}
.scintilla-console .sc-brand-title{font-size:17px!important;font-weight:800!important;letter-spacing:-.06em!important;color:#172632!important}
.scintilla-console .sc-brand-sub{font-size:8px!important;letter-spacing:.1em!important;color:#758997!important}
.scintilla-console .sc-nav{display:flex!important;gap:4px!important;white-space:nowrap!important}
.scintilla-console .sc-nav button,.scintilla-console .sc-nav a{
  border-radius:999px!important;padding:10px 13px!important;font-size:10px!important;font-weight:650!important;
  color:#607482!important;text-decoration:none!important;transition:background .2s,color .2s!important;
}
.scintilla-console .sc-nav .active{background:#e8f0f3!important;color:#17303b!important;box-shadow:inset 0 0 0 1px #dbe6eb!important}
.scintilla-console .sc-nav button:hover,.scintilla-console .sc-nav a:hover{background:#edf4f6!important;color:#18313d!important}
.scintilla-console .sc-search{position:relative!important;min-width:0!important;width:100%!important;height:40px!important;border-radius:999px!important;background:#f3f7f9!important;border:1px solid #dce6eb!important;padding:0 15px!important;gap:8px!important}
.scintilla-console .sc-search input{width:100%!important;min-width:0!important;background:transparent!important;border:0!important;outline:none!important;color:#203743!important;font-size:11px!important}
.scintilla-console .sc-hits{z-index:100!important;top:calc(100% + 8px)!important;left:0!important;right:0!important}
.scintilla-console .sc-operator{display:flex!important;justify-content:flex-end!important;align-items:center!important;gap:12px!important}
.scintilla-console .sc-intel{border-radius:999px!important;border:1px solid #dce6eb!important;background:#fff!important;padding:5px 11px 5px 7px!important;white-space:nowrap!important}
.scintilla-console .sc-intel.on{background:#edf7f4!important;border-color:#b8ddd4!important}
.scintilla-console .sc-intel b{font-size:10px!important;color:#203744!important}
.scintilla-console .sc-intel span{font-size:8px!important;color:#748893!important}
.scintilla-console .sc-rail{
  position:absolute!important;z-index:50!important;left:12px!important;top:88px!important;bottom:88px!important;width:64px!important;
  display:flex!important;flex-direction:column!important;gap:7px!important;padding:8px 6px!important;
  overflow:auto!important;border:1px solid #dbe5ea!important;border-radius:18px!important;
  background:rgba(250,252,253,.91)!important;box-shadow:0 16px 38px #061a2720!important;backdrop-filter:blur(22px)!important;
}
.scintilla-console .sc-rail button{flex:0 0 56px!important;height:56px!important;border:1px solid transparent!important;border-radius:12px!important;background:transparent!important;color:#718591!important;font-size:8px!important;gap:6px!important}
.scintilla-console .sc-rail button span{font-size:17px!important}
.scintilla-console .sc-rail button:hover{background:#f0f6f7!important;color:#315b64!important}
.scintilla-console .sc-rail button.active,.scintilla-console .sc-rail button.open{background:#fff!important;border-color:#d9e6e9!important;color:#176e69!important;box-shadow:0 5px 16px #1d39400b!important}
.scintilla-console .sc-status{
  position:absolute!important;z-index:45!important;top:92px!important;left:88px!important;right:380px!important;
  transform:none!important;width:auto!important;max-width:700px!important;min-height:56px!important;
  display:grid!important;grid-template-columns:1.25fr repeat(4,minmax(0,1fr))!important;
  border:1px solid #dbe6eb!important;border-radius:14px!important;overflow:hidden!important;
  background:rgba(250,252,253,.92)!important;box-shadow:0 12px 32px #061a2719!important;backdrop-filter:blur(20px)!important;
}
.scintilla-console .sc-metric{min-width:0!important;padding:10px 12px!important;border-right:1px solid #e2eaee!important}
.scintilla-console .sc-metric:last-child{border-right:0!important}
.scintilla-console .sc-metric-label{font-size:7px!important;letter-spacing:.1em!important;color:#718592!important}
.scintilla-console .sc-metric-value{font-size:11px!important;letter-spacing:-.02em!important;color:#1b303b!important}
.scintilla-console .sc-scene-tools{position:absolute!important;z-index:45!important;top:92px!important;right:16px!important;left:auto!important;display:flex!important;gap:6px!important;flex-wrap:wrap!important;justify-content:flex-end!important}
.scintilla-console .sc-tool{height:34px!important;border-radius:999px!important;background:rgba(250,252,253,.94)!important;border:1px solid #d6e3e8!important;color:#3d5b68!important;box-shadow:0 6px 18px #06172220!important}
.scintilla-console .sc-endpoint{
  position:absolute!important;z-index:35!important;top:auto!important;bottom:96px!important;height:auto!important;min-height:0!important;
  width:178px!important;max-width:calc(50vw - 30px)!important;padding:11px 13px!important;
  border-radius:12px!important;background:rgba(250,252,253,.93)!important;border:1px solid #d6e3e8!important;
  box-shadow:0 10px 28px #06172225!important;backdrop-filter:blur(18px)!important;cursor:pointer!important;
}
.scintilla-console .sc-endpoint.a{left:90px!important;right:auto!important;border-left:3px solid #d7a35c!important}
.scintilla-console .sc-endpoint.b{right:378px!important;left:auto!important;border-left:3px solid #4abeb5!important}
.scintilla-console .sc-endpoint-name{font-size:10px!important;font-weight:800!important;color:#203743!important}
.scintilla-console .sc-endpoint-meta{font-size:8px!important;color:#718592!important}
.scintilla-console .sc-endpoint-state{font-size:8px!important}
.scintilla-console .sc-timeline{
  position:absolute!important;z-index:48!important;left:90px!important;right:378px!important;width:auto!important;
  transform:none!important;bottom:16px!important;height:62px!important;padding:0 10px!important;
  display:grid!important;grid-template-columns:repeat(7,minmax(0,1fr)) 142px!important;gap:2px!important;
  border:1px solid #dbe5ea!important;border-radius:16px!important;background:rgba(250,252,253,.94)!important;
  color:#647987!important;box-shadow:0 14px 36px #061a2724!important;backdrop-filter:blur(22px)!important;
}
.scintilla-console .sc-stage{min-width:0!important;font-size:7px!important;letter-spacing:.015em!important}
.scintilla-console .sc-stage:not(:last-of-type):after{background:#cfdbe2!important}
.scintilla-console .sc-stage-dot{border-color:#b9cbd3!important;background:#edf3f6!important}
.scintilla-console .sc-stage.done .sc-stage-dot{background:#9dbeb8!important;border-color:#9dbeb8!important;color:#fff!important}
.scintilla-console .sc-stage.current{color:#17303b!important;font-weight:800!important}
.scintilla-console .sc-stage.current .sc-stage-dot{background:#a5e6dc!important;border-color:#75c9bd!important;color:#153d43!important;box-shadow:0 0 0 4px #7ddbc726!important}
.scintilla-console .sc-action{height:38px!important;border:0!important;border-radius:999px!important;background:linear-gradient(135deg,#217f7b,#319d96)!important;box-shadow:0 7px 18px #247f7b20!important;font-size:9px!important;letter-spacing:.02em!important}
.scintilla-console .sc-action.danger{background:linear-gradient(135deg,#a64d4f,#c96c65)!important}
.scintilla-console .fp{
  position:absolute!important;z-index:70!important;max-width:calc(100vw - 24px)!important;
  border:1px solid #d7e4e9!important;border-radius:15px!important;background:rgba(255,255,255,.97)!important;
  box-shadow:0 18px 55px #16344224!important;overflow:hidden!important;backdrop-filter:blur(22px)!important;
}
.scintilla-console .fp-head{height:42px!important;min-height:42px!important;background:linear-gradient(180deg,#fff,#f7fafb)!important;border-bottom:1px solid #e4ecef!important;color:#203743!important;padding:0 10px!important;font-size:9px!important;letter-spacing:.035em!important}
.scintilla-console .fp-head button{border-radius:50%!important;background:#edf3f5!important;color:#526d79!important}
.scintilla-console .fp-head button:hover{background:#dfeaed!important}
.scintilla-console .fp-body{scrollbar-color:#c5d7dd transparent!important}
.scintilla-console .sc-panel,.scintilla-console .sc-card{border-radius:14px!important;border-color:#dbe5ea!important;background:rgba(255,255,255,.97)!important;box-shadow:0 8px 26px #1734400b,0 1px 0 #fff inset!important}
.scintilla-console .sc-panel-head,.scintilla-console .sc-card-head{height:43px!important;padding:0 14px!important;border-bottom-color:#e7eef1!important;color:#243b47!important;font-size:10px!important}
.scintilla-console .sc-control{padding:12px 14px!important;gap:10px!important}
.scintilla-console .sc-control-row{font-size:9px!important;color:#5c7481!important}
.scintilla-console .sc-control-row b{font-size:10px!important;color:#203743!important}
.scintilla-console .sc-slider{accent-color:#398f8a!important}
.scintilla-console .sc-mode button{border-radius:999px!important;background:#f7fafb!important;border-color:#dce7eb!important;color:#657d88!important}
.scintilla-console .sc-mode button.active{background:#eaf6f3!important;border-color:#b6ddd5!important;color:#176e69!important}
.scintilla-console .sc-primary{background:linear-gradient(135deg,#217f7b,#319d96)!important;border-radius:999px!important;box-shadow:0 5px 12px #247f7b20!important}
.scintilla-console .sc-dark{background:#1b303b!important;border-radius:999px!important}
.scintilla-console .sc-dark.red{background:#a94e53!important}
.scintilla-console .sc-mini{background:#f7fafb!important;border-color:#e1eaee!important;border-radius:10px!important}
.scintilla-console .sc-mini span{color:#758b96!important}
.scintilla-console .sc-mini b{color:#203944!important}
.scintilla-console .sc-right{padding:16px!important;scrollbar-color:#c6d6dc transparent!important}
.scintilla-console .sc-right-inner{gap:12px!important}
.scintilla-console .sc-gauge{background:#f8fbfc!important;border-color:#e0eaee!important;border-radius:12px!important}
.scintilla-console .sc-gauge-value{color:#1d3440!important}
.scintilla-console .sc-bar{background:#e1ebee!important}
.scintilla-console .sc-primary:focus-visible,.scintilla-console .sc-dark:focus-visible,.scintilla-console .sc-tool:focus-visible{outline:2px solid #65b8b0!important;outline-offset:2px!important}
@media(max-width:1350px){
 .scintilla-console .sc-topbar{grid-template-columns:180px auto minmax(100px,1fr) auto!important;gap:9px!important;padding:0 14px!important}
 .scintilla-console .sc-nav button,.scintilla-console .sc-nav a{padding:9px 8px!important}
 .scintilla-console .sc-status{right:340px!important;left:84px!important}
 .scintilla-console .sc-endpoint.b{right:338px!important}
 .scintilla-console .sc-timeline{right:338px!important}
}
@media(max-width:1050px){
 .scintilla-console .sc-topbar{grid-template-columns:160px minmax(0,1fr) auto!important}
 .scintilla-console .sc-nav{display:none!important}
 .scintilla-console .sc-operator{gap:6px!important}
 .scintilla-console .sc-operator>div:last-child{display:none!important}
 .scintilla-console .sc-status{left:84px!important;right:330px!important;grid-template-columns:repeat(3,minmax(0,1fr))!important}
 .scintilla-console .sc-metric:nth-child(2){display:none!important}
 .scintilla-console .sc-endpoint.b{right:326px!important}
 .scintilla-console .sc-timeline{left:84px!important;right:326px!important;grid-template-columns:repeat(4,minmax(0,1fr)) 130px!important}
 .scintilla-console .sc-stage:nth-child(n+5){display:none!important}
}
@media(max-width:760px){
 .scintilla-console{position:fixed!important;overflow:hidden!important}
 .scintilla-console .sc-topbar{top:6px!important;left:6px!important;right:6px!important;height:56px!important;padding:0 10px!important;grid-template-columns:minmax(0,1fr) auto!important;border-radius:14px!important}
 .scintilla-console .sc-brand-sub,.scintilla-console .sc-nav,.scintilla-console .sc-search{display:none!important}
 .scintilla-console .sc-brand-title{font-size:16px!important}
 .scintilla-console .sc-intel{max-width:190px!important}
 .scintilla-console .sc-intel span{display:none!important}
 .scintilla-console .sc-rail{top:auto!important;bottom:86px!important;left:8px!important;right:8px!important;width:auto!important;height:54px!important;flex-direction:row!important;justify-content:space-around!important;gap:3px!important;padding:4px!important;border-radius:14px!important}
 .scintilla-console .sc-rail button{flex:1 0 0!important;min-width:0!important;height:42px!important;min-height:42px!important;gap:3px!important;font-size:7px!important}
 .scintilla-console .sc-rail button span{font-size:14px!important}
 .scintilla-console .sc-status{top:70px!important;left:8px!important;right:8px!important;width:auto!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;max-width:none!important;min-height:48px!important}
 .scintilla-console .sc-metric{padding:7px 8px!important}
 .scintilla-console .sc-metric:nth-child(2),.scintilla-console .sc-metric:nth-child(4){display:none!important}
 .scintilla-console .sc-metric-label{font-size:6px!important}
 .scintilla-console .sc-metric-value{font-size:9px!important}
 .scintilla-console .sc-scene-tools{top:128px!important;left:8px!important;right:8px!important;gap:4px!important}
 .scintilla-console .sc-tool{height:29px!important;padding:0 8px!important;font-size:8px!important}
 .scintilla-console .sc-endpoint{display:none!important}
 .scintilla-console .sc-timeline{left:8px!important;right:8px!important;bottom:148px!important;height:54px!important;padding:0 5px!important;grid-template-columns:repeat(4,minmax(0,1fr)) 110px!important;border-radius:13px!important}
 .scintilla-console .sc-stage{font-size:6px!important}
 .scintilla-console .sc-stage:nth-child(n+5){display:none!important}
 .scintilla-console .fp{left:8px!important;right:8px!important;top:140px!important;width:auto!important;max-width:none!important;max-height:calc(100dvh - 210px)!important}
 .scintilla-console .fp-body{max-height:calc(100dvh - 260px)!important}
}
@media(prefers-reduced-motion:reduce){
 .scintilla-console *{scroll-behavior:auto!important;transition:none!important;animation:none!important}
}
/* DARK INSTRUMENT THEME — dashboard panels, controls, and data surfaces */
.scintilla-console{background:#030914!important;color:#dce8f5!important}
.scintilla-console .sc-topbar,.scintilla-console .sc-rail,.scintilla-console .sc-status,
.scintilla-console .sc-tool,.scintilla-console .sc-endpoint,.scintilla-console .sc-timeline{
  background:rgba(8,17,31,.91)!important;border-color:#23364c!important;color:#dce8f5!important;
  box-shadow:0 14px 38px rgba(0,0,0,.34)!important
}
.scintilla-console .sc-mark{background:conic-gradient(from 35deg,#dcecff 0 72%,#54d6e8 73% 88%,#57748f 89% 100%)!important}
.scintilla-console .sc-mark:after{background:#07111f!important}
.scintilla-console .sc-brand-title,.scintilla-console .sc-intel b,
.scintilla-console .sc-metric-value,.scintilla-console .sc-endpoint-name{color:#e6f2ff!important}
.scintilla-console .sc-brand-sub,.scintilla-console .sc-intel span,
.scintilla-console .sc-metric-label,.scintilla-console .sc-endpoint-meta{color:#8da5bf!important}
.scintilla-console .sc-nav button,.scintilla-console .sc-nav a{color:#91a8c1!important}
.scintilla-console .sc-nav .active,.scintilla-console .sc-nav button:hover,
.scintilla-console .sc-nav a:hover{background:#14263b!important;color:#e6f4ff!important;box-shadow:inset 0 0 0 1px #2b4762!important}
.scintilla-console .sc-search,.scintilla-console .sc-intel{background:#0d1a2b!important;border-color:#263d55!important;color:#a9bfd3!important}
.scintilla-console .sc-search input{color:#e5f1ff!important}
.scintilla-console .sc-rail button{color:#8ba2b9!important}
.scintilla-console .sc-rail button:hover,.scintilla-console .sc-rail button.active,
.scintilla-console .sc-rail button.open{background:#12243a!important;border-color:#29445e!important;color:#70d8e8!important}
.scintilla-console .sc-metric{border-color:#263a50!important}
.scintilla-console .sc-stage:not(:last-of-type):after{background:#2b4056!important}
.scintilla-console .sc-stage{color:#829ab3!important}
.scintilla-console .sc-stage-dot{background:#14253a!important;border-color:#3b536d!important;color:#b5c8dc!important}
.scintilla-console .sc-stage.done .sc-stage-dot{background:#176b70!important;border-color:#258b91!important;color:#eaffff!important}
.scintilla-console .sc-stage.current{color:#e6f7ff!important}
.scintilla-console .sc-stage.current .sc-stage-dot{background:#2b9caa!important;border-color:#69dce5!important;color:#03131e!important;box-shadow:0 0 0 4px #37c8df25!important}
.scintilla-console .fp{background:rgba(7,16,29,.97)!important;border-color:#29415b!important;color:#dbe8f6!important;box-shadow:0 20px 58px rgba(0,0,0,.5)!important}
.scintilla-console .fp-head{background:linear-gradient(180deg,#101e31,#0a1525)!important;border-bottom-color:#263b52!important;color:#e5f2ff!important}
.scintilla-console .fp-head button{background:#1a2b40!important;color:#a9bfd3!important}
.scintilla-console .fp-head button:hover{background:#29425b!important;color:#fff!important}
.scintilla-console .fp-body{scrollbar-color:#344d68 transparent!important;color:#dbe8f6!important}
.scintilla-console .fp-tabs{display:flex!important;gap:5px!important;padding:8px 10px!important;background:#081322!important;border-bottom:1px solid #1d3148!important}
.scintilla-console .fp-tabs button{border:1px solid transparent!important;border-radius:8px!important;background:transparent!important;color:#91a8c1!important;padding:7px 9px!important;font-size:9px!important}
.scintilla-console .fp-tabs button.active{background:#142a41!important;border-color:#31516c!important;color:#8ee8f2!important}
.scintilla-console .sc-panel,.scintilla-console .sc-card{background:#0b1728!important;border-color:#253a52!important;color:#dce8f5!important;box-shadow:0 8px 26px rgba(0,0,0,.22)!important}
.scintilla-console .sc-panel-head,.scintilla-console .sc-card-head{background:#0d1b2d!important;border-bottom-color:#243950!important;color:#e0edfa!important}
.scintilla-console .sc-control-row,.scintilla-console .fp-note,.scintilla-console .sc-verified-row{color:#9bb0c6!important}
.scintilla-console .sc-control-row b,.scintilla-console .sc-verified-row b{color:#e2effc!important}
.scintilla-console .sc-mode button,.scintilla-console .sc-secondary,.scintilla-console .fp-sel,
.scintilla-console .fp-text,.scintilla-console input:not([type=range]),.scintilla-console select,.scintilla-console textarea{
  background:#0c1b2d!important;border:1px solid #2b425b!important;color:#dceafb!important
}
.scintilla-console .sc-mode button.active,.scintilla-console .sc-secondary:focus-visible,
.scintilla-console .fp-tabs button.active{background:#12334a!important;border-color:#2c7185!important;color:#9cecf5!important}
.scintilla-console .sc-primary{color:#f1fdff!important}
.scintilla-console .sc-dark{background:#20364d!important;color:#e5f2ff!important}
.scintilla-console .sc-dark.red{background:#743744!important;color:#ffe9ee!important}
.scintilla-console .sc-mini,.scintilla-console .sc-gauge,.scintilla-console .sc-analog{
  background:linear-gradient(145deg,#0d1d30,#091524)!important;border-color:#263c53!important;color:#dce8f5!important
}
.scintilla-console .sc-mini span,.scintilla-console .sc-analog .gauge>span{color:#8ba3bb!important}
.scintilla-console .sc-mini b,.scintilla-console .sc-gauge-value{color:#e4f0ff!important}
.scintilla-console .sc-bar{background:#21334a!important}
.scintilla-console .gauge{color:#d8e7f6!important}
.scintilla-console .gauge .ring{background:conic-gradient(var(--gauge) calc(var(--p)*1%),#203149 0)!important;box-shadow:inset 0 0 0 7px #0b1728,0 2px 8px rgba(0,0,0,.28)!important}
.scintilla-console .gauge .ring:after{background:#0b1728!important;border-color:#2a415a!important}
.scintilla-console .sc-ai{background:linear-gradient(135deg,#0d2337,#191a35)!important;border-color:#2a415b!important}
.scintilla-console .sc-ai p,.scintilla-console .sc-advisory{color:#9bb1c7!important}
.scintilla-console .sc-advisory{background:#0c1a2b!important;border-color:#293f57!important}
.scintilla-console .fp-tbl{color:#dce8f5!important;border-color:#263c53!important}
.scintilla-console .fp-tbl th{background:#112238!important;color:#a9bfd3!important}
.scintilla-console .fp-tbl td,.scintilla-console .fp-tbl th{border-color:#263b52!important}
.scintilla-console .fp-pre{background:#07111f!important;border:1px solid #263b52!important;color:#dceafb!important}
.scintilla-console .scintilla-console button:disabled{opacity:.45!important;cursor:not-allowed!important}
.scintilla-console .sc-panel a,.scintilla-console .fp-body a{color:#77d8ee!important}
.scintilla-console .sc-panel input[type=range],.scintilla-console .fp-body input[type=range]{accent-color:#39c5d8!important}
.scintilla-console .fp-body button:focus-visible,.scintilla-console .fp-head button:focus-visible{outline:2px solid #55d5e5!important;outline-offset:2px!important}
@media(max-width:760px){
 .scintilla-console .fp{background:rgba(7,16,29,.985)!important}
 .scintilla-console .fp-tabs{flex-wrap:wrap!important}
}

/* FINAL DASHBOARD FIX: compact terminal inspectors, visible camera feed, consistent dark surfaces */
.scintilla-console .fp{
  width:min(390px,calc(100vw - 104px))!important;max-width:calc(100vw - 24px)!important;
  max-height:calc(100dvh - 158px)!important;display:flex!important;flex-direction:column!important;
  background:#071525!important;border:1px solid #29445e!important;color:#dceafb!important;
}
.scintilla-console .fp-head{flex:0 0 42px!important;background:#0d2034!important;color:#e5f2ff!important;border-bottom:1px solid #294158!important}
.scintilla-console .fp-head b{color:#e5f2ff!important}
.scintilla-console .fp-body{
  min-height:0!important;max-height:calc(100dvh - 204px)!important;overflow:auto!important;
  background:#071525!important;color:#dceafb!important;scrollbar-color:#35516d #0a1828!important;
}
.scintilla-console .fp-body>div{min-width:0!important;background:transparent!important;color:#dceafb!important}
.scintilla-console .fp-id{margin:0!important;padding:10px 12px!important;background:#0b1c2e!important;border-bottom:1px solid #20374e!important;color:#dceafb!important}
.scintilla-console .fp-id b,.scintilla-console .fp-id span{color:#dceafb!important}
.scintilla-console .fp-tabs{position:sticky!important;top:0!important;z-index:4!important;display:flex!important;gap:5px!important;padding:8px!important;background:#081727!important;border-bottom:1px solid #223a52!important}
.scintilla-console .fp-tabs button{background:#0d1e31!important;border:1px solid #294158!important;color:#9fb5cb!important}
.scintilla-console .fp-tabs button.active{background:#12364a!important;border-color:#28798a!important;color:#a3f0f5!important}
.scintilla-console .sc-panel{display:block!important;min-height:0!important;height:auto!important;overflow:visible!important;margin:8px!important;background:#09192a!important;border:1px solid #263e56!important;color:#dceafb!important;box-shadow:none!important}
.scintilla-console .sc-panel-head,.scintilla-console .sc-card-head{background:#0d2034!important;color:#e4f1ff!important;border-bottom:1px solid #263d54!important}
.scintilla-console .sc-panel>div[style*="height: 172px"]{height:190px!important;margin:8px!important;background:radial-gradient(circle at 50% 50%,#12344c 0%,#08192b 54%,#030b15 100%)!important;border:1px solid #2b4b66!important}
.scintilla-console .sc-analog-grid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:8px!important;padding:8px!important;background:transparent!important}
.scintilla-console .sc-analog{min-width:0!important;background:#0d2235!important;border:1px solid #29465f!important;color:#dceafb!important;box-shadow:none!important}
.scintilla-console .sc-analog .gauge{color:#c5d8eb!important}
.scintilla-console .sc-analog .gauge>span{color:#8faac3!important}
.scintilla-console .sc-analog .ring{background:conic-gradient(var(--gauge) calc(var(--p)*1%),#1b3047 0)!important;box-shadow:inset 0 0 0 7px #0d2235!important}
.scintilla-console .sc-analog .ring:after{background:#0d2235!important;border-color:#29445d!important}
.scintilla-console .sc-analog .gauge-value{color:#e5f3ff!important}
.scintilla-console .sc-mini-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;padding:8px!important;background:transparent!important}
.scintilla-console .sc-mini{min-width:0!important;background:#0d2235!important;border:1px solid #29445d!important;color:#dceafb!important}
.scintilla-console .sc-mini span{color:#91aac2!important}
.scintilla-console .sc-mini b{color:#e5f2ff!important}
.scintilla-console .sc-panel button,.scintilla-console .fp-body button{color:#c5d8eb}
.scintilla-console .sc-panel .sc-secondary{background:#0d2235!important;border:1px solid #2b465f!important;color:#a9c1d7!important}
.scintilla-console .sc-panel .sc-secondary[style],.scintilla-console .sc-panel .sc-secondary:focus-visible{background:#12364a!important;color:#a5eff5!important}
.scintilla-console .sc-control-row,.scintilla-console .sc-panel label{color:#a6bdd3!important}
.scintilla-console .sc-control-row b{color:#e5f2ff!important}
.scintilla-console .sc-panel input:not([type=range]),.scintilla-console .sc-panel select,.scintilla-console .sc-panel textarea,
.scintilla-console .fp-body input:not([type=range]),.scintilla-console .fp-body select,.scintilla-console .fp-body textarea{
  background:#081727!important;border-color:#2b455e!important;color:#e3f0ff!important;
}
.scintilla-console .sc-panel input[type=range]{accent-color:#49d4e5!important}
.scintilla-console .fp-tbl th{background:#10263c!important;color:#aac3da!important}
.scintilla-console .fp-tbl td,.scintilla-console .fp-tbl th{border-color:#253e57!important;color:#d5e5f4!important}
.scintilla-console .sc-card,.scintilla-console .sc-gauge,.scintilla-console .sc-analog,
.scintilla-console .sc-mini,.scintilla-console .sc-advisory,.scintilla-console .sc-ai{
  background:#0b1c2e!important;border-color:#294158!important;color:#dceafb!important;box-shadow:none!important;
}
.scintilla-console .sc-gauge-value,.scintilla-console .sc-mini b{color:#e5f2ff!important}
.scintilla-console .sc-bar{background:#20364c!important}
@media(max-width:760px){
 .scintilla-console .fp{left:8px!important;right:8px!important;top:136px!important;width:auto!important;max-width:none!important;max-height:calc(100dvh - 210px)!important}
 .scintilla-console .fp-body{max-height:calc(100dvh - 258px)!important}
 .scintilla-console .sc-panel>div[style*="height: 172px"]{height:170px!important}
}


/* Explicitly reserve space for the simulated sensor viewport and force dark gauges. */
.scintilla-console .fp-body{display:block!important;min-height:0!important;overflow-y:auto!important;overflow-x:hidden!important}
.scintilla-console .fp-body>div{display:block!important;min-height:0!important}
.scintilla-console .sc-camera-panel{display:block!important;position:relative!important;width:calc(100% - 16px)!important;min-height:0!important;height:auto!important;overflow:visible!important;background:#09192a!important;color:#dceafb!important;border:1px solid #29445d!important}
.scintilla-console .sc-camera-panel{display:block!important;position:relative!important;flex:none!important;width:100%!important;min-width:0!important;height:auto!important;min-height:0!important;overflow:visible!important;background:#09192a!important;border:1px solid #29445d!important;color:#dceafb!important}
.scintilla-console .sc-camera-panel>.sc-panel-head{display:flex!important;align-items:center!important;justify-content:space-between!important;min-height:36px!important;padding:10px 12px!important;background:#0c2033!important;color:#e5f2ff!important;border-bottom:1px solid #29445d!important}
.scintilla-console .sc-camera-viewport{display:block!important;position:relative!important;flex:none!important;width:calc(100% - 20px)!important;height:190px!important;min-width:0!important;min-height:190px!important;max-height:none!important;margin:10px!important;box-sizing:border-box!important;visibility:visible!important;opacity:1!important;overflow:hidden!important;isolation:isolate!important;background:radial-gradient(circle at 50% 50%,#163047 0%,#07131f 44%,#02070d 100%)!important;border:1px solid #2b4b66!important;border-radius:10px!important}
.scintilla-console .sc-camera-viewport>div{visibility:visible!important;opacity:1}
.scintilla-console .sc-camera-panel .sc-analog-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;padding:8px!important;background:transparent!important}
.scintilla-console .sc-camera-panel .sc-analog-grid>.sc-analog{display:grid!important;place-items:center!important;min-width:0!important;min-height:116px!important;padding:9px 6px 7px!important;background:#0d2235!important;background-image:none!important;border:1px solid #29465f!important;border-radius:11px!important;color:#dceafb!important;box-shadow:none!important}
.scintilla-console .sc-camera-panel .sc-analog .gauge .ring{background:conic-gradient(var(--gauge) calc(var(--p)*1%),#1b3047 0)!important;box-shadow:inset 0 0 0 7px #0d2235,0 2px 8px rgba(0,0,0,.28)!important}
.scintilla-console .sc-camera-panel .sc-analog .gauge .ring:after{background:#0d2235!important;border:1px solid #29445d!important}
.scintilla-console .sc-camera-panel .sc-analog .gauge>span{color:#8faac3!important}
.scintilla-console .sc-analog-grid>.sc-analog{background:#0d2235!important;border:1px solid #29465f!important;color:#dceafb!important}
.scintilla-console .sc-analog .ring:after{background:#0d2235!important;border:1px solid #29445d!important}
.scintilla-console .sc-analog .ring{box-shadow:inset 0 0 0 7px #0d2235!important}

/* Terminal camera viewport + health cards: explicit dark theme and stable sizing. */
.scintilla-console .fp-body .sc-panel{display:block!important;position:relative!important;min-width:0!important;height:auto!important;min-height:0!important;overflow:visible!important;background:#09192a!important;border:1px solid #29445d!important;border-radius:12px!important;color:#dceafb!important;box-shadow:none!important}
.scintilla-console .fp-body .sc-panel-head{display:flex!important;align-items:center!important;min-height:34px!important;background:#0c2033!important;color:#e5f2ff!important;border-bottom:1px solid #29445d!important}
.scintilla-console .fp-body .sc-panel>div[style*="height: 172px"]{display:block!important;position:relative!important;width:calc(100% - 16px)!important;height:190px!important;min-height:190px!important;max-height:190px!important;margin:8px!important;box-sizing:border-box!important;overflow:hidden!important;visibility:visible!important;opacity:1!important;background-color:#06111e!important;background-image:linear-gradient(rgba(120,185,220,.24) 1px,transparent 1px),linear-gradient(90deg,rgba(120,185,220,.24) 1px,transparent 1px)!important;background-size:24px 24px!important;border:1px solid #2b4b66!important;border-radius:10px!important}
.scintilla-console .fp-body .sc-analog-grid{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:8px!important;padding:8px!important;background:transparent!important}
.scintilla-console .fp-body .sc-analog-grid>.sc-analog{display:grid!important;place-items:center!important;min-width:0!important;min-height:116px!important;padding:9px 6px 7px!important;background:#0d2235!important;background-image:none!important;border:1px solid #29465f!important;border-radius:11px!important;color:#dceafb!important;box-shadow:none!important}
.scintilla-console .fp-body .sc-analog .gauge{color:#dceafb!important}
.scintilla-console .fp-body .sc-analog .gauge .ring{background:conic-gradient(var(--gauge) calc(var(--p)*1%),#1b3047 0)!important;box-shadow:inset 0 0 0 7px #0d2235,0 2px 8px rgba(0,0,0,.28)!important}
.scintilla-console .fp-body .sc-analog .gauge .ring:after{background:#0d2235!important;border:1px solid #29445d!important}
.scintilla-console .fp-body .sc-analog .gauge>span{color:#8faac3!important}
.scintilla-console .fp-body .sc-mini-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:6px!important;padding:8px!important;background:transparent!important}
.scintilla-console .fp-body .sc-mini-grid>.sc-mini{min-width:0!important;background:#0d2235!important;border:1px solid #29445d!important;color:#dceafb!important}
.scintilla-console .fp-body .sc-mini span{color:#8ba3bb!important}
.scintilla-console .fp-body .sc-mini b{color:#e5f2ff!important}
`/* FINAL MISSION DASHBOARD SKIN — consistent dark optical-lab surfaces */
.scintilla-console{background:#020817!important;color:#dceaf6!important}
.scintilla-console .sc-topbar,.scintilla-console .sc-rail,.scintilla-console .sc-status,
.scintilla-console .sc-endpoint,.scintilla-console .sc-panel,.scintilla-console .sc-card,
.scintilla-console .sc-right-inner>.fp-panel,.scintilla-console .fp-panel{
  background:rgba(7,22,36,.96)!important;color:#dceaf6!important;
  border-color:#1d4056!important;box-shadow:0 12px 30px rgba(0,0,0,.22)!important;
}
.scintilla-console .sc-topbar{background:rgba(6,22,37,.96)!important;border-color:#21445b!important}
.scintilla-console .sc-brand-title,.scintilla-console .sc-endpoint-name,
.scintilla-console .sc-metric-value,.scintilla-console .sc-panel-head,
.scintilla-console .sc-card-head,.scintilla-console .sc-mini b,
.scintilla-console .sc-verified-row b{color:#dceaf6!important}
.scintilla-console .sc-brand-sub,.scintilla-console .sc-metric-label,
.scintilla-console .sc-endpoint-meta,.scintilla-console .sc-mini span{color:#8daabd!important}
.scintilla-console .sc-nav button,.scintilla-console .sc-nav a,
.scintilla-console .sc-rail button{color:#91aabd!important}
.scintilla-console .sc-nav .active,.scintilla-console .sc-rail button.active,
.scintilla-console .sc-rail button.open{background:#123448!important;color:#8de5ed!important;border-color:#286078!important;box-shadow:none!important}
.scintilla-console .sc-search{background:#07192a!important;border-color:#21465e!important;color:#a7bfce!important}
.scintilla-console .sc-search input{color:#e0edf6!important}
.scintilla-console .sc-tool,.scintilla-console .sc-secondary,
.scintilla-console .sc-mode button{background:#0b2032!important;color:#a9c1d1!important;border-color:#25485f!important}
.scintilla-console .sc-mode button.active{background:#103c50!important;color:#8de5ed!important;border-color:#2c8294!important}
.scintilla-console .sc-mini,.scintilla-console .sc-gauge,.scintilla-console .sc-analog,
.scintilla-console .sc-verified-row,.scintilla-console .sc-advisory{
  background:#0b2235!important;border-color:#21465c!important;color:#c8dbe8!important;
}
.scintilla-console .sc-analog .gauge .ring{box-shadow:inset 0 0 0 7px #0b2235,0 2px 10px #0008!important}
.scintilla-console .sc-analog .gauge .ring:after{background:#071727!important;border-color:#24465b!important}
.scintilla-console .sc-analog .gauge,.scintilla-console .sc-analog .gauge>span{color:#8eafc3!important}
.scintilla-console .sc-ai{background:linear-gradient(135deg,#0b263a,#171b38)!important;border-color:#25485f!important}
.scintilla-console .sc-ai p{color:#9cb5c7!important}
.scintilla-console .sc-verified-row,.scintilla-console .fp-note{color:#9cb5c7!important}
.scintilla-console .sc-lower>.sc-panel:nth-child(2)>.sc-panel-head{background:#071a2b!important}
.scintilla-console .sc-lower>.sc-panel:nth-child(2){scrollbar-color:#31556a transparent}
.scintilla-console .sc-lower>.sc-panel:nth-child(2)::-webkit-scrollbar-thumb{background:#31556a}
.scintilla-console .sc-intel{background:#0d2b35!important;border-color:#2c625e!important}
.scintilla-console .sc-intel b{color:#d8f0ed!important}
.scintilla-console .sc-intel span{color:#91b9c4!important}
`}
        </style>
        <section className="sc-space"><MissionSpace simulation={sim} ground={ground} view={view} onSelect={selectFromScene} /></section>
        <header className="sc-topbar">
            <div className="sc-brand"><span className="sc-mark" /><div><div className="sc-brand-title">orbi</div><div className="sc-brand-sub">VIRTUAL FSOC LABORATORY</div></div></div>
            <nav className="sc-nav"><button className="active">Mission</button><Link href="/demo">Live Pipeline</Link><Link href="/envelope">Acquisition Envelope</Link></nav>
            <div className="sc-search"><span>⌕</span><input ref={qRef} value={q} placeholder="Search spacecraft, panels, actions, activity…  Ctrl+K" onChange={e => { setQ(e.target.value); setQOpen(true); }} onFocus={() => setQOpen(true)} onBlur={() => window.setTimeout(() => setQOpen(false), 150)} onKeyDown={e => { if (e.key === "Enter" && hits[0]) runHit(hits[0][2]); if (e.key === "Escape") { setQ(""); qRef.current?.blur(); } }} />{qOpen && hits.length > 0 && <div className="sc-hits">{hits.map(([l, k, fn], i) => <button key={l + i} onMouseDown={e => e.preventDefault()} onClick={() => runHit(fn)}>{l}<span>{k.split(" ")[0]}</span></button>)}</div>}</div>
            <div className="sc-operator"><div className={`sc-intel ${sim.intelligence ? "on" : ""}`}><button onClick={() => updateIntelligence(!sim.intelligence)} role="switch" aria-checked={sim.intelligence} style={{ width: 40, height: 23, border: 0, borderRadius: 99, padding: 3, background: sim.intelligence ? "#8060df" : "#ccd6dc", cursor: "pointer" }}><i style={{ display: "block", width: 17, height: 17, borderRadius: "50%", background: "#fff", transform: sim.intelligence ? "translateX(17px)" : "none", transition: "transform .18s" }} /></button><div onClick={() => openPanel("intel")}><b>SCINTILLA Intelligence</b><span>{sim.intelligence ? "Predictive PAT/ATP" : "Conventional PAT/ATP"} · compare ›</span></div></div><div style={{ fontSize: 9, color: "#7c8994" }} suppressHydrationWarning>{formatUtcClock()} UTC</div></div>
        </header>
        <aside className="sc-rail">{dock.map(([icon, label, ids]) => <button key={label} className={ids.some(i => panels[i]) ? "open" : ""} onClick={() => toggleGroup(ids)} title={`Toggle ${label} panels`}><span>{icon}</span>{label}</button>)}</aside>
        <div className="sc-status">
            <div className="sc-metric"><div className="sc-metric-label">Link state</div><div className="sc-metric-value" style={{ color: connected ? "#079b76" : "#26343e" }}>{statusLabel.toUpperCase()}</div></div>
            <div className="sc-metric"><div className="sc-metric-label">Uptime</div><div className="sc-metric-value">{connected ? formatDuration(sim.uptime) : "—"}</div></div>
            <div className="sc-metric"><div className="sc-metric-label">Data rate</div><div className="sc-metric-value">{connected ? `${sim.dataRate.toFixed(1)} Gbps` : "—"}</div></div>
            <div className="sc-metric"><div className="sc-metric-label">Latency</div><div className="sc-metric-value">{connected ? `${sim.latency.toFixed(1)} ms` : "—"}</div></div>
            <div className="sc-metric"><div className="sc-metric-label">System health</div><div className="sc-metric-value" style={{ color: health >= 80 ? "#0aa77d" : "#c17b22" }}>{health}%</div></div>
        </div>
        <div className="sc-scene-tools">
            <button className="sc-tool" onClick={() => setView("mission")}>⌂ Mission</button>
            <button className="sc-tool" onClick={() => setView("terminal-a")}>SC-1</button>
            <button className="sc-tool" onClick={() => setView("terminal-b")}>SC-2</button>
            {Object.keys(panels).length > 0 && <button className="sc-tool" onClick={() => Object.keys(panels).forEach(closePanel)}>✕ Panels</button>}
        </div>
        <div className="sc-endpoint a" onClick={() => openPanel(ground ? "gs" : "a")}><div className="sc-endpoint-name">{ground ? "GS-1 · TRANSMITTER" : "SC-1 · TRANSMITTER"}</div><div className="sc-endpoint-meta">{ground ? "Bengaluru · Ground terminal" : "LEO · 500 km"}</div><div className="sc-endpoint-state" style={{ color: connected ? "#079b76" : "#7b8993" }}>● {connected ? "ONLINE" : "READY"}</div></div>
        <div className="sc-endpoint b" onClick={() => openPanel("b")}><div className="sc-endpoint-name">SC-2 · RECEIVER</div><div className="sc-endpoint-meta">LEO · 520 km</div><div className="sc-endpoint-state" style={{ color: connected ? "#079b76" : "#7b8993" }}>● {connected ? "ONLINE" : "READY"}</div></div>
        <div className="sc-timeline">
            {stages.map((stage, index) => <div key={stage} className={`sc-stage ${index < stageIndex ? "done" : ""} ${index === stageIndex ? "current" : ""}`}><span className="sc-stage-dot">{index < stageIndex ? "✓" : index === stageIndex ? "●" : ""}</span><span>{stage}</span></div>)}
            <button className={`sc-action ${connected ? "danger" : ""}`} onClick={connected ? handleDisconnect : handleEstablish} disabled={demoRunning}>{connected ? "DISCONNECT" : learned ? "RECONNECT LINK" : "ESTABLISH LINK"}</button>
        </div>
        {Object.entries(panels).map(([id, st]) => <FloatingPanel key={id} id={id} state={st} onMove={movePanel} onFocus={focusPanel} onClose={closePanel} onMin={minPanel}>{body(id)}</FloatingPanel>)}
    </div>);

    function PanelTitle({ title, status, }: {
        title: string;
        status?: string;
    }) {
        return (<div className="panel-head" style={{
                ...ui.panelHead,
                padding: "11px 12px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: 11,
                fontWeight: 700,
            }}>

      <span>{title}</span>

      {status && (<span style={{
                    color: status === "LIVE" || status === "VERIFIED"
                        ? "#079b76"
                        : "#1679d1",
                    fontSize: 8,
                    letterSpacing: ".1em",
                }}>

          ● {status}

        </span>)}

    </div>);
    }
    function Metric({ label, value, good, }: {
        label: string;
        value: string;
        good?: boolean;
    }) {
        return (<div className={`status-piece ${good ? "good" : ""}`} style={{
                padding: "9px 14px",
                borderRight: "1px solid #e6ecef",
                minWidth: 0,
            }}>

      <span style={{
                display: "block",
                fontSize: 8,
                color: "#7a8792",
                letterSpacing: ".04em",
            }}>

        {label}

      </span>

      <strong style={{
                display: "block",
                marginTop: 3,
                color: good ? "#079c76" : "#27343e",
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: "nowrap",
            }}>

        {value}

      </strong>

    </div>);
    }
    function Endpoint({ cls, name, meta, live, accent, }: {
        cls: string;
        name: string;
        meta: string;
        live: boolean;
        accent: string;
    }) {
        return (<div className={`endpoint ${cls}`} style={{
                background: "rgba(255,255,255,.95)",
                border: "1px solid #d5e0e7",
                borderLeft: `3px solid ${accent}`,
                boxShadow: "0 10px 26px rgba(5,18,30,.16)",
                backdropFilter: "blur(16px)",
                minWidth: 155,
            }}>

      <strong style={{ fontSize: 10 }}>{name}</strong>

      <span style={{
                display: "block",
                color: "#71808c",
                fontSize: 9,
                marginTop: 3,
            }}>

        {meta}

      </span>

      <span className="online" style={{
                color: live ? "#0a9e78" : "#7a8792",
                fontSize: 9,
                letterSpacing: ".08em",
                fontWeight: 700,
            }}>

        ● {live ? " ONLINE" : " READY"}

      </span>

    </div>);
    }
    function Gauge({ p, color, value, label, }: {
        p: number;
        color: string;
        value: string;
        label: string;
    }) {
        return (<div className="gauge" style={{ color: "#5e6670" }}>

      <div className="ring" style={{
                "--p": clamp(p, 0, 100),
                "--gauge": color,
            } as React.CSSProperties}>

        {value}

      </div>

      <span style={{ fontSize: 8, lineHeight: 1.25 }}>{label}</span>

    </div>);
    }
    function TelemetryCell({ label, value, }: {
        label: string;
        value: string;
    }) {
        return (<div style={{
                padding: "7px 8px",
                background: "#f7fafc",
                border: "1px solid #e6edf1",
                borderRadius: 8,
            }}>

      <span style={{
                display: "block",
                fontSize: 8,
                color: "#7c8993",
            }}>

        {label}

      </span>

      <b style={{
                display: "block",
                marginTop: 3,
                fontSize: 10,
                color: "#27343e",
            }}>

        {value}

      </b>

    </div>);
    }
    function MiniStat({ label, value, }: {
        label: string;
        value: string;
    }) {
        return (<div>

      <div style={{ color: "#81909b", fontSize: 8 }}>{label}</div>

      <b style={{ display: "block", marginTop: 2, fontSize: 10 }}>

        {value}

      </b>

    </div>);
    }
    function Slider({ label, value, min, max, step = 1, valueN, set, }: {
        label: string;
        value: string;
        min: number;
        max: number;
        step?: number;
        valueN: number;
        set: (v: number) => void;
    }) {
        return (<div className="parameter">

      <label>

        {label}

        <b>{value}</b>

      </label>

      <input type="range" min={min} max={max} step={step} value={valueN} onChange={(e) => set(+e.target.value)}/>

    </div>);
    }
    function CameraPanel({ title, eventView, setEventView, simulation, accent, }: {
        title: string;
        eventView: boolean;
        setEventView: (v: boolean) => void;
        simulation: MissionSnapshot;
        accent: string;
    }) {
        const x = clamp(50 + simulation.cameraOffset[1] * 34, 8, 92);
        const y = clamp(48 + simulation.cameraOffset[0] * 34, 10, 90);
        const locked = simulation.phase === "CONNECTED";
        const searching = simulation.phase === "SEARCH" || simulation.phase === "ACQUIRE";
        const snr = simulation.beaconVisible
            ? Math.max(2.5, simulation.quality / 4.1)
            : 0;
        return (<section className="sc-panel sc-camera-panel" style={{ display: "block", minHeight: 0, height: "auto", overflow: "visible", background: "#09192a", borderColor: "#29445d", color: "#dceafb" }}>

      <div className="sc-panel-head">

        <span>{title}</span>

        <span style={{ color: accent, fontSize: 8, letterSpacing: ".1em" }}>

          ● {locked ? "LOCKED" : searching ? "ACQUIRING" : "SIMULATED"}

        </span>

      </div>

      <div className="sc-camera-viewport" style={{
                display: "block",
                position: "relative",
                flex: "0 0 190px",
                width: "calc(100% - 20px)",
                minWidth: 0,
                boxSizing: "border-box",
                margin: 10,
                height: 190,
                minHeight: 190,
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${locked ? `${accent}66` : "#263847"}`,
                background: "radial-gradient(circle at 50% 50%,#163047 0%,#07131f 44%,#02070d 100%)",
                boxShadow: `inset 0 0 36px rgba(0,0,0,.55), 0 0 0 1px ${locked ? `${accent}18` : "transparent"}`,
            }}>

        <div style={{
                position: "absolute",
                inset: 0,
                opacity: 0.13,
                backgroundImage: "linear-gradient(rgba(120,185,220,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(120,185,220,.35) 1px,transparent 1px)",
                backgroundSize: "24px 24px",
            }}/>

        {/* scanning sweep */}

        {searching && (<div style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: 0,
                    width: 1,
                    height: "100%",
                    background: `linear-gradient(180deg,transparent,${accent},transparent)`,
                    opacity: 0.7,
                    boxShadow: `0 0 16px ${accent}`,
                }}/>)}

        {/* acquisition reticle */}

        <div style={{
                position: "absolute",
                left: `${x}%`,
                top: `${y}%`,
                width: locked ? 42 : 54,
                height: locked ? 42 : 54,
                transform: "translate(-50%,-50%)",
                border: `1px solid ${accent}`,
                borderRadius: "50%",
                opacity: simulation.beaconVisible ? Math.max(.35, simulation.quality / 100) : .16,
                boxShadow: locked ? `0 0 22px ${accent}55` : "none",
            }}>

          <span style={{ position: "absolute", left: "50%", top: -7, width: 1, height: 14, background: accent, transform: "translateX(-50%)" }}/>

          <span style={{ position: "absolute", left: "50%", bottom: -7, width: 1, height: 14, background: accent, transform: "translateX(-50%)" }}/>

          <span style={{ position: "absolute", top: "50%", left: -7, width: 14, height: 1, background: accent, transform: "translateY(-50%)" }}/>

          <span style={{ position: "absolute", top: "50%", right: -7, width: 14, height: 1, background: accent, transform: "translateY(-50%)" }}/>

        </div>

        {simulation.beaconVisible && (<div style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%,-50%)",
                    width: locked ? 8 : 5,
                    height: locked ? 8 : 5,
                    borderRadius: "50%",
                    background: accent,
                    boxShadow: `0 0 ${locked ? 22 : 12}px ${accent}`,
                }}/>)}

        {eventView && simulation.beaconVisible && (<div style={{
                    position: "absolute",
                    left: `${x}%`,
                    top: `${y}%`,
                    transform: "translate(-50%,-50%)",
                    color: accent,
                    fontFamily: "monospace",
                    fontSize: 8,
                    lineHeight: 1.35,
                    opacity: .7,
                }}>

            + − +<br />− + −<br />+ + −

          </div>)}

        <div style={{ position: "absolute", left: 9, top: 8, color: "#7893a4", fontFamily: "monospace", fontSize: 7, lineHeight: 1.6 }}>

          <b style={{ color: "#aac0ce" }}>{eventView ? "EVENT SENSOR" : "FRAME SENSOR"}</b><br />

          MODE {eventView ? "ASYNC" : "OPTICAL"}<br />

          RES 128×128

        </div>

        <div style={{ position: "absolute", right: 9, top: 8, textAlign: "right", color: "#7893a4", fontFamily: "monospace", fontSize: 7, lineHeight: 1.6 }}>

          EXP {eventView ? "0.8 ms" : "4.0 ms"}<br />

          SNR {snr.toFixed(1)} dB<br />

          {locked ? "BEACON LOCK" : simulation.beaconVisible ? "CANDIDATE" : "SEARCHING"}

        </div>

        <div style={{ position: "absolute", left: 9, right: 9, bottom: 8, display: "flex", justifyContent: "space-between", fontFamily: "monospace", fontSize: 7, color: "#718b9b" }}>

          <span>AZ {((simulation.cameraOffset[1] || 0) * 100).toFixed(1)} mrad</span>

          <span style={{ color: locked ? accent : "#7b8c97" }}>{locked ? "TRACKING" : "SCANNING"}</span>

        </div>

      </div>

      <div style={{ display: "flex", gap: 6, padding: "0 10px 10px" }}>

        <button className={`sc-secondary ${eventView ? "" : ""}`} style={eventView ? { background: "#12364a", borderColor: `${accent}88`, color: "#a3f0f5" } : { background: "#0b1c2e", borderColor: "#294158", color: "#b7cce0" }} onClick={() => setEventView(true)}>Event View</button>

        <button className="sc-secondary" style={!eventView ? { background: "#12364a", borderColor: `${accent}88`, color: "#a3f0f5" } : { background: "#0b1c2e", borderColor: "#294158", color: "#b7cce0" }} onClick={() => setEventView(false)}>Frame View</button>

      </div>

    </section>);
    }
    function ActivityItem({ item }: {
        item: LogItem;
    }) {
        const color = {
            blue: "#2587dc",
            green: "#0aaa7e",
            amber: "#d18a31",
            red: "#df5966",
            gray: "#8a98a2",
        }[item.tone];
        return (<div style={{
                display: "grid",
                gridTemplateColumns: "8px 42px 1fr",
                gap: 8,
                padding: "7px 0",
                borderBottom: "1px solid #eef2f4",
            }}>

      <span style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: color,
                marginTop: 4,
                boxShadow: `0 0 0 3px ${color}14`,
            }}/>

      <span style={{ fontSize: 8, color: "#8a98a2" }}>

        {item.time}

      </span>

      <div>

        <b style={{ display: "block", fontSize: 9 }}>{item.title}</b>

        <span style={{
                display: "block",
                marginTop: 2,
                color: "#81909b",
                fontSize: 8,
                lineHeight: 1.35,
            }}>

          {item.detail}

        </span>

      </div>

    </div>);
    }
    function Trace({
  color,
  intensity,
  tick,
}: {
  color: string;
  intensity: number;
  tick: number;
}) {
  const [clientTick, setClientTick] = useState(0);

  useEffect(() => {
    setClientTick(tick);
  }, [tick]);

  const points = Array.from({ length: 52 }, (_, i) => {
    const y =
      15 +
      Math.sin(i * 0.72 + clientTick * 0.32) * intensity * 6 +
      Math.sin(i * 2.1) * intensity * 3;

    return `${i * 6},${y}`;
  }).join(" ");

  return (
    <svg
      viewBox="0 0 306 30"
      preserveAspectRatio="none"
      style={{ width: "100%", height: 28, display: "block" }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.35"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity=".82"
      />
    </svg>
  );
}
    const primaryButton: React.CSSProperties = {
        border: "1px solid #176fc8",
        borderRadius: 9,
        padding: "8px 11px",
        background: "linear-gradient(135deg,#176fc8,#20aeda)",
        color: "#fff",
        fontSize: 9,
        fontWeight: 750,
        letterSpacing: ".03em",
        cursor: "pointer",
        boxShadow: "0 5px 14px rgba(32,154,213,.22)",
    };
    const primaryButtonFull: React.CSSProperties = {
        ...primaryButton,
        width: "calc(100% - 24px)",
        margin: "0 12px 12px",
    };
    const dangerButton: React.CSSProperties = {
        ...primaryButton,
        background: "linear-gradient(135deg,#b84b5a,#e07468)",
        borderColor: "#b84b5a",
    };
    const secondaryButton: React.CSSProperties = {
        border: "1px solid #d8e1e7",
        borderRadius: 9,
        padding: "8px 10px",
        background: "#fff",
        color: "#4c5a65",
        fontSize: 9,
        fontWeight: 700,
        cursor: "pointer",
        boxShadow: "0 3px 9px rgba(18,32,45,.05)",
    };
    const glassButton: React.CSSProperties = {
        ...secondaryButton,
        background: "rgba(255,255,255,.92)",
        backdropFilter: "blur(14px)",
    };
    const floatingControl: React.CSSProperties = {
        position: "absolute",
        zIndex: 8,
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 9px",
        borderRadius: 9,
        background: "rgba(255,255,255,.94)",
        border: "1px solid #d9e2e8",
        boxShadow: "0 8px 20px rgba(8,20,32,.12)",
        backdropFilter: "blur(14px)",
        fontSize: 9,
    };
    const livePill: React.CSSProperties = {
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 8px",
        borderRadius: 99,
        fontSize: 8,
        fontWeight: 750,
        letterSpacing: ".06em",
    };
    const orbStyle: React.CSSProperties = {
        flex: "0 0 auto",
        width: 25,
        height: 25,
        borderRadius: "50%",
        background: "radial-gradient(circle at 32% 28%,#fff 0%,#b9e8f3 20%,#3c9fca 48%,#5368bf 78%,#202b45 100%)",
        boxShadow: "0 0 0 5px rgba(32,183,223,.08), 0 4px 14px rgba(40,127,218,.20)",
    };
    function nowTime() {
        return new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
        });
    }
    function formatUtcClock() {
        return new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: false,
            timeZone: "UTC",
        });
    }
    function formatDuration(seconds: number) {
        const s = Math.max(0, Math.floor(seconds));
        return `${String(Math.floor(s / 3600)).padStart(2, "0")}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    }
}
