/*
 * `?debug` only: where the shader warm-up (WarmUp.jsx → renderer.compileAsync)
 * spends its time, shown in the loader's timings overlay.
 *
 * compileAsync handles one render object at a time:
 *   node build   NodeManager.getForRenderAsync (TSL graph → WGSL; yields 6× inside)
 *   pipeline     backend.createRenderPipeline → device.createRenderPipelineAsync
 *   yield        yieldToMain() between objects and inside the node build. Uses
 *                scheduler.yield() where it exists, else requestAnimationFrame —
 *                Safari has no scheduler.yield, so every yield waits a frame.
 *
 * The yields are counted with a stand-in scheduler.yield that behaves exactly
 * like three's fallback (requestAnimationFrame) or wraps the native one.
 */

export const debugCompile = () =>
  typeof window !== "undefined" && new URLSearchParams(window.location.search).has("debug");

const ms = (n) => Math.round(n);

export function startCompileStats(gl, scene) {
  const t0 = performance.now();
  const stats = {
    native: Boolean(self.scheduler?.yield),
    objects: 0,
    nodeBuilds: 0,
    nodeMs: 0,
    pipelines: 0,
    pipelineMs: 0,
    shaderModules: 0,
    shaderModuleMs: 0,
    yields: 0,
    yieldMs: 0,
  };

  // Scene inventory.
  const materials = new Set();
  const geometries = new Set();
  let meshes = 0;
  scene.traverse((o) => {
    if (!o.isMesh && !o.isPoints && !o.isLine && !o.isSprite) return;
    meshes++;
    if (o.geometry) geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) if (m) materials.add(m);
  });
  const types = {};
  for (const m of materials) types[m.type] = (types[m.type] ?? 0) + 1;
  Object.assign(stats, { meshes, materials: materials.size, geometries: geometries.size, types });

  const pipes = gl._pipelines;
  const before = {
    pipelines: pipes?.caches?.size ?? 0,
    vertex: pipes?.programs?.vertex?.size ?? 0,
    fragment: pipes?.programs?.fragment?.size ?? 0,
  };

  const restore = [];
  const wrap = (obj, key, fn) => {
    if (!obj?.[key]) return;
    const orig = obj[key];
    obj[key] = fn(orig);
    restore.push(() => (obj[key] = orig));
  };

  wrap(gl._nodes, "getForRenderAsync", (orig) =>
    function (...args) {
      const t = performance.now();
      stats.nodeBuilds++;
      return Promise.resolve(orig.apply(this, args)).finally(() => (stats.nodeMs += performance.now() - t));
    }
  );
  wrap(gl.backend, "createRenderPipeline", (orig) =>
    function (renderObject, promises) {
      const t = performance.now();
      const n = promises?.length ?? 0;
      const out = orig.call(this, renderObject, promises);
      stats.pipelines++;
      if (promises && promises.length > n)
        Promise.all(promises.slice(n)).finally(() => (stats.pipelineMs += performance.now() - t));
      else stats.pipelineMs += performance.now() - t;
      return out;
    }
  );
  wrap(gl.backend, "createProgram", (orig) =>
    function (...args) {
      const t = performance.now();
      const out = orig.apply(this, args);
      stats.shaderModules++;
      stats.shaderModuleMs += performance.now() - t;
      return out;
    }
  );

  const hadScheduler = "scheduler" in self;
  const prevScheduler = self.scheduler;
  const nativeYield = prevScheduler?.yield?.bind(prevScheduler);
  const countedYield = () => {
    const t = performance.now();
    stats.yields++;
    const p = nativeYield ? nativeYield() : new Promise((r) => requestAnimationFrame(r));
    return p.finally(() => (stats.yieldMs += performance.now() - t));
  };
  try {
    if (prevScheduler) wrap(prevScheduler, "yield", () => countedYield);
    else {
      self.scheduler = { yield: countedYield };
      restore.push(() => {
        if (hadScheduler) self.scheduler = prevScheduler;
        else delete self.scheduler;
      });
    }
  } catch {
    /* read-only scheduler: yields stay uncounted */
  }

  return {
    stats,
    onProgress: (e) => (stats.objects = e.total),
    finish(label) {
      for (const r of restore.reverse()) r();
      const after = {
        pipelines: pipes?.caches?.size ?? 0,
        vertex: pipes?.programs?.vertex?.size ?? 0,
        fragment: pipes?.programs?.fragment?.size ?? 0,
      };
      return {
        label,
        wallMs: ms(performance.now() - t0),
        ...stats,
        nodeMs: ms(stats.nodeMs),
        pipelineMs: ms(stats.pipelineMs),
        shaderModuleMs: ms(stats.shaderModuleMs),
        yieldMs: ms(stats.yieldMs),
        newPipelines: after.pipelines - before.pipelines,
        programs: `${after.vertex} vs / ${after.fragment} fs`,
      };
    },
  };
}
