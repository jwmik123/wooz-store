import {
  BoxGeometry,
  BufferAttribute,
  CylinderGeometry,
  InstancedBufferAttribute,
  MeshStandardNodeMaterial,
  RingGeometry,
  Shape,
  ShapeGeometry,
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
  mix,
  positionLocal,
  select,
  sin,
  texture,
  uv,
  vec2,
  vec3,
} from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { uTime, uWindIndoor, uWindStrength } from "../uniforms";
import { TAG_H, TAG_HOLE, TAG_W } from "./tagLayout";
import { uHoverAmt, uHoverTag, uTagsFade } from "./tagState";

/*
 * Tag + string geometry / materials. Both meshes are InstancedMeshes in world
 * space with the same per-instance attributes:
 *   tagAnchor vec4 = string top (world xyz) + yaw
 *   tagMeta   vec4 = (index, sway scale, phase, 0)
 *   tagCell   vec4 = atlas cell (u0, v0, su, sv)        (tag only)
 * The pendulum sway rotates the (already instance-transformed) vertex around
 * the anchor, so the card and its string swing together, shadows included.
 */

const T = 0.0007; // half card thickness (front / back faces)

function cardShape(r = 0.008) {
  const w = TAG_W / 2;
  const top = TAG_HOLE;
  const bot = TAG_HOLE - TAG_H;
  const s = new Shape();
  s.moveTo(-w + r, bot);
  s.lineTo(w - r, bot);
  s.quadraticCurveTo(w, bot, w, bot + r);
  s.lineTo(w, top - r);
  s.quadraticCurveTo(w, top, w - r, top);
  s.lineTo(-w + r, top);
  s.quadraticCurveTo(-w, top, -w, top - r);
  s.lineTo(-w, bot + r);
  s.quadraticCurveTo(-w, bot, -w + r, bot);
  const hole = new Shape();
  hole.absarc(0, 0, 0.0035, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** uv sentinels: x in [0,1] front face, x = -1 back face, x = 2 eyelet. */
function setUV(geo, fn) {
  const p = geo.getAttribute("position");
  const a = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const [u, v] = fn(p.getX(i), p.getY(i));
    a[i * 2] = u;
    a[i * 2 + 1] = v;
  }
  geo.setAttribute("uv", new BufferAttribute(a, 2));
  return geo;
}

function flip(geo) {
  const idx = geo.index.array;
  for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const n = geo.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setZ(i, -n.getZ(i));
  return geo;
}

export function createTagGeometry() {
  const shape = cardShape();
  const front = new ShapeGeometry(shape, 6).translate(0, 0, T);
  setUV(front, (x, y) => [x / TAG_W + 0.5, (y - (TAG_HOLE - TAG_H)) / TAG_H]);
  const back = flip(new ShapeGeometry(shape, 6).translate(0, 0, -T));
  setUV(back, () => [-1, 0]);
  const ring = new RingGeometry(0.0035, 0.0062, 20);
  const eyeF = setUV(ring.clone().translate(0, 0, T + 0.0003), () => [2, 0]);
  const eyeB = setUV(flip(ring.clone().translate(0, 0, -T - 0.0003)), () => [2, 0]);
  const g = mergeGeometries([front, back, eyeF, eyeB].map((x) => x.toNonIndexed()));
  g.computeBoundingSphere();
  return g;
}

/** Unit-length twine from y = 0 down to y = -1 (scaled per instance). */
export function createStringGeometry() {
  return new CylinderGeometry(0.0011, 0.0011, 1, 5, 1, true).translate(0, -0.5, 0);
}

/** Generous invisible hit box around the card (comfortable on touch). */
export function createHitGeometry() {
  return new BoxGeometry(TAG_W * 1.8, TAG_H * 1.45, 0.08).translate(0, TAG_HOLE - TAG_H / 2, 0);
}

export function setInstanceAttributes(geo, { anchor, meta, cell }) {
  geo.setAttribute("tagAnchor", new InstancedBufferAttribute(anchor, 4));
  geo.setAttribute("tagMeta", new InstancedBufferAttribute(meta, 4));
  if (cell) geo.setAttribute("tagCell", new InstancedBufferAttribute(cell, 4));
}

/** Rodrigues: rotate v around unit axis k by angle a. */
const rotate = (v, k, a) =>
  v.mul(cos(a)).add(cross(k, v).mul(sin(a))).add(k.mul(dot(k, v).mul(float(1).sub(cos(a)))));

function swayNodes() {
  const anchor = attribute("tagAnchor", "vec4");
  const meta = attribute("tagMeta", "vec4");
  const yaw = anchor.w;
  const right = vec3(cos(yaw), 0, sin(yaw).negate());
  const fwd = vec3(sin(yaw), 0, cos(yaw));
  const hov = float(1).sub(clamp(abs(meta.x.sub(uHoverTag)), 0, 1)).mul(uHoverAmt);
  const phase = meta.z;
  const t = uTime;
  const amp = uWindStrength.mul(uWindIndoor).mul(0.11).mul(meta.y).add(hov.mul(0.07));
  const swing = sin(t.mul(1.35).add(phase))
    .mul(0.65)
    .add(sin(t.mul(0.83).add(phase.mul(1.9))).mul(0.35))
    .mul(amp);
  const side = sin(t.mul(1.1).add(phase.mul(2.3))).mul(0.6).mul(amp);
  const twist = sin(t.mul(0.55).add(phase)).mul(1.8).mul(amp);
  // Hover: the card lifts and tilts its face up towards the viewer.
  const tilt = hov.mul(-0.42);

  const p = positionLocal;
  let v = p.sub(anchor.xyz);
  v = rotate(v, vec3(0, 1, 0), twist);
  v = rotate(v, right, swing.add(tilt));
  v = rotate(v, fwd, side);
  const position = anchor.xyz.add(v).add(vec3(0, hov.mul(0.014), 0));
  return { position, hov };
}

export function createTagMaterial(atlas) {
  const m = new MeshStandardNodeMaterial({ roughness: 0.92, metalness: 0 });
  m.name = "garmentTag";
  m.transparent = true;
  const { position, hov } = swayNodes();
  m.positionNode = position;

  const cell = attribute("tagCell", "vec4");
  const st = uv();
  const isBack = st.x.lessThan(-0.5);
  const isEyelet = st.x.greaterThan(1.5);
  const faceUV = cell.xy.add(st.mul(cell.zw));
  const backUV = cell.xy.add(vec2(0.03, 0.5).mul(cell.zw));
  const paper = texture(atlas, select(isBack, backUV, faceUV)).rgb;
  const brass = color("#b9975b");
  m.colorNode = select(isEyelet, brass, paper);
  m.metalnessNode = select(isEyelet, float(0.85), float(0));
  m.roughnessNode = select(isEyelet, float(0.35), float(0.92));
  m.emissiveNode = paper.mul(hov.mul(0.12));
  m.opacityNode = uTagsFade;
  return m;
}

export function createStringMaterial() {
  const m = new MeshStandardNodeMaterial({ roughness: 1, metalness: 0 });
  m.name = "garmentTagString";
  m.transparent = true;
  m.positionNode = swayNodes().position;
  m.colorNode = mix(color("#e9dcc4"), color("#cbb796"), 0.4);
  m.opacityNode = uTagsFade;
  return m;
}
