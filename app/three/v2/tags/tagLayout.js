import { Box3, Matrix4, Vector3 } from "three/webgpu";
import { STUDIO_OFFSET } from "../Studio";
import { SWEEP_AXIS } from "../wind/clothWind";

/*
 * Garment tags: what they say and where they hang (WORLD space).
 *
 * Tag card: 7 × 11 cm kraft card (real size), drawn at `scale` (stylised up so
 * the name reads from the overview). Local frame of the card: the punched hole
 * is the origin, the card hangs down -Y, the printed face looks +Z.
 */

export const TAG_W = 0.07;
export const TAG_H = 0.11;
/** Hole centre below the card's top edge. */
export const TAG_HOLE = 0.013;

/** Default overview camera (tags turn their face towards it). */
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

/** Extent of a box along the idle-sweep axis (cloth highlight). */
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

const faceYaw = (p) => Math.atan2(VIEW.x - p.x, VIEW.z - p.z);

// Table pieces (hit boxes in Hotspots.jsx, studio-local), tied to the object:
// the card drapes down its front towards the camera (`pitch` tilts it back).
const TABLE_TAGS = [
  {
    key: "totebag",
    name: "Totebag",
    sub: "Canvas carry-all",
    at: [3.4, 1.0, -0.55],
    pitch: -0.95,
    string: 0.025,
    scale: 1.6,
  },
  {
    key: "coffee",
    name: "Coffee break",
    sub: "Watch the reel",
    at: [2.9, 0.8, 0.5],
    pitch: -1.1,
    string: 0.02,
    scale: 1.4,
  },
  {
    key: "lookbook",
    name: "Lookbook",
    sub: "Flip through",
    at: [3.0, 0.8, 0.0],
    pitch: -1.15,
    string: 0.02,
    scale: 1.4,
    desktopOnly: true,
  },
];

/**
 * Tag list: one per rack (hung from the rail end nearest the camera) + the
 * table pieces. Each: { key, name, sub, anchor (string top, world), yaw, pitch,
 * string (m), scale, sway, box? (rack world bounds) }.
 */
export function layoutTags(groups, { isMobile }) {
  const tags = [];
  for (const type of ["hoodie", "splatter", "polo", "longsleeve"]) {
    const items = groups[type];
    if (!items?.length) continue;
    const box = rackWorldBox(items);
    const c = box.getCenter(new Vector3());
    const size = box.getSize(new Vector3());
    const alongX = size.x >= size.z;
    // Rail end that faces the camera; the card hangs off the rail there, just
    // in front of the end garment (towards the room / camera).
    const ends = [-1, 1].map((s) =>
      alongX
        ? new Vector3(c.x + s * (size.x / 2 - 0.05), 0, c.z + size.z / 2 + 0.01)
        : new Vector3(c.x, 0, c.z + s * (size.z / 2 + 0.012))
    );
    const end = ends[0].distanceTo(VIEW) < ends[1].distanceTo(VIEW) ? ends[0] : ends[1];
    end.y = box.max.y - 0.035; // rail just under the hanger hooks
    tags.push({
      key: type,
      name: RACK_NAMES[type],
      sub: `${uniqueColours(items)} colours`,
      anchor: end,
      yaw: faceYaw(end),
      pitch: 0,
      string: 0.14,
      scale: 2.4,
      sway: 1,
      box,
      items,
    });
  }
  for (const t of TABLE_TAGS) {
    if (t.desktopOnly && isMobile) continue;
    const anchor = studioToWorld(...t.at);
    tags.push({ ...t, anchor, yaw: faceYaw(anchor), sway: 0.35 });
  }
  return tags;
}
