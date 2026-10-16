"use client";

import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
} from "three/webgpu";
import {
  abs,
  cameraPosition,
  clamp,
  cos,
  cross,
  dot,
  float,
  floor,
  fract,
  instanceIndex,
  max,
  mix,
  normalize,
  positionGeometry,
  pow,
  sin,
  smoothstep,
  step,
  uniform,
  vec3,
} from "three/tsl";
import {
  uNightFactor,
  uSkyHorizon,
  uSunColor,
  uTime,
  uWindDirection,
  uWindStrength,
} from "../uniforms";
import useDebug from "../debug/useDebug";

/*
 * Anime / Ghibli style wind streaks
 * ---------------------------------
 * One InstancedMesh = ONE draw call. Every instance is a camera-facing ribbon
 * whose whole lifecycle (spawn cycle, random start/lifetime, path curve,
 * draw-on / fade-out) is computed in the vertex shader from `instanceIndex`
 * and `uTime`: zero CPU work per frame, no per-instance buffers.
 */

const MAX_STROKES = 30;
const SEGMENTS = 28;

/** Runtime settings (written by the Leva panel, read every frame). */
export const windStrokeSettings = { count: 14 };
const uStrokeFreq = uniform(1);

const hash = (x) => fract(sin(x.mul(12.9898).add(78.233)).mul(43758.5453));

function createGeometry() {
  // position.x = v along the ribbon (0 tail .. 1 head), position.y = side (-1/+1)
  const positions = new Float32Array((SEGMENTS + 1) * 2 * 3);
  const index = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const v = i / SEGMENTS;
    positions.set([v, -1, 0], i * 6);
    positions.set([v, 1, 0], i * 6 + 3);
    if (i < SEGMENTS) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(positions, 3));
  geometry.setIndex(index);
  return geometry;
}

function createMaterial() {
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    side: DoubleSide,
    fog: false,
  });
  material.name = "windStrokes";

  const v = positionGeometry.x;
  const sideCoord = positionGeometry.y;

  // --- per-instance lifecycle ------------------------------------------------
  const seed = hash(float(instanceIndex).add(1.0));
  const period = mix(7, 15, hash(seed.mul(7.1))).div(uStrokeFreq.max(0.05));
  const t = uTime.add(seed.mul(100)).div(period);
  const cycle = floor(t);
  const phase = fract(t);
  const dur = mix(0.22, 0.4, hash(seed.add(3.3)));
  const u = phase.div(dur); // >= 1 means dormant until the next cycle
  const alive = step(u, 1);

  const rnd = (i) => hash(seed.mul(17.3).add(cycle.mul(3.7)).add(i * 1.91));

  const dir = vec3(uWindDirection.x, 0, uWindDirection.z);
  const side = vec3(uWindDirection.z.negate(), 0, uWindDirection.x);
  const up = vec3(0, 1, 0);

  const len = mix(10, 18, rnd(4)).mul(float(0.8).add(clamp(uWindStrength, 0, 1.2).mul(0.3)));
  const origin = dir
    .mul(mix(-3, 3, rnd(3)).sub(len.mul(0.5)))
    .add(side.mul(mix(-6, 6, rnd(1))))
    .add(up.mul(mix(-4.5, 3.5, rnd(2))));
  const amp = mix(0.4, 1.2, rnd(5));
  const freq = mix(0.5, 1.1, rnd(6));
  const ph = rnd(7).mul(6.283);
  const flourish = mix(0.3, 1.0, rnd(8));

  // Curve: gentle S-wobble plus a little loop-the-loop at the leading end.
  const path = (c) => {
    const base = origin.add(dir.mul(c.mul(len)));
    const wobble = side
      .mul(sin(c.mul(freq).mul(6.283).add(ph)).mul(amp).mul(1.2))
      .add(up.mul(sin(c.mul(freq).mul(4.2).add(ph.mul(1.7))).mul(amp).mul(0.8)));
    const th = max(c.sub(0.6), 0).mul(16);
    const swirl = side
      .mul(sin(th))
      .add(up.mul(float(1).sub(cos(th))))
      .mul(flourish.mul(0.9));
    return base.add(wobble).add(swirl);
  };

  // Draw on at the head, then the tail catches up and the stroke dissolves.
  const head = clamp(u.mul(1.35), 0, 1);
  const headE = float(1).sub(pow(float(1).sub(head), 2));
  const tail = clamp(u.mul(1.35).sub(0.35), 0, 1);
  const tailE = tail.mul(tail);
  const c = mix(tailE, headE, v);

  const p = path(c);
  const tangent = normalize(path(c.add(0.01)).sub(path(c.sub(0.01))));
  const toCam = normalize(cameraPosition.sub(p));
  const wDir = normalize(cross(tangent, toCam));

  const baseWidth = mix(0.08, 0.18, rnd(9));
  const taper = pow(v, 0.55).mul(float(1).sub(pow(v, 4).mul(0.5)));
  const width = baseWidth.mul(taper).mul(alive);

  material.positionNode = p.add(wDir.mul(width.mul(sideCoord)));

  // --- shading ---------------------------------------------------------------
  const vSide = sideCoord.toVarying("wsSide");
  const vAlpha = smoothstep(0, 0.4, v)
    .mul(smoothstep(0, 0.1, u))
    .mul(alive)
    .toVarying("wsAlpha");

  const edge = float(1).sub(pow(abs(vSide), 2));
  const day = mix(1, 0.05, uNightFactor); // nearly invisible at night
  const tint = mix(vec3(1), mix(uSkyHorizon, uSunColor, 0.5).normalize().mul(1.4), 0.25);

  material.colorNode = tint;
  material.opacityNode = edge.mul(vAlpha).mul(day).mul(0.8);

  return material;
}

function StrokeControls() {
  useControls("Environment", {
    strokes: {
      value: windStrokeSettings.count,
      min: 0,
      max: MAX_STROKES,
      step: 1,
      onChange: (v) => (windStrokeSettings.count = v),
    },
    strokeFreq: {
      value: uStrokeFreq.value,
      min: 0.1,
      max: 4,
      step: 0.05,
      onChange: (v) => (uStrokeFreq.value = v),
    },
  });
  return null;
}

export default function WindStrokes() {
  const debug = useDebug();
  const mesh = useMemo(() => {
    const m = new InstancedMesh(createGeometry(), createMaterial(), MAX_STROKES);
    const identity = new Matrix4();
    for (let i = 0; i < MAX_STROKES; i++) m.setMatrixAt(i, identity);
    m.frustumCulled = false;
    m.renderOrder = 10;
    m.name = "windStrokes";
    m.raycast = () => {}; // never intercept clicks
    return m;
  }, []);

  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
    },
    [mesh]
  );

  useFrame(() => {
    mesh.count = windStrokeSettings.count;
    mesh.visible = mesh.count > 0;
  });

  return (
    <>
      <primitive object={mesh} />
      {debug && <StrokeControls />}
    </>
  );
}
