/*
 * #debug-only profiling helpers, exposed as window.__perf:
 *
 *   await __perf.fps(4)              rAF frame times over N seconds (what the user sees)
 *   await __perf.bench(30)           unthrottled cost of one full frame: renders K frames
 *                                    back to back and waits for the GPU (≈ GPU ms when
 *                                    GPU-bound). { ms, msShadow, draws, tris }
 *   await __perf.features()          per-object cost (hide → bench → show)
 *
 * GPU timestamp queries are not used: on Apple GPUs Chrome's per-pass timestamps
 * overlap (tile-based deferred rendering) and sum to nonsense.
 */

const FEATURES = [
  "gardenGrassNear",
  "gardenGrassFar",
  "gardenLeaves+gardenTreeWood",
  "gardenFlowers",
  "gardenGround+gardenHills",
  "gardenProps+gardenCritters",
  "cloudPuffs+cloudPuffsDepth",
  "studio",
  "clothes-splatter+clothes-longsleeve+clothes-polo+clothes-hoodie",
  "moos",
  "windStrokes",
  "coffeeSteam",
];

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.floor(s.length / 2)].toFixed(2) : null;
};
const pct = (a, p) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length ? +s[Math.min(s.length - 1, Math.floor(s.length * p))].toFixed(2) : null;
};

export function installPerfTools({ gl, scene, camera, get, getPipeline }) {
  const finish = async () => {
    const device = gl.backend.device;
    if (device) return device.queue.onSubmittedWorkDone();
    const ctx = gl.backend.gl;
    ctx.readPixels(0, 0, 1, 1, ctx.RGBA, ctx.UNSIGNED_BYTE, new Uint8Array(4));
  };

  const keyLight = () => {
    let key = null;
    scene.traverse((o) => {
      if (o.isDirectionalLight && o.castShadow) key = o;
    });
    return key;
  };

  async function bench(K = 30, { post = true, shadow = true } = {}) {
    const pipeline = post ? getPipeline() : null;
    const key = keyLight();
    const draw = () => {
      // Advance the node frame so per-frame passes (scene pass, shadows) re-render.
      gl._nodes.nodeFrame.update();
      if (pipeline) pipeline.render();
      else gl.render(scene, get().camera);
    };
    let cpu = Infinity;
    const run = async (withShadow) => {
      draw();
      await finish();
      const t = performance.now();
      for (let i = 0; i < K; i++) {
        if (withShadow && key) key.shadow.needsUpdate = true;
        draw();
      }
      cpu = Math.min(cpu, (performance.now() - t) / K);
      await finish();
      return +((performance.now() - t) / K).toFixed(2);
    };
    const ms = Math.min(await run(false), await run(false));
    const msShadow = shadow ? Math.min(await run(true), await run(true)) : null;
    const auto = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
    draw();
    const { drawCalls, triangles } = gl.info.render;
    gl.info.autoReset = auto;
    return {
      ms,
      msShadow,
      cpuEncode: +cpu.toFixed(2),
      draws: drawCalls,
      tris: `${Math.round(triangles / 1000)}k`,
      size: `${gl.domElement.width}x${gl.domElement.height}`,
    };
  }

  async function fps(seconds = 4) {
    const ft = [];
    let last = performance.now();
    const t0 = last;
    await new Promise((resolve) => {
      const loop = () => {
        const now = performance.now();
        ft.push(now - last);
        last = now;
        if (now - t0 > seconds * 1000) return resolve();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
    ft.shift();
    return {
      fps: +(ft.length / seconds).toFixed(1),
      ftMed: median(ft),
      ftP95: pct(ft, 0.95),
      ftMax: pct(ft, 1),
    };
  }

  async function features(names = FEATURES) {
    const state = get();
    state.setFrameloop("never");
    try {
      const base = (await bench(30, { shadow: false })).ms;
      const res = { base };
      for (const group of names) {
        const objs = group
          .split("+")
          .map((n) => scene.getObjectByName(n))
          .filter(Boolean);
        if (!objs.length) continue;
        objs.forEach((o) => (o.visible = false));
        const ms = (await bench(30, { shadow: false })).ms;
        objs.forEach((o) => (o.visible = true));
        res[group] = +(base - ms).toFixed(2);
      }
      res.noPost = (await bench(30, { post: false, shadow: false })).ms;
      res.baseAfter = (await bench(30, { shadow: false })).ms;
      return res;
    } finally {
      state.setFrameloop("always");
    }
  }

  window.__perf = { bench, fps, features, finish };
  return () => {
    delete window.__perf;
  };
}
