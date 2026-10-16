"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  MeshBasicNodeMaterial,
  Vector3,
} from "three/webgpu";
import {
  Fn,
  attribute,
  cameraPosition,
  cameraWorldMatrix,
  clamp,
  dot,
  float,
  length,
  max,
  mix,
  mod,
  normalize,
  positionWorld,
  smoothstep,
  sqrt,
  texture,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uTime } from "../uniforms";
import { getCloudNoiseTexture } from "./noiseTexture";
import { SEA_Y } from "./CloudSea";
import {
  cloudAmbient,
  cloudDirect,
  cloudLightDir,
  horizonFog,
  nightTint,
  silverLining,
  uCloudDrift,
} from "./cloudCommon";

/*
 * Nearby cumulus: clusters of camera-facing sphere impostors in ONE merged
 * geometry (1 draw call). Each puff gets a fake sphere normal + noise-eroded
 * edge, wrap lighting from the sun, darker flat bottoms, a silver lining when
 * backlit and the same horizon fog as the sea. The whole field drifts with the
 * wind and wraps around a square around the studio (faded at the seam).
 * Quads are re-sorted back-to-front on the CPU only when the camera moves.
 */

const WRAP = 280; // half size of the drift domain (world units)

// Cumulus towers rising out of the cloud sea: [x, z, radius, height / radius].
// Kept out of the intro camera corridor (|x| < 7, z > 0).
const CLUSTERS = [
  // Hero towers framing the studio (visible from the intro and through the
  // side windows of the overview).
  [-17, -9, 5.5, 1.25],
  [19, -3, 5, 1.15],
  [-12, 7, 3.4, 1.1],
  [13, 9, 3.2, 1.0],
  [3, -26, 5, 1.0],
  // Mid field.
  [-26, -32, 7, 0.9],
  [22, -40, 8.5, 1.1],
  [-6, -64, 12, 0.8],
  [42, -14, 7, 0.8],
  [-44, -6, 8, 1.0],
  [32, 28, 6.5, 0.9],
  [-30, 32, 7, 0.8],
  [62, -55, 13, 0.9],
  [-62, -48, 13, 1.0],
  [0, 56, 9, 0.8],
  [-72, 18, 10, 0.9],
  [74, 16, 10, 1.0],
  // Distant banks towards the horizon (mostly haze, they sell the scale).
  [-120, -150, 22, 0.6],
  [80, -185, 26, 0.5],
  [185, -90, 24, 0.6],
  [-205, -60, 26, 0.5],
  [-160, 95, 22, 0.6],
  [150, 125, 24, 0.5],
  [20, -245, 30, 0.45],
  [-60, 205, 24, 0.5],
  [235, 40, 26, 0.5],
  [-245, -175, 28, 0.5],
];

function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Puffs per cluster: a tapering tower whose base is buried in the sea. */
function buildPuffs() {
  const rand = mulberry32(42);
  const puffs = [];
  const base = SEA_Y - 0.4;
  for (const [cx, cz, r, h] of CLUSTERS) {
    const count = Math.round(6 + r * 1.1);
    for (let i = 0; i < count; i++) {
      const t = Math.pow(i / count, 1.15); // 0 = bottom ring, 1 = crown
      const ring = r * (1 - 0.65 * t) * Math.sqrt(0.35 + 0.65 * rand());
      const a = rand() * Math.PI * 2;
      const size = r * (0.42 - 0.18 * t) * (0.8 + rand() * 0.4);
      puffs.push({
        x: cx + Math.cos(a) * ring,
        y: base + t * r * h * 1.4 + size * 0.35,
        z: cz + Math.sin(a) * ring * 0.7,
        size,
        seed: rand(),
        base,
        // Offset from the cluster's core -> whole-cluster shading.
        core: [Math.cos(a) * ring, (t - 0.45) * r * h * 1.4, Math.sin(a) * ring * 0.7],
      });
    }
  }
  return puffs;
}

