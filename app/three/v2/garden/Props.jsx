"use client";

import { useEffect, useMemo } from "react";
import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  Euler,
  ExtrudeGeometry,
  Matrix4,
  Quaternion,
  Shape,
  SphereGeometry,
  TorusGeometry,
  Vector3,
} from "three/webgpu";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  FENCE,
  GATE_HALF_WIDTH,
  GROUND_Y,
  PATH,
  STUDIO,
  fencePoints,
  isInGate,
  lin,
  mulberry32,
  pathX,
  terrainHeight,
} from "./gardenCommon";
import { makeSolidMaterial } from "./Trees";

/*
 * Static garden props, merged into ONE vertex-coloured mesh (1 draw call),
 * all at real dimensions:
 *
 *  - stone plinth course under the studio slab (9 cm high, 12 cm deep blocks)
 *    and a 1.4 × 0.45 m stone threshold step at the open front;
 *  - stepping stones down the gravel path (≈ 42 × 34 cm, every ~62 cm);
 *  - a weathered white picket fence (82 cm, 7 cm pickets at 12 cm pitch,
 *    posts every ~2 m) around the garden, with an open gate where the path
 *    leaves the garden;
 *  - a wooden garden bench (1.5 m wide, seat 45 cm, back 85 cm);
 *  - a galvanised 10 l watering can by the step;
 *  - a pastel Dutch city bike (28" wheels, 1.12 m wheelbase) with a wicker
 *    basket, leaning against the east glass wall.
 */

const _m = new Matrix4();
const _q = new Quaternion();
const _e = new Euler();
const _s = new Vector3();
const _p = new Vector3();

class Builder {
  constructor() {
    this.parts = [];
  }
  /** Add a geometry with a transform and a flat (linear) colour. */
  add(geo, { pos = [0, 0, 0], rot = [0, 0, 0], scale = [1, 1, 1], color, matrix } = {}) {
    let g = geo.index ? geo.toNonIndexed() : geo;
    if (g === geo) g = geo.clone();
    g.deleteAttribute("uv");
    if (g.attributes.uv1) g.deleteAttribute("uv1");
    const m =
      matrix ??
      _m.compose(_p.set(...pos), _q.setFromEuler(_e.set(...rot)), _s.set(...scale));
    g.applyMatrix4(m);
    const n = g.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], i * 3);
    g.setAttribute("color", new BufferAttribute(col, 3));
    this.parts.push(g);
    return g;
  }
  build() {
    const merged = mergeGeometries(this.parts, false);
    this.parts.forEach((p) => p.dispose());
    merged.computeBoundingSphere();
    return merged;
  }
}

/** Tube between two points (cylinder with `sides`). */
function rod(b, a, c, r, color, sides = 6, parent) {
  const A = new Vector3(...a);
  const C = new Vector3(...c);
  const len = A.distanceTo(C);
  const geo = new CylinderGeometry(r, r, len, sides, 1, false);
  const mid = A.clone().add(C).multiplyScalar(0.5);
  const q = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), C.clone().sub(A).normalize());
  const m = new Matrix4().compose(mid, q, new Vector3(1, 1, 1));
  if (parent) m.premultiply(parent);
  b.add(geo, { color, matrix: m });
  geo.dispose();
}

function box(b, size, color, { pos, rot, parent } = {}) {
  const geo = new BoxGeometry(...size);
  const m = new Matrix4().compose(new Vector3(...(pos ?? [0, 0, 0])), new Quaternion().setFromEuler(new Euler(...(rot ?? [0, 0, 0]))), new Vector3(1, 1, 1));
  if (parent) m.premultiply(parent);
  b.add(geo, { color, matrix: m });
  geo.dispose();
}

const tint = (hex, rand, amount = 0.12) => {
  const c = lin(hex);
  const k = 1 + (rand() - 0.5) * 2 * amount;
  return c.multiplyScalar(k);
};

// --- Pieces -------------------------------------------------------------------

