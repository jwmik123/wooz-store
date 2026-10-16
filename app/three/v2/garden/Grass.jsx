"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicNodeMaterial,
  Sphere,
  Vector3,
} from "three/webgpu";
import {
  Fn,
  attribute,
  cameraPosition,
  cos,
  dot,
  float,
  fract,
  length,
  mix,
  normalize,
  pow,
  select,
  sin,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  BORDERS,
  aerial,
  analyticShadow,
  bendOffset,
  c3,
  gardenLight,
  isBlocked,
  minWidthScale,
  mownAmount,
  mulberry32,
  pathX,
  studioDistance,
  terrainHeight,
  wildness,
  TREES,
  FENCE,
  fenceDistance,
  windLean,
} from "./gardenCommon";

/*
 * Meadow grass: instanced TUFTS (a few curved blades each), two LODs.
 *
 *   near  5 blades × 3 segments (35 verts) — within ~9 m of the studio and
 *         along the path towards the intro camera, ~36-62 tufts/m².
 *   far   4 blades × 1 segment (12 verts), wider blades, out to ~42 m.
 *
 * Real scale: wild meadow 15-45 cm (patches to ~55 cm), mown strips along the
 * path and around the studio 4-8 cm. Blade width 1.1-1.8 cm near, widened with
 * distance so a blade never falls below ~1.5 px (no shimmer).
 *
 * All animation and lighting runs in the vertex shader (per-vertex Lambert +
 * back-light translucency + analytic studio/tree shadows + aerial perspective);
 * the fragment shader only outputs the interpolated colour → opaque, early-Z
 * friendly, no discard. Wind = travelling gust waves (noise texture scrolled
 * along uWindDirection) + per-blade flutter, scaled by uWindStrength.
 * Chunked into ground tiles (frustum-culled draws), no per-frame CPU work.
 */

const NEAR = { blades: 5, segments: 3 };
const FAR = { blades: 4, segments: 1 };