function buildGeometry(puffs) {
  const n = puffs.length;
  const center = new Float32Array(n * 4 * 3);
  const corner = new Float32Array(n * 4 * 2);
  const params = new Float32Array(n * 4 * 3); // size, seed, base y
  const core = new Float32Array(n * 4 * 3);
  const index = new Uint32Array(n * 6);
  const corners = [-1, -1, 1, -1, 1, 1, -1, 1];
  puffs.forEach((p, i) => {
    for (let v = 0; v < 4; v++) {
      const k = i * 4 + v;
      center.set([p.x, p.y, p.z], k * 3);
      corner.set([corners[v * 2], corners[v * 2 + 1]], k * 2);
      params.set([p.size, p.seed, p.base], k * 3);
      core.set(p.core, k * 3);
    }
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const g = new BufferGeometry();
  // `position` is required by the renderer; the real position is built in positionNode.
  g.setAttribute("position", new BufferAttribute(center.slice(), 3));
  g.setAttribute("center", new BufferAttribute(center, 3));
  g.setAttribute("corner", new BufferAttribute(corner, 2));
  g.setAttribute("params", new BufferAttribute(params, 3));
  g.setAttribute("core", new BufferAttribute(core, 3));
  g.setIndex(new BufferAttribute(index, 1));
  return g;
}

/** Same drift + wrap as the vertex shader (for CPU sorting). */
function wrapped(out, p, drift) {
  const w = (v) => ((((v + WRAP) % (2 * WRAP)) + 2 * WRAP) % (2 * WRAP)) - WRAP;
  return out.set(w(p.x + drift.x), p.y, w(p.z + drift.y));
}

/**
 * Two materials share the billboard + silhouette code:
 *  - colour: soft, alpha blended, no depth write (the visible cloud);
 *  - depth:  colorWrite off, writes depth only where the puff is dense, drawn
 *    right after the colour pass. This gives the DOF / AO real cloud depth (no
 *    hard blur seams where a puff crosses the horizon) without sorting issues.
 */
function makeMaterial({ depthOnly = false } = {}) {
  const noise = texture(getCloudNoiseTexture());
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: depthOnly,
    colorWrite: !depthOnly,
    fog: false,
  });
  material.name = depthOnly ? "cloudPuffsDepth" : "cloudPuffs";
  if (depthOnly) material.alphaTest = 0.6;

  const aCenter = attribute("center", "vec3");
  const aCorner = attribute("corner", "vec2");
  const aParams = attribute("params", "vec3");
  const vCore = varying(attribute("core", "vec3"), "vCore");

  // Wind drift, wrapped into [-WRAP, WRAP] on XZ.
  const drifted = Fn(() => {
    const xz = mod(aCenter.xz.add(uCloudDrift).add(WRAP), WRAP * 2).sub(WRAP);
    return vec3(xz.x, aCenter.y, xz.y);
  })();

  const vCenter = varying(drifted, "vCenter");
  const vCorner = varying(aCorner, "vCorner");
  const vParams = varying(aParams, "vParams");

  material.positionNode = Fn(() => {
    const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz;
    const up = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz;
    const size = aParams.x;
    return drifted.add(right.mul(aCorner.x.mul(size))).add(up.mul(aCorner.y.mul(size)));
  })();

  const uv = vCorner;
  const r = length(uv);
  const seed = vParams.y;
  // Slowly boiling noise in the puff's own frame.
  const nUv = uv.mul(0.26).add(vec2(seed.mul(7.1), seed.mul(3.7)));
  const t = uTime.mul(0.004);
  const n1 = noise.sample(nUv.add(vec2(t, t.mul(0.6)))).g;
  const n2 = noise.sample(nUv.mul(1.7).sub(vec2(t.mul(1.3), 0))).b;
  const n = n1.mul(0.65).add(n2.mul(0.35));

  const alphaNode = Fn(() => {
    // Fluffy, eroded silhouette.
    const edge = r.add(n.sub(0.5).mul(0.38));
    const shapeAlpha = smoothstep(0.97, 0.55, edge);
    // Fade near the camera / studio, at the wrap seam and where the puff dips
    // into the cloud sea (no hard intersection line).
    const c = vCenter;
    const seam = smoothstep(float(WRAP), float(WRAP - 40), max(c.x.abs(), c.z.abs()));
    const nearCam = smoothstep(4.0, 10.0, length(c.sub(cameraPosition)));
    const nearStudio = smoothstep(5.0, 8.0, length(c.xz));
    const intoSea = smoothstep(float(SEA_Y - 0.1), vParams.x.mul(0.5).add(SEA_Y + 0.6), positionWorld.y);
    return shapeAlpha.mul(seam).mul(nearCam).mul(nearStudio).mul(intoSea).mul(0.97);
  })();

  if (depthOnly) {
    material.colorNode = vec4(0, 0, 0, alphaNode);
    return material;
  }

  material.colorNode = Fn(() => {
    const size = vParams.x;
    const baseY = vParams.z;

    // Fake sphere normal in view space, perturbed by the noise -> world.
    const nz = sqrt(max(float(1).sub(r.mul(r)), 0.0));
    const nView = normalize(vec3(uv.add(n.sub(0.5).mul(0.6)), nz.add(0.15)));
    const nPuff = normalize(cameraWorldMatrix.mul(vec4(nView, 0)).xyz);

    const wp = positionWorld;
    // Blend each puff's sphere normal with the direction from the cluster core
    // so a cluster shades as one lumpy volume instead of separate balls.
    const fromCore = normalize(vCore.add(wp.sub(vCenter)).add(nPuff.mul(size.mul(0.6))));
    const nWorld = normalize(mix(nPuff, fromCore, 0.55));
    const toFrag = wp.sub(cameraPosition);
    const dist = length(toFrag);
    const viewDir = toFrag.div(dist);

    const L = cloudLightDir;
    const wrap = clamp(dot(nWorld, L).mul(0.7).add(0.3), 0, 1);
    // Flat, shadowed undersides: darken towards the cluster base.
    const heightAboveBase = clamp(wp.y.sub(baseY).div(size.mul(1.8)), 0, 1);
    const underside = mix(float(0.35), float(1.0), heightAboveBase);

    const ambient = cloudAmbient(nWorld.y).mul(mix(float(0.55), float(0.85), heightAboveBase));
    const direct = cloudDirect.mul(wrap.mul(wrap)).mul(underside).mul(1.35);
    // Backlit rims glow (silver lining); thin rim = r -> 1.
    const rim = smoothstep(0.35, 0.95, r).add(0.15);
    const lining = cloudDirect.mul(silverLining(viewDir)).mul(rim).mul(2.6);

    const color = ambient.add(direct).add(lining).mul(nightTint);
    const fogged = horizonFog(color, dist, float(15), float(0.005));
    return vec4(fogged, alphaNode);
  })();

  return material;
}

