"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { postState } from "../post/PostPipeline";
import useQualityStore, { isMobileDevice } from "../perf/quality";
import useLoadingStore from "../../../components/loader/loadingStore";

/*
 * Loader ↔ renderer hand-shake: keeps every shader compile and resize hitch
 * behind the opaque loader, so the reveal runs on smooth frames.
 *
 *   1. assets   frame loop paused while GLBs stream (nothing is visible yet, so
 *               nothing is compiled synchronously and the CSS loader stays fluid)
 *   2. compile  once studio + Moos + post pipeline exist: renderer.compileAsync
 *               of the WHOLE scene (frustum culling off, so the garden behind the
 *               camera, Moos and every rack are included) against the post
 *               scene pass's render target (same sample count / formats as the
 *               real frames → same pipeline cache keys). compileAsync builds the
 *               node graphs in slices and yields between objects.
 *   3. calibrate  frame loop resumes; perf/QualityMonitor measures the tier.
 *               If the tier swapped the post pipeline, compile once more.
 *   4. settle   unveil (full DPR, render targets re-allocated) and render until
 *               frame times are steady, still behind the loader → ready.
 *
 * Day/night share every pipeline (time of day only moves uniforms; no light or
 * material is toggled), so one pass covers both.
 *
 * Dev: `?nowarm` skips step 2 (for A/B hitch measurements, see __wzRevealStats).
 */

const POLL_MS = 100;
const SETTLE_FRAMES = 12;
const SETTLE_TIMEOUT_MS = 3000;
const REVEAL_SAMPLE_MS = 6000;

const dev = process.env.NODE_ENV === "development";

async function compileScene(gl, scene, camera) {
  const pass = postState.scenePass;
  const prevTarget = gl.getRenderTarget();
  const prevMRT = gl.getMRT();
  if (pass) {
    // PassNode.setup() normally sets these on the first render.
    const rt = pass.renderTarget;
    rt.samples = postState.samples;
    if (gl.getOutputBufferType) rt.texture.type = gl.getOutputBufferType();
    gl.setRenderTarget(rt);
    gl.setMRT(null);
  }
  const culled = [];
  scene.traverse((o) => {
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
  });
  let promise;
  try {
    // The synchronous part of compileAsync collects the render list; restore right after.
    promise = gl.compileAsync(scene, camera, null, (e) =>
      useLoadingStore.getState().setCompile(e.total ? e.loaded / e.total : 1)
    );
  } finally {
    for (const o of culled) o.frustumCulled = true;
    gl.setRenderTarget(prevTarget);
    gl.setMRT(prevMRT);
  }
  await promise;
}

export default function WarmUp() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const get = useThree((s) => s.get);
  const settle = useRef(null);
  const reveal = useRef(null);

  useEffect(() => {
    const loading = useLoadingStore.getState();
    if (loading.ready) return;
    loading.setPhase("assets");
    get().setFrameloop("never");

    let cancelled = false;
    let timer;
    const skip = dev && new URLSearchParams(window.location.search).has("nowarm");

    const waitAssets = () =>
      new Promise((resolve) => {
        const check = () => {
          if (cancelled) return;
          if (
            scene.getObjectByName("studio") &&
            scene.getObjectByName("moos") &&
            postState.pipeline &&
            postState.scenePass
          )
            resolve();
          else timer = setTimeout(check, POLL_MS);
        };
        check();
      });

    const waitCalibrated = () =>
      new Promise((resolve) => {
        if (useQualityStore.getState().calibrated) return resolve();
        const unsub = useQualityStore.subscribe((s) => {
          if (s.calibrated) {
            unsub();
            resolve();
          }
        });
      });

    (async () => {
      await waitAssets();
      if (cancelled) return;
      useLoadingStore.getState().setPhase("compile");
      const t0 = performance.now();
      const compiledPass = postState.scenePass;
      if (!skip) {
        try {
          await compileScene(gl, scene, camera);
        } catch (err) {
          if (dev) console.warn("[warmup] compileAsync failed", err);
        }
      }
      if (cancelled) return;
      const compileMs = performance.now() - t0;
      useLoadingStore.getState().setCompile(1);
      useLoadingStore.getState().setCompiled();
      useLoadingStore.getState().setPhase("calibrate");
      get().setFrameloop("always");

      await waitCalibrated();
      // A calibrated tier change rebuilds the post pipeline (new scene pass).
      await new Promise((r) => setTimeout(r, 120));
      if (cancelled) return;
      if (!skip && postState.scenePass && postState.scenePass !== compiledPass) {
        get().setFrameloop("never");
        try {
          await compileScene(gl, scene, camera);
        } catch {
          /* best effort */
        }
        get().setFrameloop("always");
      }
      if (cancelled) return;
      useLoadingStore.getState().setPhase("settle");
      useQualityStore.getState().setVeiled(false);
      settle.current = { deltas: [], start: performance.now(), skip: 3 };
      if (dev)
        console.info(
          `[warmup] compileAsync ${skip ? "skipped" : `${compileMs.toFixed(0)} ms`}, tier ${useQualityStore.getState().tier}`
        );
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [gl, scene, camera, get]);

  // Reveal frame statistics (dev): how smooth the hand-over really is.
  useEffect(() => {
    if (!dev) return;
    return useLoadingStore.subscribe((s, prev) => {
      if (s.stage !== prev.stage && (s.stage === "reveal" || s.stage === "enter"))
        reveal.current = { name: s.stage, start: performance.now(), deltas: [] };
    });
  }, []);

  useFrame((_, delta) => {
    const s = settle.current;
    if (s) {
      // The first frames after the unveil resize every render target.
      if (s.skip > 0) {
        s.skip--;
        return;
      }
      s.deltas.push(delta * 1000);
      const last = s.deltas.slice(-SETTLE_FRAMES);
      const sorted = [...last].sort((a, b) => a - b);
      const median = sorted[sorted.length >> 1];
      const limit = Math.max(isMobileDevice() ? 70 : 45, median * 1.8);
      const steady = last.length >= SETTLE_FRAMES && last.every((d) => d < limit);
      useLoadingStore.getState().setSettle(Math.min(1, last.length / SETTLE_FRAMES));
      if (steady || performance.now() - s.start > SETTLE_TIMEOUT_MS) {
        settle.current = null;
        useLoadingStore.getState().setReady();
      }
    }

    const r = reveal.current;
    if (r) {
      r.deltas.push(delta * 1000);
      if (performance.now() - r.start > REVEAL_SAMPLE_MS) {
        const d = r.deltas;
        const stats = {
          frames: d.length,
          avg: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1),
          max: +Math.max(...d).toFixed(1),
          over33: d.filter((x) => x > 33.4).length,
          over50: d.filter((x) => x > 50).length,
        };
        window.__wzRevealStats = { ...window.__wzRevealStats, [r.name]: stats };
        console.info(`[warmup] ${r.name} frames`, JSON.stringify(stats));
        reveal.current = null;
      }
    }
  });

  return null;
}