/** Tuft geometry: blades around a small root circle, unit height. */
function buildTuft({ blades, segments }, seed) {
  const rand = mulberry32(seed);
  const vertsPerBlade = segments * 2 + 1;
  const n = blades * vertsPerBlade;
  const root = new Float32Array(n * 4); // rootX, rootZ, facing angle, blade seed
  const shape = new Float32Array(n * 4); // t (0..1), side (-1..1), blade height, curl
  const index = [];
  for (let b = 0; b < blades; b++) {
    const ra = rand() * Math.PI * 2;
    const rr = Math.sqrt(rand()) * 0.055;
    const rx = Math.cos(ra) * rr;
    const rz = Math.sin(ra) * rr;
    const facing = rand() * Math.PI * 2;
    const bseed = rand();
    const bh = 0.62 + rand() * 0.38;
    const curl = 0.12 + rand() * 0.38;
    const base = b * vertsPerBlade;
    for (let v = 0; v < vertsPerBlade; v++) {
      const k = (base + v) * 4;
      const isTip = v === vertsPerBlade - 1;
      const level = isTip ? segments : Math.floor(v / 2);
      const t = level / segments;
      const side = isTip ? 0 : v % 2 === 0 ? -1 : 1;
      root.set([rx, rz, facing, bseed], k);
      shape.set([t, side, bh, curl], k);
    }
    for (let s = 0; s < segments - 1; s++) {
      const a = base + s * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const a = base + (segments - 1) * 2;
    index.push(a, a + 1, base + vertsPerBlade - 1);
  }
  const g = new InstancedBufferGeometry();
  // `position` is required by the renderer; the real position comes from positionNode.
  g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("root", new BufferAttribute(root, 4));
  g.setAttribute("shape", new BufferAttribute(shape, 4));
  g.setIndex(index);
  return g;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/** Distance to the corridor between the studio front and the intro camera. */
function corridorDistance(x, z) {
  const zc = Math.min(Math.max(z, 3), 21);
  return Math.hypot(x - pathX(zc), z - zc);
}

/**
 * Scatter tufts over 1 m cells within 42 m. Returns { near, far } Float32Arrays
 * of [x, y, z, rotY] and [height, width, seed, straw] per tuft (shuffled so a
 * density slider can simply lower instanceCount).
 */
function scatter(scale) {
  const rand = mulberry32(1234);
  const near = [];
  const far = [];
  const R = 42;
  for (let cz = -R; cz < R; cz++) {
    for (let cx = -R; cx < R; cx++) {
      const mx = cx + 0.5;
      const mz = cz + 0.5;
      const r = Math.hypot(mx, mz - 2);
      if (r > R) continue;
      const ds = studioDistance(mx, mz);
      const dc = corridorDistance(mx, mz);
      const isNear = ds < 9 || dc < 5.5;
      // tufts per m²
      const rho = isNear
        ? 36 + 26 * (1 - smooth(2, 8, Math.min(ds, dc)))
        : 14 * (1 - smooth(14, R, r)) + 2.5;
      const count = Math.floor(rho * scale + rand());
      for (let i = 0; i < count; i++) {
        const x = cx + rand();
        const z = cz + rand();
        if (isBlocked(x, z)) continue;
        const mown = mownAmount(x, z);
        const wild = wildness(x, z);
        const outside = smooth(0, 2, -fenceDistanceSigned(x, z));
        let underTree = 0;
        for (const t of TREES) underTree = Math.max(underTree, 1 - smooth(1.2, 3.2, Math.hypot(x - t.x, z - t.z)));
        let h = 0.14 + 0.3 * Math.pow(wild, 1.3) + rand() * 0.1;
        h += outside * 0.08;
        if (wild > 0.62 && rand() < 0.35) h += 0.08 + rand() * 0.06; // tall patches
        h *= 1 - underTree * 0.35;
        const mownH = 0.045 + rand() * 0.035;
        h = h + (mownH - h) * mown;
        const y = terrainHeight(x, z);
        const straw = Math.max(0, Math.min(1, (wild - 0.52) * 2.2 + (rand() - 0.5) * 0.5)) * (1 - mown) * (rand() < 0.45 ? 0.9 : 0.25);
        const width = isNear ? 0.011 + rand() * 0.007 : 0.022 + rand() * 0.01;
        (isNear ? near : far).push(x, y, z, rand() * Math.PI * 2, h, width, rand(), straw);
      }
    }
  }
  // Border foliage: grey-green lavender mounds and broad foxglove rosettes
  // (flag 2 / 3 in the colour slot).
  if (scale > 0) {
    for (const [cx, cz] of BORDERS.lavender) {
      for (let i = 0; i < 11; i++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * 0.2;
        const x = cx + Math.cos(a) * r;
        const z = cz + Math.sin(a) * r;
        near.push(x, terrainHeight(x, z), z, rand() * Math.PI * 2, 0.2 + (1 - r / 0.2) * 0.1 + rand() * 0.04, 0.007 + rand() * 0.003, rand(), 2);
      }
    }
    for (const [cx, cz] of BORDERS.foxglove) {
      for (let i = 0; i < 2; i++) {
        const x = cx + (rand() - 0.5) * 0.12;
        const z = cz + (rand() - 0.5) * 0.12;
        near.push(x, terrainHeight(x, z), z, rand() * Math.PI * 2, 0.24 + rand() * 0.1, 0.045 + rand() * 0.015, rand(), 3);
      }
    }
  }

  const pack = (arr) => {
    const n = arr.length / 8;
    // Fisher-Yates over tufts.
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      for (let k = 0; k < 8; k++) {
        const t = arr[i * 8 + k];
        arr[i * 8 + k] = arr[j * 8 + k];
        arr[j * 8 + k] = t;
      }
    }
    const pos = new Float32Array(n * 4);
    const par = new Float32Array(n * 4);
    for (let i = 0; i < n; i++) {
      pos.set(arr.slice(i * 8, i * 8 + 4), i * 4);
      par.set(arr.slice(i * 8 + 4, i * 8 + 8), i * 4);
    }
    return { pos, par, count: n };
  };
  return { near: pack(near), far: pack(far) };
}

/** >0 outside the fence, <0 inside (approximate, for grass height). */
function fenceDistanceSigned(x, z) {
  const d = fenceDistance(x, z);
  const cz = (FENCE.zMin + FENCE.zMax) / 2;
  const inside = Math.abs(x) < FENCE.xHalf && Math.abs(z - cz) < (FENCE.zMax - FENCE.zMin) / 2;
  return inside ? -d : d;
}

export function makeGrassMaterial() {
  const m = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  m.name = "gardenGrass";

  const iPos = attribute("iPos", "vec4");
  const iPar = attribute("iPar", "vec4");
  const aRoot = attribute("root", "vec4");
  const aShape = attribute("shape", "vec4");

  const H = iPar.x.mul(aShape.z);
  const t = aShape.x;
  const seed = iPar.z;

  // Tuft rotation.
  const rc = cos(iPos.w);
  const rs = sin(iPos.w);
  const rot = (v) => vec2(v.x.mul(rc).sub(v.y.mul(rs)), v.x.mul(rs).add(v.y.mul(rc)));

  const facing = aRoot.z.add(iPos.w);
  const across = vec2(cos(facing), sin(facing));
  const faceN2 = vec2(across.y.negate(), across.x);

  const rootXZ = iPos.xz.add(rot(aRoot.xy));
  const distCam = length(vec3(rootXZ.x, iPos.y, rootXZ.y).sub(cameraPosition));

  // Width: tapered towards the tip, guarded against sub-pixel blades.
  // Distance LOD: beyond ~9 m up to 45 % of the blades collapse to zero area
  // (culled before raster: thin far triangles are the expensive part) and the
  // remaining ones widen to keep the coverage.
  const lod = smoothstep(9, 15, distCam);
  const keep = select(aRoot.w.greaterThan(lod.mul(0.45)), float(1), float(0));
  const W = iPar.y.mul(minWidthScale(iPar.y, distCam)).mul(lod.mul(0.45).add(1)).mul(keep);
  const taper = float(1).sub(pow(t, 1.6));
  const halfW = W.mul(taper).mul(0.5);

  // Rest pose: blade curls along its facing normal, more for tall blades.
  const curl = aShape.w.mul(smoothstep(0.08, 0.3, iPar.x));
  const curlDir = faceN2.mul(select(fract(aRoot.w.mul(13.7)).greaterThan(0.5), 1, -1));
  const restXZ = curlDir.mul(curl.mul(t).mul(t).mul(H));
  const restY = t.mul(H).mul(float(1).sub(curl.mul(curl).mul(t).mul(0.35)));

  // Wind: stiffer short (mown) grass, gusts travel across the meadow.
  const stiff = mix(float(2.6), float(1), smoothstep(0.06, 0.3, iPar.x));
  const lean = windLean(rootXZ, seed.add(aRoot.w.mul(0.3)), stiff);
  const wind = bendOffset(lean.xy, t.mul(H), H);

  const local = vec3(
    rootXZ.x.add(across.x.mul(aShape.y.mul(halfW))).add(restXZ.x),
    iPos.y.add(restY),
    rootXZ.y.add(across.y.mul(aShape.y.mul(halfW))).add(restXZ.y)
  ).add(wind);

  m.positionNode = local;

  // Per-vertex shading (→ varying).
  const shade = Fn(() => {
    const P = local;
    const toV = P.sub(cameraPosition);
    const dist = length(toV);
    const viewDir = toV.div(dist);
    // Blade normal: face normal tilted by the lean, flipped towards the viewer,
    // blended with "up" (a tuft reads as a soft volume, not flat cards).
    const bend = lean.xy.mul(t);
    let n = normalize(vec3(faceN2.x, curl.mul(t).mul(0.8).add(dot(bend, faceN2).mul(-1)), faceN2.y));
    n = select(dot(n, viewDir).greaterThan(0), n.negate(), n);
    const N = normalize(mix(n, vec3(0, 1, 0), 0.55));

    // Colour: dark base → tip, per-tuft pastel greens + dry straw.
    const hue = fract(seed.mul(7.13));
    const tipA = c3("#9ec27a");
    const tipB = c3("#b9cf86");
    const tipC = c3("#86b46c");
    const tip = mix(mix(tipA, tipB, smoothstep(0.3, 0.7, hue)), tipC, smoothstep(0.75, 1, hue));
    const strawTip = c3("#d9c88c");
    const baseC = c3("#3b5a2a");
    const tipCol = select(
      iPar.w.greaterThan(2.5),
      c3("#5f8a4a"),
      select(iPar.w.greaterThan(1.5), c3("#9fb39a"), mix(tip, strawTip, iPar.w.min(1)))
    );
    const albedo = mix(baseC, tipCol, smoothstep(0.0, 0.85, t));
    // Mown grass is fresher and a bit brighter.
    const mownTint = smoothstep(0.12, 0.05, iPar.x);
    const alb = mix(albedo, albedo.mul(vec3(1.0, 1.08, 0.92)), mownTint);

    const ao = mix(float(0.35), float(1.05), smoothstep(0, 0.9, t));
    const shadow = analyticShadow(P);
    const lit = gardenLight(alb, N, P, viewDir, shadow, ao, t.mul(0.9));
    // Gust highlight: blades bent by a gust flash their lighter undersides.
    const sheen = lean.z.mul(t).mul(0.08);
    return aerial(lit.mul(sheen.add(1)), dist, float(1));
  });

  m.colorNode = vec4(varying(shade(), "vGrassColor"), 1);
  return m;
}

/**
 * Split the scattered tufts into square ground chunks (each its own instanced
 * draw with a tight bounding sphere) so the renderer frustum-culls the grass
 * behind / beside the camera. Inside the studio that skips roughly half of the
 * ~1M grass vertices; the extra draw calls are cheap.
 */
function chunkTufts(data, size) {
  const cells = new Map();
  for (let i = 0; i < data.count; i++) {
    const key = `${Math.floor(data.pos[i * 4] / size)},${Math.floor(data.pos[i * 4 + 2] / size)}`;
    let c = cells.get(key);
    if (!c) cells.set(key, (c = []));
    c.push(i); // keeps the global shuffle order → density = instanceCount prefix
  }
  const chunks = [];
  for (const idx of cells.values()) {
    const pos = new Float32Array(idx.length * 4);
    const par = new Float32Array(idx.length * 4);
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    idx.forEach((src, j) => {
      pos.set(data.pos.subarray(src * 4, src * 4 + 4), j * 4);
      par.set(data.par.subarray(src * 4, src * 4 + 4), j * 4);
      const x = data.pos[src * 4], y = data.pos[src * 4 + 1], z = data.pos[src * 4 + 2];
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
      minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z);
    });
    // Margin: blade height (≤ ~0.7 m) + wind lean + tuft radius.
    const center = new Vector3((minX + maxX) / 2, (minY + maxY) / 2 + 0.35, (minZ + maxZ) / 2);
    const radius = Math.hypot(maxX - minX, maxY - minY + 0.7, maxZ - minZ) / 2 + 0.8;
    chunks.push({ pos, par, count: idx.length, sphere: new Sphere(center, radius) });
  }
  return chunks;
}

