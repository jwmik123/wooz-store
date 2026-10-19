import { create } from "zustand";

/*
 * Loading state shared by the DOM loader (components/loader) and the 3D
 * warm-up (three/v2/loading). No three.js imports: the loader must stay tiny.
 *
 * Phases, in order, each with its share of the progress bar:
 *
 *   boot       JS chunk + WebGPU device + renderer init      (canvas created)
 *   assets     GLB / KTX2 / basis bytes (fetchTracker.js)    (studio + Moos in the scene)
 *   compile    renderer.compileAsync of every material       (WarmUp.jsx)
 *   calibrate  quality tier measurement (perf/QualityMonitor) (quality.calibrated)
 *   settle     full-res frames until frame times are steady  (WarmUp.jsx)
 *
 * `rawProgress(now)` maps that to 0..1; the loader smooths it (monotonic).
 */

export const PHASES = [
  { id: "boot", to: 0.08, creep: 1.6 },
  { id: "assets", to: 0.7, creep: 6 },
  { id: "compile", to: 0.88, creep: 2 },
  { id: "calibrate", to: 0.96, creep: 1.2 },
  { id: "settle", to: 1, creep: 0.8 },
];

/** Lower bound for the byte total, so early requests don't read as "done". */
const BYTE_FLOOR = 10e6;

const now = () => (typeof performance === "undefined" ? 0 : performance.now());

const useLoadingStore = create((set, get) => ({
  phase: "boot",
  /** performance.now() when the current phase started. */
  phaseStart: now(),
  bytes: { loaded: 0, total: 0 },
  /** 0..1 inside compile / settle. */
  compile: 0,
  settle: 0,
  /** Shader warm-up done; quality calibration (perf/QualityMonitor) waits for it. */
  compiled: false,
  /** Everything compiled, calibrated and steady: the reveal may start. */
  ready: false,
  /** The loader has handed over to the 3D intro shot (camera reveal started). */
  revealed: false,
  /** "loading" → "reveal" → "intro" → "enter" → "inside" (Loader.jsx). */
  stage: "loading",
  /** Diagnostics (dev overlay / report). */
  timings: {},

  setPhase: (phase) => {
    const s = get();
    if (s.phase === phase) return;
    const order = PHASES.map((p) => p.id);
    // Phases only move forward (a late byte event never rewinds the bar).
    if (order.indexOf(phase) < order.indexOf(s.phase)) return;
    set({
      phase,
      phaseStart: now(),
      timings: { ...s.timings, [phase]: Math.round(now()) },
    });
  },
  addBytes: (loaded, total) =>
    set((s) => ({
      bytes: { loaded: s.bytes.loaded + loaded, total: s.bytes.total + total },
    })),
  /** Diagnostic timestamp without a phase change (?debug timings overlay). */
  mark: (name) => set((s) => ({ timings: { ...s.timings, [name]: Math.round(now()) } })),
  setCompile: (compile) => set({ compile }),
  setSettle: (settle) => set({ settle }),
  setCompiled: () => set({ compiled: true }),
  setReady: () =>
    set((s) => ({ ready: true, timings: { ...s.timings, ready: Math.round(now()) } })),
  setStage: (stage) =>
    set((s) => ({
      stage,
      revealed: s.revealed || stage !== "loading",
      timings: { ...s.timings, [stage]: Math.round(now()) },
    })),
}));

/** Raw (unsmoothed) overall progress 0..1 for the current state. */
export function rawProgress(s = useLoadingStore.getState(), t = now()) {
  if (s.ready) return 1;
  const i = PHASES.findIndex((p) => p.id === s.phase);
  const from = i > 0 ? PHASES[i - 1].to : 0;
  const { to, creep } = PHASES[i];
  let f = 0;
  if (s.phase === "assets") f = s.bytes.loaded / Math.max(s.bytes.total, BYTE_FLOOR);
  else if (s.phase === "compile") f = s.compile;
  else if (s.phase === "settle") f = s.settle;
  // Slow creep so the bar never looks stuck while a phase gives no signal.
  const c = 0.6 * (1 - Math.exp(-(t - s.phaseStart) / 1000 / creep));
  return from + (to - from) * Math.min(0.97, Math.max(f, c));
}

export default useLoadingStore;
