"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  BufferGeometry,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicNodeMaterial,
  Sphere,
  Vector3,
} from "three/webgpu";
import {
  Discard,
  Fn,
  If,
  abs,
  attribute,
  cameraPosition,
  cameraWorldMatrix,
  cos,
  dot,
  float,
  floor,
  fract,
  fwidth,
  length,
  max,
  mix,
  normalize,
  positionWorld,
  select,
  sin,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uKeyLightDirection, uWindDirection, uWindStrength } from "../uniforms";
import {
  GROUND_Y,
  TREES,
  aerial,
  analyticShadow,
  c3,
  gardenLight,
  gustField,
  leafShimmer,
  lin,
  mulberry32,
} from "./gardenCommon";

/*
 * Two old apple trees, fully procedural.
 *
 *  - Wood: gnarled trunk (Ø 30-38 cm, 1.3-1.7 m to the first fork) + 4-5
 *    scaffold limbs aimed at the crown's rim, sub-branches and twigs, built as
 *    tapered 7-sided tubes with vertex colours (bark + lichen). ONE merged
 *    mesh for both trees → 1 draw call.
 *  - Foliage: ~420 camera-facing leaf-cluster cards per tree (0.5-0.8 m), each
 *    drawn as six procedural pointed leaves (+ the odd apple) with an alpha
 *    cut-out. Volume shading from the crown centre, back-lit translucency,
 *    whole-crown sway + per-card flutter in TSL. 1 draw call.
 *
 * Trees are 5.6 m and 6.4 m tall with ~6.2-6.6 m wide crowns (see TREES), set
 * left-behind and right-behind the studio so they frame the intro shot and
 * show through the glass walls and the gable roof.
 */

function tree(t) {
  const rand = mulberry32(t.seed);
  const base = new Vector3(t.x, GROUND_Y - 0.05, t.z);
  const crownC = new Vector3(t.x, GROUND_Y + t.height - t.crown * 0.95, t.z);
  const limbs = []; // { pts: Vector3[], r0, r1 }
  const leafSpots = []; // { p: Vector3, r }

  // Trunk: slight lean and a kink.
  const trunkH = 1.3 + rand() * 0.4;
  const lean = new Vector3(rand() - 0.5, 0, rand() - 0.5).multiplyScalar(0.35);
  const trunkTop = base.clone().add(new Vector3(lean.x, trunkH, lean.z));
  const trunkMid = base.clone().lerp(trunkTop, 0.5).add(new Vector3((rand() - 0.5) * 0.15, 0, (rand() - 0.5) * 0.15));
  limbs.push({ pts: [base.clone().add(new Vector3(0, -0.1, 0)), trunkMid, trunkTop], r0: 0.19, r1: 0.15 });

  const scaffolds = 4 + Math.floor(rand() * 2);
  const az0 = rand() * Math.PI * 2;
  for (let i = 0; i < scaffolds; i++) {
    const az = az0 + (i / scaffolds) * Math.PI * 2 + (rand() - 0.5) * 0.6;
    const el = 0.15 + rand() * 0.55; // elevation of the target on the crown sphere
    const dir = new Vector3(Math.cos(az) * Math.cos(el), Math.sin(el), Math.sin(az) * Math.cos(el));
    const target = crownC.clone().addScaledVector(dir, t.crown * (0.62 + rand() * 0.15));
    const start = trunkTop.clone().add(new Vector3((rand() - 0.5) * 0.1, -rand() * 0.15, (rand() - 0.5) * 0.1));
    const ctrl = start.clone().lerp(target, 0.45).add(new Vector3(0, 0.35 + rand() * 0.3, 0));
    const pts = [];
    for (let k = 0; k <= 4; k++) {
      const s = k / 4;
      // Quadratic Bezier + a little gnarl.
      const a = start.clone().lerp(ctrl, s);
      const b = ctrl.clone().lerp(target, s);
      const p = a.lerp(b, s);
      if (k > 0 && k < 4) p.add(new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).multiplyScalar(0.12));
      pts.push(p);
    }
    limbs.push({ pts, r0: 0.11, r1: 0.045 });

    // Sub-branches from the outer half of the limb, arching out and down.
    const subs = 3 + Math.floor(rand() * 3);
    for (let j = 0; j < subs; j++) {
      const s = 0.4 + rand() * 0.6;
      const i0 = Math.min(3, Math.floor(s * 4));
      const from = pts[i0].clone().lerp(pts[i0 + 1], s * 4 - i0);
      const outward = from.clone().sub(crownC);
      outward.y *= 0.4;
      outward.normalize().add(new Vector3(rand() - 0.5, rand() * 0.6 - 0.1, rand() - 0.5).multiplyScalar(0.9)).normalize();
      const len = 0.7 + rand() * 0.9;
      const mid = from.clone().addScaledVector(outward, len * 0.55).add(new Vector3(0, 0.12, 0));
      const end = from.clone().addScaledVector(outward, len).add(new Vector3(0, -0.15 - rand() * 0.25, 0)); // droop
      limbs.push({ pts: [from, mid, end], r0: 0.045, r1: 0.015 });
      leafSpots.push({ p: end, r: 0.55 }, { p: mid, r: 0.45 });
      // Twigs.
      for (let q = 0; q < 2; q++) {
        const tw = mid.clone().lerp(end, rand());
        const td = new Vector3(rand() - 0.5, rand() * 0.8, rand() - 0.5).normalize();
        const te = tw.clone().addScaledVector(td, 0.35 + rand() * 0.3);
        limbs.push({ pts: [tw, te], r0: 0.016, r1: 0.006 });
        leafSpots.push({ p: te, r: 0.4 });
      }
    }
    leafSpots.push({ p: target, r: 0.7 });
  }
  return { limbs, leafSpots, crownC, crown: t.crown };
}