export default function CloudPuffs() {
  const puffs = useMemo(buildPuffs, []);
  const geometry = useMemo(() => buildGeometry(puffs), [puffs]);
  const material = useMemo(() => makeMaterial(), []);
  const depthMaterial = useMemo(() => makeMaterial({ depthOnly: true }), []);
  const sortState = useRef({
    camera: new Vector3(Infinity, 0, 0),
    drift: { x: Infinity, y: 0 },
    order: puffs.map((_, i) => i),
    dist: new Float32Array(puffs.length),
    tmp: new Vector3(),
  });

  // Back-to-front sort of the quads when the camera (or drift) moved enough.
  useFrame(({ camera }) => {
    const s = sortState.current;
    const drift = uCloudDrift.value;
    if (
      camera.position.distanceToSquared(s.camera) < 0.04 &&
      Math.abs(drift.x - s.drift.x) + Math.abs(drift.y - s.drift.y) < 1
    )
      return;
    s.camera.copy(camera.position);
    s.drift = { x: drift.x, y: drift.y };
    puffs.forEach((p, i) => {
      s.dist[i] = wrapped(s.tmp, p, drift).distanceToSquared(camera.position);
    });
    s.order.sort((a, b) => s.dist[b] - s.dist[a]);
    const index = geometry.index;
    const arr = index.array;
    s.order.forEach((p, i) => {
      const b = p * 4;
      arr.set([b, b + 1, b + 2, b, b + 2, b + 3], i * 6);
    });
    index.needsUpdate = true;
  });

  return (
    <>
      <mesh
        name="cloudPuffs"
        geometry={geometry}
        material={material}
        frustumCulled={false}
        renderOrder={2}
        raycast={() => null}
        userData={{ isCloud: true }}
      />
      <mesh
        name="cloudPuffsDepth"
        geometry={geometry}
        material={depthMaterial}
        frustumCulled={false}
        renderOrder={3}
        raycast={() => null}
        userData={{ isCloud: true }}
      />
    </>
  );
}