function plinthAndStep(b, rand) {
  const top = -1.95;
  const bottom = GROUND_Y - 0.03;
  const h = top - bottom;
  const depth = 0.12;
  const out = 0.05;
  const course = (x0, z0, x1, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const dirx = (x1 - x0) / len;
    const dirz = (z1 - z0) / len;
    let s = 0;
    while (s < len - 0.05) {
      const l = Math.min(0.32 + rand() * 0.2, len - s);
      const cx = x0 + dirx * (s + l / 2);
      const cz = z0 + dirz * (s + l / 2);
      const hh = h + (rand() - 0.5) * 0.015;
      box(b, [l - 0.012, hh, depth], tint("#b9b0a2", rand, 0.1), {
        pos: [cx, bottom + hh / 2, cz],
        rot: [0, -Math.atan2(dirz, dirx), 0],
      });
      s += l;
    }
  };
  const X = STUDIO.x + out - depth / 2;
  const Z0 = STUDIO.zMin - out + depth / 2;
  const Z1 = STUDIO.zMax + out - depth / 2;
  course(-X, Z0, -X, Z1); // west
  course(X, Z0, X, Z1); // east
  course(-X - depth / 2, Z0, X + depth / 2, Z0); // back
  // Front: corners either side of the threshold step.
  course(-X - depth / 2, Z1, -0.72, Z1);
  course(0.72, Z1, X + depth / 2, Z1);
  // Threshold step: one big worn slab.
  box(b, [1.44, 0.11, 0.46], lin("#c4bcaf"), { pos: [0, -1.94 - 0.055, STUDIO.zMax + 0.2] });
}

function steppingStones(b, rand) {
  const stone = new CylinderGeometry(1, 1, 1, 9, 1);
  // Jitter the rim so every stone is irregular.
  for (let z = PATH.zStart + 0.75; z < PATH.zEnd - 0.4; z += 0.58 + rand() * 0.1) {
    const x = pathX(z) + (rand() - 0.5) * 0.08;
    const y = terrainHeight(x, z) + 0.012;
    b.add(stone, {
      pos: [x, y, z],
      rot: [0, rand() * Math.PI, 0],
      scale: [0.2 + rand() * 0.04, 0.05, 0.16 + rand() * 0.04],
      color: tint("#bdb6aa", rand, 0.14),
    });
  }
  stone.dispose();
}

function picketGeometry() {
  const w = 0.07;
  const h = FENCE.height;
  const s = new Shape();
  s.moveTo(-w / 2, 0);
  s.lineTo(w / 2, 0);
  s.lineTo(w / 2, h - 0.05);
  s.lineTo(0, h);
  s.lineTo(-w / 2, h - 0.05);
  s.lineTo(-w / 2, 0);
  const g = new ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
  g.translate(0, 0, -0.011);
  return g;
}