/** Tapered tube along a polyline (Catmull-ish subdivided), 7 sides. */
function pushTube(out, pts, r0, r1, rand) {
  const sides = 7;
  const segs = [];
  // Subdivide each span in 3 for smooth bends.
  for (let i = 0; i < pts.length - 1; i++) {
    for (let k = 0; k < 3; k++) segs.push(pts[i].clone().lerp(pts[i + 1], k / 3));
  }
  segs.push(pts[pts.length - 1].clone());
  const n = segs.length;
  const baseIndex = out.pos.length / 3;
  const up = new Vector3(0, 1, 0);
  const side = new Vector3();
  const bin = new Vector3();
  const tan = new Vector3();
  const bark = lin("#6c6155");
  const barkDark = lin("#4b433b");
  const lichen = lin("#93a07a");
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    tan.copy(segs[Math.min(i + 1, n - 1)]).sub(segs[Math.max(i - 1, 0)]).normalize();
    side.crossVectors(tan, Math.abs(tan.y) > 0.95 ? new Vector3(1, 0, 0) : up).normalize();
    bin.crossVectors(side, tan).normalize();
    const r = r0 + (r1 - r0) * t;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2;
      const gn = 1 + (rand() - 0.5) * 0.18; // gnarl
      const nx = Math.cos(a) * side.x + Math.sin(a) * bin.x;
      const ny = Math.cos(a) * side.y + Math.sin(a) * bin.y;
      const nz = Math.cos(a) * side.z + Math.sin(a) * bin.z;
      out.pos.push(segs[i].x + nx * r * gn, segs[i].y + ny * r * gn, segs[i].z + nz * r * gn);
      out.nrm.push(nx, ny, nz);
      const c = bark.clone().lerp(barkDark, rand() * 0.6);
      // Lichen on the upper side of the limbs.
      if (ny > 0.3 && rand() < 0.5) c.lerp(lichen, 0.35 + rand() * 0.3);
      out.col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < n - 1; i++) {
    for (let s = 0; s < sides; s++) {
      const a = baseIndex + i * sides + s;
      const b = baseIndex + i * sides + ((s + 1) % sides);
      const c = a + sides;
      const d = b + sides;
      out.idx.push(a, c, b, b, c, d);
    }
  }
}

