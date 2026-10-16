"use client";

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry, MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  abs,
  attribute,
  cameraPosition,
  float,
  length,
  max,
  mix,
  normalize,
  positionWorld,
  smoothstep,
  vec2,
  vec3,
  vec4,
  varying,
} from "three/tsl";
import { uNightFactor, uSkyHorizon } from "../uniforms";
import {
  GROUND_Y,
  PATH,
  STUDIO,
  aerial,
  analyticShadow,
  fbm,
  gardenLight,
  lin,
  c3,
  mulberry32,
  noiseTex,
  terrainHeight,
} from "./gardenCommon";

/*
 * Ground + horizon.
 *
 *  - Ground: one polar-grid mesh (fine rings near the studio, exponentially
 *    coarser out to 900 m), heights from terrainHeight(). The fragment shader
 *    paints meadow / mown lawn / gravel path / drip-strip gravel procedurally,
 *    lit with the shared garden lighting + analytic shadows. 1 draw call.
 *  - Horizon: nested silhouette rings (hedgerow tree lines at ~80-130 m,
 *    hills at 260-680 m) in ONE geometry, shaded flat and drowned in aerial
 *    perspective so there is no edge anywhere. 1 draw call.
 */

const CENTER_Z = 2;

function buildGround() {
  const radii = [0];
  for (let i = 1; i <= 36; i++) radii.push(i * 0.5); // 0.5 m rings to 18 m
  while (radii[radii.length - 1] < 900) radii.push(radii[radii.length - 1] * 1.065);
  const seg = 160;
  const rings = radii.length;
  const pos = new Float32Array(rings * seg * 3);
  const nrm = new Float32Array(rings * seg * 3);
  const e = 0.5;
  for (let r = 0; r < rings; r++) {
    for (let s = 0; s < seg; s++) {
      // Offset every other ring by half a segment -> nicer triangles.
      const a = ((s + (r % 2) * 0.5) / seg) * Math.PI * 2;
      const x = Math.cos(a) * radii[r];
      const z = Math.sin(a) * radii[r] + CENTER_Z;
      const y = terrainHeight(x, z);
      const k = (r * seg + s) * 3;
      pos[k] = x;
      pos[k + 1] = y;
      pos[k + 2] = z;
      const hx = terrainHeight(x + e, z) - terrainHeight(x - e, z);
      const hz = terrainHeight(x, z + e) - terrainHeight(x, z - e);
      const l = Math.hypot(hx, 2 * e, hz);
      nrm[k] = -hx / l;
      nrm[k + 1] = (2 * e) / l;
      nrm[k + 2] = -hz / l;
    }
  }
  const idx = [];
  for (let r = 0; r < rings - 1; r++) {
    for (let s = 0; s < seg; s++) {
      const a = r * seg + s;
      const b = r * seg + ((s + 1) % seg);
      const c = (r + 1) * seg + s;
      const d = (r + 1) * seg + ((s + 1) % seg);
      idx.push(a, b, c, b, d, c);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(pos, 3));
  g.setAttribute("normal", new BufferAttribute(nrm, 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

// [radius, height, roughness, colour, bottom fog weight]
const LAYERS = [
  { r: 88, h: 13, bump: 1, color: "#4c6a46", fog: 1.0, wobble: 22, seed: 3 }, // hedgerow / tree line
  { r: 140, h: 17, bump: 1, color: "#577558", fog: 1.0, wobble: 35, seed: 8 }, // second tree line
  { r: 290, h: 34, bump: 0.25, color: "#6f8a6c", fog: 1.05, wobble: 60, seed: 13 },
  { r: 470, h: 58, bump: 0.15, color: "#7f9580", fog: 1.1, wobble: 90, seed: 17 },
  { r: 690, h: 82, bump: 0.1, color: "#8fa293", fog: 1.15, wobble: 120, seed: 29 },
];

function buildHills() {
  const seg = 720;
  const pos = [];
  const col = [];
  const nrm = [];
  const idx = [];
  let base = 0;
  for (const L of LAYERS) {
    const c = lin(L.color);
    const rand = mulberry32(L.seed);
    const gapStart = rand() * Math.PI * 2;
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      const u = s / seg;
      const r = L.r + (fbm(u * 6, L.seed, 3, L.seed) - 0.5) * 2 * L.wobble;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r + CENTER_Z;
      // Silhouette: broad rolling profile + tree-crown bumps for the hedgerows.
      const broad = fbm(u * 9 + L.seed, 0.5, 4, L.seed + 1);
      const crowns = fbm(u * 300 + L.seed, 1.5, 2, L.seed + 2);
      // Tree lines have gaps where fields open up.
      let h = L.h * (0.35 + broad * 0.9) + L.bump * crowns * L.h * 0.55;
      if (L.bump >= 1) {
        const gap = 0.5 + 0.5 * Math.cos(a * 3 + gapStart);
        h *= 0.15 + 0.85 * Math.min(1, Math.max(0, (fbm(u * 18, 3, 2, L.seed + 5) - 0.32) * 4)) * (0.6 + 0.4 * gap);
      }
      const yTop = GROUND_Y + h + Math.max(0, terrainHeight(x, z) - GROUND_Y) * 0.6;
      const yBot = GROUND_Y - 25;
      const nx = Math.cos(a);
      const nz = Math.sin(a);
      pos.push(x, yBot, z, x, yTop, z);
      // Normals tilt towards the centre (we look at the inside of the ring) and up.
      nrm.push(-nx * 0.6, 0.8, -nz * 0.6, -nx * 0.45, 0.9, -nz * 0.45);
      col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (s < seg) {
        const i = base + s * 2;
        idx.push(i, i + 2, i + 1, i + 1, i + 2, i + 3);
      }
    }
    base += (seg + 1) * 2;
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nrm), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setIndex(idx);
  g.computeBoundingSphere();
  return g;
}

/** Path centre x(z) in TSL (mirror of pathX in gardenCommon.js). */
const pathXNode = (z) => {
  const t = z.sub(5.5).div(3).clamp(0, 1);
  return z.sub(5.5).mul(0.36).sin().mul(0.28).mul(t.mul(t).mul(float(3).sub(t.mul(2))));
};

function makeGroundMaterial() {
  const m = new MeshBasicNodeMaterial({ fog: false });
  m.name = "gardenGround";
  const vNormal = varying(attribute("normal", "vec3"), "vGroundNormal");
  const noise = noiseTex();

  m.colorNode = Fn(() => {
    const p = positionWorld;
    const toFrag = p.sub(cameraPosition);
    const dist = length(toFrag);
    const viewDir = toFrag.div(dist);

    // Meadow albedo: broad colour patches, dry straw spots, fine speckle.
    const n1 = noise.sample(p.xz.mul(0.045)).r;
    const n2 = noise.sample(p.xz.mul(0.31)).b;
    const n3 = noise.sample(p.xz.mul(2.2)).a;
    const meadowDark = c3("#3f5f2c");
    const meadowLight = c3("#7d9f55");
    const straw = c3("#b3a466");
    let grass = mix(meadowDark, meadowLight, smoothstep(0.25, 0.8, n1.mul(0.7).add(n2.mul(0.3))));
    grass = mix(grass, straw, smoothstep(0.62, 0.85, n2).mul(0.45));
    grass = grass.mul(n3.mul(0.25).add(0.85));

    // Gravel: path + drip strip around the studio.
    const gravelA = c3("#c9bfae");
    const gravelB = c3("#9d9282");
    const pebble = noise.sample(p.xz.mul(9.0)).a;
    const pebble2 = noise.sample(p.xz.mul(23.0).add(0.3)).g;
    const gravel = mix(gravelB, gravelA, smoothstep(0.3, 0.75, pebble.mul(0.6).add(pebble2.mul(0.4))));

    const inPathZ = smoothstep(PATH.zStart - 0.25, PATH.zStart, p.z).mul(smoothstep(PATH.zEnd, PATH.zEnd - 1, p.z));
    const edgeWobble = n3.sub(0.5).mul(0.12);
    const pathD = abs(p.x.sub(pathXNode(p.z))).add(edgeWobble);
    const onPath = smoothstep(PATH.halfWidth + 0.04, PATH.halfWidth - 0.06, pathD).mul(inPathZ);
    const dx = max(abs(p.x).sub(STUDIO.x), 0);
    const dz = max(max(p.z.sub(STUDIO.zMax), float(STUDIO.zMin).sub(p.z)), 0);
    const sd = length(vec2(dx, dz)).add(edgeWobble.mul(0.5));
    const onDrip = smoothstep(0.38, 0.3, sd);
    const gravelMask = max(onPath, onDrip);

    // Soil/thatch darkening at the gravel edge (grass roots, shade).
    const edge = smoothstep(0.0, 0.25, max(pathD.sub(PATH.halfWidth).mul(inPathZ).add(float(1).sub(inPathZ).mul(9)), sd.sub(0.38)).abs());
    grass = grass.mul(edge.mul(0.25).add(0.75));

    const albedo = mix(grass, gravel, gravelMask).toVar();

    const N = normalize(vNormal);
    const shadow = analyticShadow(p);
    const lit = gardenLight(albedo, N, p, viewDir, shadow, float(0.85), float(0));

    // Distance haze + a little extra towards the horizon on rolling land.
    const out = aerial(lit, dist, float(1));
    return vec4(out, 1);
  })();
  return m;
}

function makeHillsMaterial() {
  const m = new MeshBasicNodeMaterial({ fog: false, vertexColors: true });
  m.name = "gardenHills";
  const vNormal = varying(attribute("normal", "vec3"), "vHillNormal");
  const vColor = varying(attribute("color", "vec3"), "vHillColor");
  m.colorNode = Fn(() => {
    const p = positionWorld;
    const toFrag = p.sub(cameraPosition);
    const dist = length(toFrag);
    const viewDir = toFrag.div(dist);
    const N = normalize(vNormal);
    // Subtle vertical texture: darker toward the base of tree lines.
    const hgt = smoothstep(GROUND_Y - 2, GROUND_Y + 14, p.y);
    const albedo = vColor.mul(mix(float(0.75), float(1.05), hgt));
    const lit = gardenLight(albedo, N, p, viewDir, float(1), float(1), float(0.2));
    // Strong aerial perspective; the far ridges almost melt into the sky.
    const haze = aerial(lit, dist, float(1.25));
    // Below the visible top the ring continues down: blend low parts into the horizon haze.
    const low = smoothstep(GROUND_Y + 1, GROUND_Y - 6, p.y);
    return vec4(mix(haze, uSkyHorizon.mul(mix(float(0.9), float(0.7), uNightFactor)), low.mul(0.6)), 1);
  })();
  return m;
}

export default function Terrain({ hills = true }) {
  const ground = useMemo(buildGround, []);
  const groundMat = useMemo(makeGroundMaterial, []);
  const hillGeo = useMemo(buildHills, []);
  const hillMat = useMemo(makeHillsMaterial, []);
  return (
    <>
      <mesh
        name="gardenGround"
        geometry={ground}
        material={groundMat}
        frustumCulled={false}
        raycast={() => null}
      />
      {hills && (
        <mesh
          name="gardenHills"
          geometry={hillGeo}
          material={hillMat}
          frustumCulled={false}
          raycast={() => null}
        />
      )}
    </>
  );
}