function useGrassChunks(spec, data, density, chunkSize) {
  const geometries = useMemo(() => {
    const tuft = buildTuft(spec, spec === NEAR ? 11 : 23);
    return chunkTufts(data, chunkSize).map((c) => {
      const g = new InstancedBufferGeometry();
      g.setIndex(tuft.index);
      for (const name of ["position", "root", "shape"]) g.setAttribute(name, tuft.attributes[name]);
      g.setAttribute("iPos", new InstancedBufferAttribute(c.pos, 4));
      g.setAttribute("iPar", new InstancedBufferAttribute(c.par, 4));
      g.instanceCount = c.count;
      g.userData.count = c.count;
      g.boundingSphere = c.sphere;
      return g;
    });
  }, [spec, data, chunkSize]);
  useEffect(() => {
    for (const g of geometries) g.instanceCount = Math.floor(g.userData.count * density);
  }, [geometries, density]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  return geometries;
}

function GrassChunks({ name, geometries, material }) {
  return (
    <group name={name}>
      {geometries.map((g, i) => (
        <mesh
          key={i}
          geometry={g}
          material={material}
          renderOrder={-1}
          raycast={() => null}
        />
      ))}
    </group>
  );
}

export default function Grass({ quality = 1, density = 1, far = true }) {
  const data = useMemo(() => scatter(quality), [quality]);
  const material = useMemo(makeGrassMaterial, []);
  const nearGeos = useGrassChunks(NEAR, data.near, density, 6);
  const farGeos = useGrassChunks(FAR, data.far, density, 14);

  useEffect(() => {
    if (typeof window !== "undefined" && process.env.NODE_ENV === "development")
      console.info(
        `[garden] grass tufts near ${data.near.count} (${nearGeos.length} chunks), far ${data.far.count} (${farGeos.length} chunks)`
      );
  }, [data, nearGeos, farGeos]);

  return (
    <>
      <GrassChunks name="gardenGrassNear" geometries={nearGeos} material={material} />
      {far && <GrassChunks name="gardenGrassFar" geometries={farGeos} material={material} />}
    </>
  );
}