function buildTrees(quality) {
  const wood = { pos: [], nrm: [], col: [], idx: [] };
  const cards = []; // x, y, z, size | cx, cy, cz, seed
  for (const t of TREES) {
    const { limbs, leafSpots, crownC, crown } = tree(t);
    const rand = mulberry32(t.seed * 7 + 1);
    for (const l of limbs) pushTube(wood, l.pts, l.r0, l.r1, rand);
    const perSpot = Math.round(13 * quality);
    for (const s of leafSpots) {
      for (let i = 0; i < perSpot; i++) {
        const d = new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize().multiplyScalar(Math.cbrt(rand()) * s.r);
        const p = s.p.clone().add(d);
        // Keep the crown roughly inside its ellipsoid.
        const off = p.clone().sub(crownC);
        const k = off.length() / (crown * 1.05);
        if (k > 1) p.copy(crownC).addScaledVector(off, 1 / k);
        cards.push(p.x, p.y, p.z, 0.6 + rand() * 0.3, crownC.x, crownC.y, crownC.z, rand());
      }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(wood.pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(wood.nrm), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(wood.col), 3));
  g.setIndex(wood.idx);
  g.computeBoundingSphere();

  const n = cards.length / 8;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    a.set(cards.slice(i * 8, i * 8 + 4), i * 4);
    b.set(cards.slice(i * 8 + 4, i * 8 + 8), i * 4);
  }
  const lg = new InstancedBufferGeometry();
  lg.setAttribute("position", new BufferAttribute(new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]), 3));
  lg.setIndex([0, 1, 2, 0, 2, 3]);
  lg.setAttribute("iCard", new InstancedBufferAttribute(a, 4));
  lg.setAttribute("iCrown", new InstancedBufferAttribute(b, 4));
  lg.instanceCount = n;
  lg.boundingSphere = new Sphere(new Vector3(0, 1, -3), 14);
  return { wood: g, leaves: lg, cards: n };
}

/** Lit vertex-colour material for static procedural geometry (wood, props). */
export function makeSolidMaterial(name) {
  const m = new MeshBasicNodeMaterial({ fog: false });
  m.name = name;
  const vN = varying(attribute("normal", "vec3"), "vSolidNormal");
  const vC = varying(attribute("color", "vec3"), "vSolidColor");
  m.colorNode = Fn(() => {
    const p = positionWorld;
    const toV = p.sub(cameraPosition);
    const dist = length(toV);
    const viewDir = toV.div(dist);
    const N = normalize(vN);
    // Contact darkening near the ground.
    const ao = mix(float(0.55), float(1), smoothstep(GROUND_Y, GROUND_Y + 0.35, p.y));
    const lit = gardenLight(vC, N, p, viewDir, analyticShadow(p), ao, float(0));
    return vec4(aerial(lit, dist, float(1)), 1);
  })();
  return m;
}

