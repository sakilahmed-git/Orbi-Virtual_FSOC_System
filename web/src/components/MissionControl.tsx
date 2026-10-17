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
    useEffect(() => { openPanel("tel"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
        <div className="sc-analog-grid"><div className="sc-analog"><Gauge label="System health" value={`${health}%`} p={health} color="#08b98a" /></div><div className="sc-analog"><Gauge label="Link quality" value={connected ? `${sim.quality.toFixed(0)}%` : "—"} p={connected ? sim.quality : 0} color="#19bfe8" /></div></div>
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
        return (<section className="sc-panel">

      <div className="sc-panel-head">

        <span>{title}</span>

        <span style={{ color: accent, fontSize: 8, letterSpacing: ".1em" }}>

          ● {locked ? "LOCKED" : searching ? "ACQUIRING" : "SIMULATED"}

        </span>

      </div>

      <div style={{
                margin: 10,
                height: 172,
                borderRadius: 10,
                overflow: "hidden",
                border: `1px solid ${locked ? `${accent}66` : "#263847"}`,
                background: "radial-gradient(circle at 50% 50%,#163047 0%,#07131f 44%,#02070d 100%)",
                position: "relative",
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

        <button className={`sc-secondary ${eventView ? "" : ""}`} style={eventView ? { background: "#eef8fc", borderColor: `${accent}66`, color: "#1479b0" } : undefined} onClick={() => setEventView(true)}>Event View</button>

        <button className="sc-secondary" style={!eventView ? { background: "#eef8fc", borderColor: `${accent}66`, color: "#1479b0" } : undefined} onClick={() => setEventView(false)}>Frame View</button>

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