function fence(b, rand) {
  const picket = picketGeometry();
  const pts = fencePoints(0.12);
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [x, z] = pts[i];
    if (isInGate(x, z)) continue;
    const [nx, nz] = pts[(i + 1) % n];
    const ang = Math.atan2(nz - z, nx - x);
    const y = terrainHeight(x, z) - 0.04;
    // Old fence: pickets lean and vary a little.
    b.add(picket, {
      pos: [x, y, z],
      rot: [(rand() - 0.5) * 0.05, -ang, (rand() - 0.5) * 0.04],
      scale: [1, 0.94 + rand() * 0.08, 1],
      color: tint("#ebe6dc", rand, 0.06),
    });
  }
  picket.dispose();

  // Posts + rails (rails sit behind the pickets, on the garden side).
  const posts = fencePoints(2.0);
  const railH = [0.18, 0.58];
  for (let i = 0; i < posts.length; i++) {
    const [x, z] = posts[i];
    const [x2, z2] = posts[(i + 1) % posts.length];
    const y = terrainHeight(x, z);
    const inGate = isInGate(x, z) || isInGate(x2, z2) || isInGate((x + x2) / 2, (z + z2) / 2);
    const cx = (x + x2) / 2;
    const cz = (z + z2) / 2;
    // Rails offset 3 cm towards the garden centre.
    const toC = new Vector3(-cx, 0, 1 - cz).normalize().multiplyScalar(0.035);
    if (!isInGate(x, z)) box(b, [0.08, 0.92, 0.08], tint("#e2dccf", rand, 0.06), { pos: [x + toC.x, y + 0.42, z + toC.z] });
    if (inGate) continue;
    const len = Math.hypot(x2 - x, z2 - z);
    for (const rh of railH)
      box(b, [len, 0.065, 0.024], tint("#e0d9cb", rand, 0.05), {
        pos: [cx + toC.x, y + rh, cz + toC.z],
        rot: [0, -Math.atan2(z2 - z, x2 - x), 0],
      });
  }

  // Gate: two posts either side of the path + an open gate leaf.
  const gz = FENCE.zMax;
  const gx = pathX(gz);
  for (const s of [-1, 1]) box(b, [0.1, 1.0, 0.1], lin("#e4ded2"), { pos: [gx + s * (GATE_HALF_WIDTH + 0.05), GROUND_Y + 0.46, gz] });
  const hinge = new Matrix4().compose(
    new Vector3(gx - GATE_HALF_WIDTH, GROUND_Y + 0.02, gz),
    new Quaternion().setFromEuler(new Euler(0, -1.15, 0)),
    new Vector3(1, 1, 1)
  );
  const leafW = GATE_HALF_WIDTH * 2 - 0.08;
  for (let k = 0; k < 10; k++) {
    const px = 0.06 + (k / 9) * (leafW - 0.12);
    const g = picketGeometry();
    const m = new Matrix4().makeTranslation(px, 0.04, 0).premultiply(hinge);
    b.add(g, { matrix: m, color: tint("#ebe6dc", rand, 0.05) });
    g.dispose();
  }
  box(b, [leafW, 0.065, 0.024], lin("#e0d9cb"), { pos: [leafW / 2, 0.22, -0.025], parent: hinge });
  box(b, [leafW, 0.065, 0.024], lin("#e0d9cb"), { pos: [leafW / 2, 0.6, -0.025], parent: hinge });
  // Diagonal brace.
  rod(b, [0.08, 0.22, -0.03], [leafW - 0.08, 0.6, -0.03], 0.018, lin("#e0d9cb"), 4, hinge);
}

function bench(b, rand) {
  const parent = new Matrix4().compose(
    new Vector3(4.35, GROUND_Y, 2.9),
    new Quaternion().setFromEuler(new Euler(0, -2.2, 0)),
    new Vector3(1, 1, 1)
  );
  const wood = () => tint("#a08b73", rand, 0.1);
  const W = 1.5;
  // Seat slats (3) at 45 cm.
  for (let i = 0; i < 3; i++) box(b, [W, 0.035, 0.12], wood(), { pos: [0, 0.45, -0.15 + i * 0.14], parent });
  // Back slats (2), reclined.
  for (let i = 0; i < 2; i++)
    box(b, [W, 0.1, 0.03], wood(), { pos: [0, 0.6 + i * 0.17, -0.25 - i * 0.03], rot: [-0.17, 0, 0], parent });
  // Legs + armrests.
  for (const s of [-1, 1]) {
    box(b, [0.06, 0.45, 0.06], wood(), { pos: [s * (W / 2 - 0.08), 0.225, 0.13], parent });
    box(b, [0.06, 0.88, 0.06], wood(), { pos: [s * (W / 2 - 0.08), 0.44, -0.24], rot: [-0.1, 0, 0], parent });
    box(b, [0.06, 0.04, 0.5], wood(), { pos: [s * (W / 2 - 0.05), 0.66, -0.02], parent });
    box(b, [0.05, 0.22, 0.05], wood(), { pos: [s * (W / 2 - 0.05), 0.55, 0.19], parent });
    box(b, [0.05, 0.05, 0.4], wood(), { pos: [s * (W / 2 - 0.08), 0.12, -0.05], parent });
  }
}