function makeLeafMaterial() {
  const m = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  m.name = "gardenLeaves";
  const iCard = attribute("iCard", "vec4");
  const iCrown = attribute("iCrown", "vec4");
  const corner = attribute("position", "vec3").xy;
  const seed = iCrown.w;
  const crownC = iCrown.xyz;

  // Whole-crown sway (slow gusts, a few cm) + soft per-card shimmer: a slow
  // travelling wave over the cards (periods 2.6-3.9 s), never per-card noise.
  const gust = gustField(crownC.xz);
  const height = iCard.y.sub(GROUND_Y).max(0);
  const sway = uWindStrength.mul(gust.mul(0.6).add(0.25)).mul(height.mul(0.016));
  const shim = leafShimmer(iCard.xz);
  const shimAmp = uWindStrength.add(0.15);
  const flutter = shim.mul(0.012).mul(shimAmp);
  const wd = vec3(uWindDirection.x, 0, uWindDirection.z);
  const center = iCard.xyz.add(wd.mul(sway.add(flutter))).add(vec3(0, shim.mul(0.006).mul(shimAmp), 0));

  // Camera-facing card, rotated in screen plane per card.
  const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz;
  const up = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz;
  const ang = seed.mul(6.283).add(shim.mul(0.05).mul(shimAmp));
  const c = cos(ang);
  const s = sin(ang);
  const rc = vec2(corner.x.mul(c).sub(corner.y.mul(s)), corner.x.mul(s).add(corner.y.mul(c)));
  const size = iCard.w.mul(0.5);
  const pos = center.add(right.mul(rc.x.mul(size))).add(up.mul(rc.y.mul(size)));
  m.positionNode = pos;

  // Per-vertex light: volume normal from the crown centre, self-shadow inside.
  const vLight = varying(
    Fn(() => {
      const toV = pos.sub(cameraPosition);
      const dist = length(toV);
      const viewDir = toV.div(dist);
      const fromC = pos.sub(crownC);
      const N = normalize(fromC.add(vec3(0, 0.4, 0)));
      const depth = length(fromC).div(3.2);
      const L = normalize(uKeyLightDirection);
      // Leaves facing away from the key light sit in the crown's own shadow.
      const self = smoothstep(-0.6, 0.5, dot(normalize(fromC), L)).mul(0.75).add(0.25);
      const ao = mix(float(0.35), float(1.05), smoothstep(0.3, 1.0, depth));
      return gardenLight(vec3(1), N, pos, viewDir, analyticShadow(pos).mul(self), ao, float(0.9));
    })(),
    "vLeafLight"
  );
  const vDist = varying(length(center.sub(cameraPosition)), "vLeafDist");
  const vUv = varying(corner, "vLeafUv");
  const vSeed = varying(seed, "vLeafSeed");

  m.colorNode = Fn(() => {
    const uv = vUv;
    // Real-scale apple leaves (7-10 cm): the card is split into ~11 cm cells,
    // each holding two pointed leaves with hashed angle/offset; the card
    // outline is ragged so clusters don't read as discs.
    const g = uv.mul(3.5);
    const cell = floor(g);
    const f = fract(g).sub(0.5);
    const hsh = (k) => fract(sin(dot(cell.add(vSeed.mul(17.3)).add(k), vec2(12.9898, 78.233))).mul(43758.5453));
    const h1 = hsh(0.0);
    const h2 = hsh(3.1);
    const h3 = hsh(7.7);
    let mask = float(0);
    let vein = float(0);
    for (let j = 0; j < 2; j++) {
      const a = h1.add(j * 0.37).mul(6.283);
      const d = vec2(cos(a), sin(a));
      const o = vec2(h2.sub(0.5), h3.sub(0.5)).mul(j === 0 ? 0.25 : -0.25);
      const q = f.sub(o);
      const x = dot(q, d);
      const y = dot(q, vec2(d.y.negate(), d.x));
      const len = float(0.42);
      const w = float(1).sub(x.div(len).mul(x.div(len))).max(0).mul(0.16);
      const inside = smoothstep(0.015, 0.0, abs(y).sub(w));
      mask = max(mask, inside);
      vein = max(vein, inside.mul(smoothstep(0.015, 0.0, abs(y))));
    }
    // Distance LOD: once a leaf cell drops below ~4 px, fill the gaps between
    // leaves so far crowns read as soft masses instead of sparkling noise.
    const cellsPerPx = max(fwidth(g).x, fwidth(g).y);
    const fill = smoothstep(0.12, 0.3, cellsPerPx);
    mask = max(mask, fill);
    const ragged = length(uv).add(h1.sub(0.5).mul(mix(float(0.35), float(0.2), fill)));
    If(mask.lessThan(0.5).or(ragged.greaterThan(0.95)), () => {
      Discard();
    });
    const leafA = c3("#5f8f4c");
    const leafB = c3("#86ad5f");
    const leafC = c3("#a3bf72");
    const h = fract(vSeed.mul(9.7).add(h2.mul(0.35)));
    const leaf = mix(mix(leafA, leafB, smoothstep(0.2, 0.6, h)), leafC, smoothstep(0.75, 1, h))
      .mul(float(1).sub(vein.mul(0.12)))
      .mul(h3.mul(0.18).add(0.88));
    // The odd apple (~7 cm) hanging in a cell.
    const appleMask = select(
      h3.greaterThan(0.965).and(fract(vSeed.mul(53.1)).greaterThan(0.55)),
      smoothstep(0.34, 0.3, length(f)),
      float(0)
    );
    const apple = mix(c3("#d9604f"), c3("#e6c45c"), h2.mul(0.6));
    const col = mix(leaf, apple, appleMask);
    return vec4(aerial(col.mul(vLight), vDist, float(1)), 1);
  })();
  return m;
}

export default function Trees({ quality = 1 }) {
  const built = useMemo(() => buildTrees(quality), [quality]);
  const woodMat = useMemo(() => makeSolidMaterial("gardenTreeWood"), []);
  const leafMat = useMemo(makeLeafMaterial, []);
  useEffect(
    () => () => {
      built.wood.dispose();
      built.leaves.dispose();
    },
    [built]
  );
  return (
    <>
      {/* castShadow: the key light's shadow map (lighting/) dapples the studio
          through the roof. Leaf cards face the shadow camera in the shadow pass
          and colorNode's Discard() alpha-cuts them there too. */}
      <mesh name="gardenTreeWood" geometry={built.wood} material={woodMat} raycast={() => null} castShadow />
      <mesh
        name="gardenLeaves"
        castShadow
        geometry={built.leaves}
        material={leafMat}
        frustumCulled={false}
        raycast={() => null}
      />
    </>
  );
}
