"use client";

import { useEffect, useState } from "react";
import useLoadingStore, { PHASES } from "./loadingStore";

/*
 * `?debug` (also in production): per-phase loading timings as a small overlay,
 * readable on a phone without remote devtools. Tap it to copy the report.
 *
 *   marks      ms since navigation start (performance.now) per milestone
 *   phases     how long each loader phase took (its share of the bar in brackets)
 *   resources  the big downloads (JS chunks, GLB, KTX2, basis), start → end
 */

const MARKS = [
  ["hydrated", "loader hydrated"],
  ["sceneChunk", "3D chunk evaluated"],
  ["renderer", "renderer.init done"],
  ["assets", "phase assets"],
  ["compile", "phase compile"],
  ["compiled", "compileAsync done"],
  ["calibrate", "phase calibrate"],
  ["recompile", "recompile (tier swap)"],
  ["recompiled", "recompile done"],
  ["settle", "phase settle"],
  ["ready", "ready"],
  ["reveal", "reveal"],
];

const BIG = 100e3;
const TRACKED = /\/(models|basis)\/|\/_next\/static\/chunks\//;

const shortName = (url) => url.split("?")[0].split("/").pop();

function phaseRows(t) {
  const rows = [];
  // Boot starts at navigation (store creation is after the JS bundle runs).
  for (const p of PHASES) {
    const start = p.id === "boot" ? 0 : t[p.id];
    if (start == null) continue;
    const i = PHASES.indexOf(p);
    const nextId = PHASES[i + 1]?.id;
    const end = (nextId && t[nextId]) ?? t.ready;
    const from = i > 0 ? PHASES[i - 1].to : 0;
    rows.push({
      id: p.id,
      share: `${Math.round(from * 100)}–${Math.round(p.to * 100)}%`,
      ms: end != null ? end - start : null,
      running: end == null,
      elapsed: Math.round(performance.now()) - start,
    });
  }
  return rows;
}

function resourceRows() {
  return performance
    .getEntriesByType("resource")
    .filter((e) => TRACKED.test(e.name) && (e.encodedBodySize || e.transferSize) > BIG)
    .map((e) => ({
      name: shortName(e.name),
      start: Math.round(e.startTime),
      end: Math.round(e.responseEnd),
      kb: Math.round((e.encodedBodySize || e.transferSize) / 1024),
    }))
    .sort((a, b) => a.start - b.start);
}

function report(s, q) {
  const t = s.timings;
  const lines = [];
  const nav = performance.getEntriesByType("navigation")[0];
  lines.push(navigator.userAgent);
  lines.push(
    `backend ${window.__renderer?.backend?.isWebGPUBackend ? "WebGPU" : window.__renderer ? "WebGL2" : "?"}` +
      ` · dpr ${window.devicePixelRatio} · ${window.innerWidth}×${window.innerHeight}`
  );
  if (nav)
    lines.push(
      `ttfb ${Math.round(nav.responseStart)} · dcl ${Math.round(nav.domContentLoadedEventEnd)} · load ${Math.round(nav.loadEventEnd) || "…"}`
    );
  if (q?.calibration) {
    const c = q.calibration;
    lines.push(`calibration ${c.ms} ms @ dpr ${c.dpr} · ${c.from} → ${q.tier} (budget ${c.budget})`);
  } else if (q) lines.push(`tier ${q.tier} (not calibrated yet)`);
  const mb = (n) => (n / 1e6).toFixed(1);
  lines.push(`bytes ${mb(s.bytes.loaded)} / ${mb(s.bytes.total)} MB · phase ${s.phase}${s.ready ? " · ready" : ""}`);
  lines.push("");
  lines.push("— phases (ms) —");
  for (const r of phaseRows(t))
    lines.push(`${r.id.padEnd(9)} ${String(r.ms ?? `${r.elapsed}…`).padStart(6)}  [${r.share}]`);
  lines.push("");
  lines.push("— marks (ms since nav) —");
  for (const [k, label] of MARKS) if (t[k] != null) lines.push(`${String(t[k]).padStart(6)}  ${label}`);
  lines.push("");
  lines.push("— downloads > 100 KB (start → end, KB) —");
  for (const r of resourceRows())
    lines.push(`${String(r.start).padStart(6)} → ${String(r.end).padStart(6)}  ${String(r.kb).padStart(5)}  ${r.name}`);
  return lines.join("\n");
}

export default function LoadTimings() {
  const [on, setOn] = useState(false);
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(true);

  useEffect(() => {
    setOn(new URLSearchParams(window.location.search).has("debug"));
  }, []);

  useEffect(() => {
    if (!on) return;
    let quality = null;
    import("../../three/v2/perf/quality").then((m) => (quality = m.default));
    const update = () => setText(report(useLoadingStore.getState(), quality?.getState()));
    update();
    const id = setInterval(update, 250);
    return () => clearInterval(id);
  }, [on]);

  if (!on) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked */
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: "max(8px, env(safe-area-inset-top))",
        left: 8,
        right: 8,
        zIndex: 2147483647,
        maxHeight: "70vh",
        overflow: "auto",
        background: "rgba(0,0,0,0.78)",
        color: "#d6ffd0",
        font: "10px/1.35 ui-monospace, Menlo, monospace",
        borderRadius: 8,
        padding: 8,
        pointerEvents: "auto",
      }}
    >
      <div style={{ display: "flex", gap: 8, marginBottom: open ? 6 : 0 }}>
        <button onClick={() => setOpen((o) => !o)} style={btn}>
          {open ? "hide" : "load timings"}
        </button>
        {open && (
          <button onClick={copy} style={btn}>
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      {open && <pre style={{ margin: 0, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>{text}</pre>}
    </div>
  );
}

const btn = {
  background: "rgba(255,255,255,0.15)",
  color: "inherit",
  border: 0,
  borderRadius: 4,
  padding: "3px 8px",
  font: "inherit",
};
