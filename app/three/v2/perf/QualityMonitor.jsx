"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { postState } from "../post/PostPipeline";
import useLoadingStore from "../../../components/loader/loadingStore";
import useQualityStore, { TIERS, TIER_ORDER, isMobileDevice, tierDpr } from "./quality";

/*
 * Picks and guards the quality tier (see ./quality.js). Mount once in <Canvas>.
 *
 * Calibration runs once, behind the opaque loader: the frame loop is paused,
 * the canvas is sized to the start tier's DPR, a few warm-up frames let the GPU
 * clock up, then K frames are rendered back to back and timed until the queue
 * is idle (WebGPU onSubmittedWorkDone / WebGL readPixels). That throughput is
 * the frame's GPU cost (or CPU cost, whichever is the bottleneck).
 */

const BUDGET_MS = { desktop: 12, mobile: 26 };
/** Frame time the runtime guard treats as "missing the target". */
const SLOW_FRAME_MS = { desktop: 20, mobile: 38 };
/** Share of the frame cost that scales with pixel count (post + fill). */
const PIXEL_SHARE = 0.85;
/** Cost of a tier without DOF + bloom, relative to with. */
const NO_POST_FX = 0.75;
const MAX_GUARD_STEPS = 3;

async function waitForGpu(gl) {
  const device = gl.backend.device;
  if (device) return device.queue.onSubmittedWorkDone();
  const ctx = gl.backend.gl;
  ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(4));
}

async function measureFrameMs(gl, render, K = 8) {
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 4; j++) render();
    await waitForGpu(gl);
  }
  const t = performance.now();
  for (let i = 0; i < K; i++) render();
  await waitForGpu(gl);
  return (performance.now() - t) / K;
}

/** Predicted frame cost of `tier` from a measurement at `dpr` with `fromTier`'s effects. */
function predict(ms, dpr, fromTier, tier) {
  const pixels = (tierDpr(tier) / dpr) ** 2;
  let cost = ms * (1 - PIXEL_SHARE + PIXEL_SHARE * pixels);
  const fx = (t) => (TIERS[t].dof || TIERS[t].bloom ? 1 : NO_POST_FX);
  return (cost * fx(tier)) / fx(fromTier);
}

export default function QualityMonitor() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  const ready = useRef(0);
  const busy = useRef(false);
  const guard = useRef({ frames: [], slowWindows: 0, cooldown: 0, steps: 0, settle: 2 });
  const mobile = useRef(isMobileDevice());

  useEffect(() => {
    if (process.env.NODE_ENV === "development") window.__quality = useQualityStore;
  }, []);

  useFrame((_, delta) => {
    const q = useQualityStore.getState();

    // --- calibration (once, while the loader hides the canvas) ---
    if (!q.calibrated) {
      if (busy.current) return;
      // After the loader's shader warm-up (loading/WarmUp.jsx) compiled every pipeline.
      const loaded =
        scene.getObjectByName("studio") && postState.pipeline && useLoadingStore.getState().compiled;
      ready.current = loaded ? ready.current + 1 : 0;
      // A few frames more for what compileAsync can't reach (shadow map, post quads, compute).
      if (ready.current < 8) return;
      busy.current = true;
      const state = get();
      const startTier = q.tier;
      const dpr = tierDpr(startTier, mobile.current);
      const pipeline = postState.pipeline;
      state.setFrameloop("never");
      gl.setPixelRatio(dpr);
      const render = () => {
        gl._nodes.nodeFrame.update();
        pipeline.render();
      };
      measureFrameMs(gl, render)
        .catch(() => null)
        .then((ms) => {
          const budget = mobile.current ? BUDGET_MS.mobile : BUDGET_MS.desktop;
          let tier = startTier;
          if (ms != null) {
            // Tiers above the start tier (e.g. "high" on a fast phone) need 2× headroom.
            const from = TIER_ORDER.indexOf(startTier);
            tier =
              TIER_ORDER.find((t, i) => predict(ms, dpr, startTier, t) <= (i < from ? budget / 2 : budget)) ??
              "low";
          }
          useQualityStore.getState().setCalibrated(
            { ms: ms != null ? +ms.toFixed(2) : null, dpr, from: startTier, budget },
            tier
          );
          if (process.env.NODE_ENV === "development")
            console.info(
              `[quality] ${ms?.toFixed(2)} ms/frame at dpr ${dpr} (${startTier}) → ${tier}`
            );
          gl.setPixelRatio(useQualityStore.getState().veiled ? 0.5 : tierDpr(tier, mobile.current));
          state.setFrameloop("always");
          busy.current = false;
        });
      return;
    }

    // --- runtime guard: sustained slow frames → step down ---
    if (q.forced || q.veiled || document.hidden) return;
    const g = guard.current;
    if (g.settle > 0) {
      g.settle -= delta;
      return;
    }
    if (delta > 0.25) return; // tab switch, long task: not a GPU signal
    g.frames.push(delta * 1000);
    g.cooldown -= delta;
    if (g.frames.length < 60) return;
    const sorted = g.frames.sort((a, b) => a - b);
    const median = sorted[sorted.length >> 1];
    g.frames.length = 0;
    const slow = median > (mobile.current ? SLOW_FRAME_MS.mobile : SLOW_FRAME_MS.desktop);
    g.slowWindows = slow ? g.slowWindows + 1 : 0;
    if (g.slowWindows >= 2 && g.cooldown <= 0 && g.steps < MAX_GUARD_STEPS) {
      if (q.stepDown()) {
        g.steps++;
        if (process.env.NODE_ENV === "development")
          console.info(
            `[quality] median frame ${median.toFixed(1)} ms → ${useQualityStore.getState().tier} @ dpr ${useQualityStore.getState().dpr.toFixed(2)}`
          );
      }
      g.slowWindows = 0;
      g.cooldown = 3;
    }
  });

  return null;
}
