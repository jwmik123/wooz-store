import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  InstancedBufferAttribute,
  MeshStandardNodeMaterial,
} from "three/webgpu";
import {
  abs,
  attribute,
  clamp,
  color,
  cos,
  cross,
  dot,
  float,
  positionLocal,
  select,
  sin,
  texture,
  uv,
  vec3,
} from "three/tsl";
import { uNightFactor, uTime, uWindIndoor, uWindStrength } from "../uniforms";
import { SIGN_D, SIGN_H, SIGN_W } from "./signLayout";
import { uHoverAmt, uHoverSign, uSignsFade } from "./signState";

/*
 * Signboard + wire geometry / materials. Both are InstancedMeshes in world
 * space sharing the per-instance attributes:
 *   signAnchor vec4 = sway pivot (wire tops' midpoint, world xyz) + yaw
 *   signMeta   vec4 = (index, phase, 0, 0)
 *   signCell   vec4 = atlas cell (u0, v0, su, sv)        (board only)
 * The (very slow, tiny) sway rotates the instance-transformed vertex around
 * the pivot, so board and wires move together, shadows included.
 */

/** Box with uv sentinels: front face 0..1, back x = -1, edges x = 2. */
export function createBoardGeometry() {
  const g = new BoxGeometry(SIGN_W, SIGN_H, SIGN_D);
  const n = g.getAttribute("normal");
  const st = g.getAttribute("uv");
  const a = new Float32Array(st.count * 2);
  for (let i = 0; i < st.count; i++) {
    const z = n.getZ(i);
    a[i * 2] = z > 0.5 ? st.getX(i) : z < -0.5 ? -1 : 2;
    a[i * 2 + 1] = st.getY(i);
  }
  g.setAttribute("uv", new BufferAttribute(a, 2));
  return g;
}

/** Unit-length steel wire from y = 0 down to y = -1 (scaled per instance). */
export function createWireGeometry() {
  return new CylinderGeometry(0.0022, 0.0022, 1, 5, 1, true).translate(0, -0.5, 0);
}

export function setInstanceAttributes(geo, { anchor, meta, cell }) {
  geo.setAttribute("signAnchor", new InstancedBufferAttribute(anchor, 4));
  geo.setAttribute("signMeta", new InstancedBufferAttribute(meta, 4));
  if (cell) geo.setAttribute("signCell", new InstancedBufferAttribute(cell, 4));
}

/** Rodrigues: rotate v around unit axis k by angle a. */
const rotate = (v, k, a) =>
  v.mul(cos(a)).add(cross(k, v).mul(sin(a))).add(k.mul(dot(k, v).mul(float(1).sub(cos(a)))));

function swayNodes() {
  const anchor = attribute("signAnchor", "vec4");
  const meta = attribute("signMeta", "vec4");
  const yaw = anchor.w;
  const right = vec3(cos(yaw), 0, sin(yaw).negate());
  const phase = meta.y;
  const t = uTime;
  // Barely: a few hundredths of a radian, slow (indoor draught).
  const amp = uWindStrength.mul(uWindIndoor).mul(0.022).add(0.004);
  const swing = sin(t.mul(0.42).add(phase))
    .mul(0.7)
    .add(sin(t.mul(0.27).add(phase.mul(1.7))).mul(0.3))
    .mul(amp);
  const twist = sin(t.mul(0.31).add(phase.mul(2.1))).mul(amp.mul(0.8));
  const p = positionLocal;
  let v = p.sub(anchor.xyz);
  v = rotate(v, vec3(0, 1, 0), twist);
  v = rotate(v, right, swing);
  const hov = float(1).sub(clamp(abs(meta.x.sub(uHoverSign)), 0, 1)).mul(uHoverAmt);
  return { position: anchor.xyz.add(v), hov };
}

export function createBoardMaterial(atlas) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0 });
  m.name = "rackSign";
  m.transparent = true;
  const { position, hov } = swayNodes();
  m.positionNode = position;

  const cell = attribute("signCell", "vec4");
  const st = uv();
  const isFront = st.x.greaterThanEqual(0).and(st.x.lessThanEqual(1));
  const isBack = st.x.lessThan(-0.5);
  const face = texture(atlas, cell.xy.add(st.mul(cell.zw))).rgb;
  const back = color("#e6dcc8");
  const edge = color("#2b2a26");
  const albedo = select(isFront, face, select(isBack, back, edge));
  m.colorNode = albedo;
  // A touch of self-light keeps the name legible under the roof (more at
  // night), + hover brighten.
  const base = float(0.07).add(uNightFactor.mul(0.1));
  m.emissiveNode = albedo.mul(base.add(hov.mul(0.22)));
  m.opacityNode = uSignsFade;
  return m;
}

export function createWireMaterial() {
  const m = new MeshStandardNodeMaterial({ roughness: 0.35, metalness: 0.9 });
  m.name = "rackSignWire";
  m.transparent = true;
  m.positionNode = swayNodes().position;
  m.colorNode = color("#9a9ea3");
  m.opacityNode = uSignsFade;
  return m;
}