function wateringCan(b) {
  const zinc = lin("#a7b2ae");
  const parent = new Matrix4().compose(
    new Vector3(-1.02, GROUND_Y, STUDIO.zMax + 0.42),
    new Quaternion().setFromEuler(new Euler(0, 0.5, 0)),
    new Vector3(1, 1, 1)
  );
  const body = new CylinderGeometry(0.105, 0.115, 0.26, 16);
  b.add(body, { matrix: new Matrix4().makeTranslation(0, 0.13, 0).premultiply(parent), color: zinc });
  body.dispose();
  const lid = new CylinderGeometry(0.06, 0.105, 0.04, 16);
  b.add(lid, { matrix: new Matrix4().makeTranslation(0, 0.28, 0).premultiply(parent), color: lin("#9aa6a2") });
  lid.dispose();
  // Spout from the lower front, angled up, with a rose.
  rod(b, [0.09, 0.06, 0], [0.4, 0.3, 0], 0.014, zinc, 6, parent);
  const rose = new CylinderGeometry(0.035, 0.016, 0.05, 10);
  const rm = new Matrix4()
    .compose(new Vector3(0.42, 0.315, 0), new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(0.79, 0.61, 0)), new Vector3(1, 1, 1))
    .premultiply(parent);
  b.add(rose, { matrix: rm, color: lin("#8f9a96") });
  rose.dispose();
  // Top handle (half torus) + back handle.
  const handle = new TorusGeometry(0.1, 0.011, 6, 14, Math.PI);
  b.add(handle, { matrix: new Matrix4().makeTranslation(0, 0.29, 0).premultiply(parent), color: zinc });
  handle.dispose();
  rod(b, [-0.11, 0.08, 0], [-0.16, 0.22, 0], 0.01, zinc, 5, parent);
  rod(b, [-0.16, 0.22, 0], [-0.1, 0.27, 0], 0.01, zinc, 5, parent);
}

