"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useControls } from "leva";
import useEnvironmentStore from "../../../stores/environmentStore";
import { getBackendName } from "../renderer";
import { postState } from "../post/PostPipeline";
import { installPerfTools } from "./perfTools";
import useQualityStore, { TIER_ORDER } from "../perf/quality";

/** Tiny FPS / draw-call overlay (r3f-perf / stats-gl don't support WebGPURenderer). */
function Stats() {
  const gl = useThree((s) => s.gl);
  const el = useRef();
  const acc = useRef({ frames: 0, time: 0 });

  useEffect(() => {
    const div = document.createElement("div");
    div.style.cssText =
      "position:fixed;bottom:8px;right:8px;z-index:9999;padding:6px 8px;border-radius:4px;" +
      "background:rgba(0,0,0,.7);color:#7CFC9A;font:11px/1.35 ui-monospace,monospace;" +
      "pointer-events:none;white-space:pre";
    document.body.appendChild(div);
    el.current = div;
    // WebGPURenderer resets info from its own rAF, before R3F renders; take over
    // so the numbers read here describe the previous full frame.
    gl.info.autoReset = false;
    return () => {
      div.remove();
      gl.info.autoReset = true;
    };
  }, [gl]);

  useFrame((_, delta) => {
    const a = acc.current;
    const { drawCalls, triangles } = gl.info.render;
    gl.info.reset();
    a.frames++;
    a.time += delta;
    if (a.time < 0.5 || !el.current) return;
    const mem = gl.info.memory;
    el.current.textContent =
      `${getBackendName(gl)}  ${(a.frames / a.time).toFixed(0)} fps  ${((a.time / a.frames) * 1000).toFixed(1)} ms\n` +
      `draws ${drawCalls}  tris ${(triangles / 1000).toFixed(0)}k\n` +
      `geo ${mem.geometries}  tex ${mem.textures}  dpr ${gl.getPixelRatio().toFixed(2)}\n` +
      `quality ${useQualityStore.getState().tier}` +
      (useQualityStore.getState().calibration
        ? `  (cal ${useQualityStore.getState().calibration.ms} ms)`
        : "");
    a.frames = 0;
    a.time = 0;
  });

  return null;
}

/** Leva controls for the environment store. */
function EnvironmentControls() {
  const env = useEnvironmentStore.getState();
  const [, set] = useControls("Environment", () => ({
    mode: {
      value: env.mode,
      options: ["auto", "manual"],
      onChange: (v, _, { initial, fromPanel }) =>
        !initial && fromPanel && env.setMode(v),
    },
    timeOfDay: {
      value: env.timeOfDay,
      min: 0,
      max: 24,
      step: 0.05,
      onChange: (v, _, { initial, fromPanel }) =>
        !initial && fromPanel && env.setTimeOfDay(v),
    },
    windStrength: {
      value: env.windStrength,
      min: 0,
      max: 2,
      step: 0.01,
      onChange: (v) => env.setWind({ strength: v }),
    },
    windAngle: {
      value: (Math.atan2(env.windDirection[2], env.windDirection[0]) * 180) / Math.PI,
      min: -180,
      max: 180,
      step: 1,
      label: "windAngle°",
      onChange: (deg) => {
        const r = (deg * Math.PI) / 180;
        env.setWind({ direction: [Math.cos(r), 0, Math.sin(r)] });
      },
    },
  }));

  // Reflect store changes (auto clock sync, manual override) back into the panel.
  useEffect(
    () =>
      useEnvironmentStore.subscribe((s) =>
        set({ mode: s.mode, timeOfDay: s.timeOfDay })
      ),
    [set]
  );

  return null;
}

/** Leva: pin the adaptive quality tier. */
function QualityControls() {
  const [, set] = useControls("Quality", () => ({
    tier: {
      value: useQualityStore.getState().tier,
      options: TIER_ORDER,
      onChange: (v, _, { initial, fromPanel }) =>
        !initial && fromPanel && useQualityStore.getState().setTier(v),
    },
  }));
  useEffect(() => useQualityStore.subscribe((s) => set({ tier: s.tier })), [set]);
  return null;
}

/** window.__perf profiling helpers (see ./perfTools.js). */
function PerfTools() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const get = useThree((s) => s.get);
  useEffect(
    () => installPerfTools({ gl, scene, get, getPipeline: () => postState.pipeline }),
    [gl, scene, get]
  );
  return null;
}

/** Everything that only exists behind #debug. Mount inside <Canvas>. */
export default function Debug() {
  return (
    <>
      <Stats />
      <PerfTools />
      <QualityControls />
      <EnvironmentControls />
    </>
  );
}
