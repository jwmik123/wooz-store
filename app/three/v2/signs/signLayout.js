import { Box3, Matrix4, Vector3 } from "three/webgpu";
import { STUDIO_OFFSET } from "../Studio";
import { SWEEP_AXIS } from "../wind/clothWind";
import { TABLE_SPOTS } from "./tableSpots";

export { TABLE_SPOTS };

/*
 * Rack signboards: what they say and where they hang (WORLD space), plus the
 * standalone sale tag (table pieces: tableSpots.js).
 *
 * Board: SIGN_W × SIGN_H × SIGN_D, local origin at its centre, printed face
 * +Z. Hung on two steel wires from the roof straight above the rack.
 */

export const SIGN_W = 0.56;
export const SIGN_H = 0.19;
export const SIGN_D = 0.016;
/** Wire x offset from the board centre (board-local). */
export const WIRE_X = SIGN_W * 0.38;
/**
 * Gap between the garments' top and the board's bottom edge: the rack rail
 * sits ~0.12 m above the garments, then ~0.2 m clear air.
 */
const SIGN_LIFT = 0.32;
/** Table sale tag: same aspect as the board (shares its atlas cell size). */
export const SALE_SCALE = 0.3;
const SALE_H = SIGN_H * SALE_SCALE;

/** Default overview camera (boards turn their face towards it). */
const VIEW = new Vector3(0, 0, 5);

export const RACK_NAMES = {
  hoodie: "Hoodies",
  splatter: "Splatter",
  polo: "Polos",
  longsleeve: "Longsleeves",
};

const uniqueColours = (items) => new Set(items.map((i) => i.color)).size;

/** "Hoodies · 4 colours" (hover chip). */
export function rackLabel(type, items) {
  const n = uniqueColours(items);
  return `${RACK_NAMES[type] ?? type} · ${n} colour${n === 1 ? "" : "s"}`;
}

/** Studio-local (see Studio.jsx) -> world: (-z, y, x) + STUDIO_OFFSET. */
export const studioToWorld = (x, y, z) =>
  new Vector3(-z + STUDIO_OFFSET[0], y + STUDIO_OFFSET[1], x + STUDIO_OFFSET[2]);

const _m = new Matrix4();

/** World bounds of a rack's garments (studio-local GLB node transforms). */
export function rackWorldBox(items) {
  const local = new Box3();
  for (const { node } of items) {
    const g = node.geometry;
    if (!g.boundingBox) g.computeBoundingBox();
    _m.compose(node.position, node.quaternion, node.scale);
    local.union(g.boundingBox.clone().applyMatrix4(_m));
  }
  const a = studioToWorld(local.min.x, local.min.y, local.min.z);
  const b = studioToWorld(local.max.x, local.max.y, local.max.z);
  return new Box3().setFromPoints([a, b]);
}

/** Extent of a box along the idle-sweep axis. */
export function sweepRange(box) {
  let min = Infinity;
  let max = -Infinity;
  const p = new Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    const s = p.dot(SWEEP_AXIS);
    min = Math.min(min, s);
    max = Math.max(max, s);
  }
  return [min - 0.2, max + 0.2];
}

/**
 * Per-rack board nudge (world m) off the rack centre, so neighbouring boards
 * don't overlap from the overview camera (longsleeve sits in front of polo, near the right edge on phones).
 */
const NUDGE = {
  polo: [-0.24, 0.1, 0],
  longsleeve: [-0.12, 0, 0.12],
};

export const faceYaw = (p) => Math.atan2(VIEW.x - p.x, VIEW.z - p.z);

/**
 * One board per rack, centred over the rack's garments. `ceilingAt(x, z, fromY)`
 * returns the world y of the roof / beam above (or null).
 * Each: { key, name, sub, center, yaw, pivot (wire tops' midpoint), wire (m), items, box }.
 */
export function layoutSigns(groups, ceilingAt) {
  const signs = [];
  for (const type of ["hoodie", "splatter", "polo", "longsleeve"]) {
    const items = groups[type];
    if (!items?.length) continue;
    const box = rackWorldBox(items);
    const nudge = new Vector3(...(NUDGE[type] ?? [0, 0, 0]));
    const c = box.getCenter(new Vector3()).add(nudge);
    const yaw = faceYaw(c);
    // Probe from above the rack's own rail (part of the studio mesh).
    const roof = ceilingAt?.(c.x, c.z, box.max.y + 0.3) ?? box.max.y + 1.5;
    // Just clear of the hanger hooks (stays below the roof).
    const y = Math.min(box.max.y + SIGN_LIFT + nudge.y + SIGN_H / 2, roof - 0.3 - SIGN_H / 2);
    const center = new Vector3(c.x, y, c.z);
    const pivotY = Math.max(roof, y + SIGN_H / 2 + 0.05);
    signs.push({
      key: type,
      name: RACK_NAMES[type],
      sub: `${uniqueColours(items)} colours`,
      center,
      yaw,
      pivot: new Vector3(c.x, pivotY, c.z),
      wire: pivotY - (y + SIGN_H / 2),
      roof,
      box,
      items,
    });
  }
  return signs;
}

/**
 * Standalone red "−X%" tags for the handles in `sale` (Map handle -> %).
 * Racks don't get one (their board carries a corner ribbon, signAtlas.js);
 * only the totebag, which has no board: a small tag standing on the table
 * beside it. Each: { key, pct, signIndex (-1 = none), center, yaw, pitch,
 * pivot, still, string?: { top, len } }.
 */
export function layoutSaleTags(signs, sale) {
  const tags = [];
  if (!sale?.size) return tags;
  const tote = sale.get("totebag");
  if (tote) {
    // Standing on the table beside the bag, leaning back a little.
    const center = studioToWorld(3.42, 0.745 + SALE_H / 2, -0.28);
    tags.push({
      key: "totebag",
      pct: tote,
      signIndex: -1,
      center,
      yaw: faceYaw(center),
      pitch: -0.35,
      pivot: center,
      still: 1,
    });
  }
  return tags;
}