function bicycle(b) {
  const frame = lin("#a9d8c8"); // pastel mint
  const dark = lin("#2f2b29");
  const chrome = lin("#c9cdd0");
  const leather = lin("#8a5a3c");
  // Local frame: x along the bike (front = +x), y up, z sideways. Rear axle at x=0.
  const R = 0.355;
  const parent = new Matrix4().compose(
    new Vector3(2.62, GROUND_Y + 0.004, 1.55),
    new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0.16, "YXZ")),
    new Vector3(1, 1, 1)
  );
  const rear = [0, R, 0];
  const front = [1.12, R, 0];
  // Wheels: tyre + rim + spokes + hub.
  for (const axle of [rear, front]) {
    const tyre = new TorusGeometry(R - 0.02, 0.021, 6, 36);
    b.add(tyre, { matrix: new Matrix4().makeTranslation(...axle).premultiply(parent), color: dark });
    tyre.dispose();
    const rim = new TorusGeometry(R - 0.045, 0.008, 4, 36);
    b.add(rim, { matrix: new Matrix4().makeTranslation(...axle).premultiply(parent), color: chrome });
    rim.dispose();
    for (let k = 0; k < 18; k++) {
      const a = (k / 18) * Math.PI * 2;
      rod(b, axle, [axle[0] + Math.cos(a) * (R - 0.05), axle[1] + Math.sin(a) * (R - 0.05), (k % 2 ? 1 : -1) * 0.004], 0.0018, chrome, 3, parent);
    }
    rod(b, [axle[0], axle[1], -0.05], [axle[0], axle[1], 0.05], 0.02, chrome, 8, parent);
  }
  // Frame (step-through "omafiets"): curved down tube as two segments.
  const bb = [0.44, 0.28, 0];
  const seatTop = [0.33, 0.86, 0];
  const headBot = [1.0, 0.68, 0];
  const headTop = [0.96, 0.88, 0];
  rod(b, bb, seatTop, 0.017, frame, 8, parent);
  rod(b, bb, [0.72, 0.36, 0], 0.02, frame, 8, parent);
  rod(b, [0.72, 0.36, 0], headBot, 0.02, frame, 8, parent);
  rod(b, [0.45, 0.62, 0], [0.98, 0.78, 0], 0.016, frame, 8, parent); // second loop tube
  rod(b, headBot, headTop, 0.022, frame, 8, parent);
  // Stays.
  for (const z of [-0.035, 0.035]) {
    rod(b, [0, R, z], [bb[0], bb[1], 0], 0.009, frame, 5, parent);
    rod(b, [0, R, z], [0.35, 0.8, 0], 0.009, frame, 5, parent);
    rod(b, [1.12, R, z], headBot, 0.011, frame, 5, parent); // fork
  }
  // Mudguards (partial tori).
  for (const [axle, start] of [
    [rear, Math.PI * 0.05],
    [front, Math.PI * 0.25],
  ]) {
    const guard = new TorusGeometry(R + 0.015, 0.03, 3, 20, Math.PI * 0.75);
    const m = new Matrix4().compose(new Vector3(...axle), new Quaternion().setFromEuler(new Euler(0, 0, start)), new Vector3(1, 1, 0.6)).premultiply(parent);
    b.add(guard, { matrix: m, color: frame });
    guard.dispose();
  }
  // Seat post + saddle.
  rod(b, seatTop, [0.31, 0.95, 0], 0.012, chrome, 6, parent);
  box(b, [0.26, 0.06, 0.16], leather, { pos: [0.3, 0.98, 0], parent });
  // Handlebar: swept-back "moustache" bar with grips.
  rod(b, headTop, [0.93, 1.02, 0], 0.012, chrome, 6, parent);
  for (const s of [-1, 1]) {
    rod(b, [0.93, 1.02, 0], [0.85, 1.04, s * 0.22], 0.011, chrome, 6, parent);
    rod(b, [0.85, 1.04, s * 0.22], [0.72, 1.03, s * 0.29], 0.016, leather, 6, parent);
  }
  // Rear rack + front wicker basket.
  box(b, [0.42, 0.02, 0.14], dark, { pos: [0.1, 0.8, 0], parent });
  rod(b, [-0.1, 0.8, 0.06], [0, R, 0.04], 0.006, dark, 4, parent);
  rod(b, [-0.1, 0.8, -0.06], [0, R, -0.04], 0.006, dark, 4, parent);
  box(b, [0.3, 0.24, 0.36], lin("#c9a46e"), { pos: [1.17, 0.86, 0], parent });
  box(b, [0.31, 0.03, 0.37], lin("#b08b58"), { pos: [1.17, 0.975, 0], parent });
  // Chain guard.
  box(b, [0.5, 0.08, 0.012], frame, { pos: [0.22, 0.32, 0.06], rot: [0, 0, 0.1], parent });
  // Pedals + crank.
  rod(b, bb, [0.5, 0.12, 0.09], 0.01, chrome, 4, parent);
  box(b, [0.1, 0.02, 0.06], dark, { pos: [0.5, 0.12, 0.13], parent });
  // Kick-stand folded, front lamp.
  const lamp = new SphereGeometry(0.04, 8, 6);
  b.add(lamp, { matrix: new Matrix4().makeTranslation(1.06, 0.74, 0).premultiply(parent), color: lin("#f3eee2") });
  lamp.dispose();
  return parent;
}

/** Basket position (world) so Flowers can put a little bunch in it. */
export const BASKET_FLOWERS = (() => {
  const parent = new Matrix4().compose(
    new Vector3(2.62, GROUND_Y + 0.004, 1.55),
    new Quaternion().setFromEuler(new Euler(0, -Math.PI / 2, 0.16, "YXZ")),
    new Vector3(1, 1, 1)
  );
  return new Vector3(1.17, 0.95, 0).applyMatrix4(parent);
})();

function buildProps() {
  const rand = mulberry32(99);
  const b = new Builder();
  plinthAndStep(b, rand);
  steppingStones(b, rand);
  fence(b, rand);
  bench(b, rand);
  wateringCan(b);
  bicycle(b);
  return b.build();
}

export default function Props() {
  const geometry = useMemo(buildProps, []);
  const material = useMemo(() => makeSolidMaterial("gardenProps"), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="gardenProps" geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
