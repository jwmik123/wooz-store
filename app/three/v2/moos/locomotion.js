import { CatmullRomCurve3, MathUtils, Vector3 } from "three/webgpu";
import { MOOS_FLOOR_Y, MOOS_HOME } from "./moosBody";

/*
 * Where Moos may stroll (desktop only), WORLD space (x, z) on the studio
 * floor. Measured from an occupancy map of studio.glb (triangles between
 * 4 cm and 1.6 m above the floor, 10 cm cells):
 *
 *   side walls        x ≈ ±1.95 … ±2.16
 *   table             x -0.85 … 1.05,  z 0.85 … 1.85   (+ stool x 0 … 0.75, z 1.85 … 2.55)
 *   plants/boxes R    x 1.15 … 2.15,   z 1.95 … 3.05
 *   boxes/plants L    x ≤ -1.45 (z -0.85 … 0.45), x ≤ -1.65 (z 0.55 … 0.75)
 *   splatter rack     x -1.65 … -0.95, z -2.45 … -1.15
 *   polo rack         x 0.85 … 1.65,   z -2.55 … -1.45
 *   longsleeve rack   x 1.25 … 1.85,   z -0.85 … 0.25
 *   hoodie rack       z ≤ -2.65
 *
 * Every stop keeps ≥ 0.35 m from those boxes and stays in the overview
 * camera's view (camera (0, 0, 5): feet visible for z < 1.4; the stops
 * behind the table still show him from the knees up). In the overview they
 * also stay clear of the table lamp (x ≈ 0.3 on screen depth) and of the
 * camera's line of sight to the rack hotspot dots, so he never stands right
 * under a dot. (The right half of the floor is out: from the overview it is
 * either behind the lamp or under the polo / longsleeve dots, and the chat
 * camera can't follow him past the right-hand plants.)
 * Paths go through the VIA nodes along the graph EDGES (each edge checked
 * against the map) and are smoothed with a centripetal Catmull-Rom spline.
 */
export const STOPS = {
  home: { x: MOOS_HOME.x, z: MOOS_HOME.z, face: MOOS_HOME.heading },
  left: { x: -0.6, z: -0.35, look: [-1.3, -0.9, -1.8] }, // splatter rack
  back: { x: -0.45, z: -1.4, look: [0.0, -0.9, -3.0] }, // hoodie rack
  centre: { x: -0.35, z: 0.2, look: [1.55, -0.9, -0.45] }, // looks over at the longsleeve rack
};
const VIA = {
  m1: { x: -1.05, z: 0.45 }, // between the left boxes and the table corner
};
const NODES = { ...STOPS, ...VIA };
const EDGES = [
  ["home", "m1"],
  ["m1", "left"],
  ["m1", "centre"],
  ["left", "back"],
  ["left", "centre"],
  ["back", "centre"],
];

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

/** Shortest node route (Dijkstra on a tiny graph). */
function route(from, to) {
  const d = { [from]: 0 };
  const prev = {};
  const open = new Set(Object.keys(NODES));
  while (open.size) {
    let u = null;
    for (const n of open) if (d[n] !== undefined && (u === null || d[n] < d[u])) u = n;
    if (u === null || u === to) break;
    open.delete(u);
    for (const [a, b] of EDGES) {
      const v = a === u ? b : b === u ? a : null;
      if (!v || !open.has(v)) continue;
      const nd = d[u] + dist(NODES[u], NODES[v]);
      if (d[v] === undefined || nd < d[v]) {
        d[v] = nd;
        prev[v] = u;
      }
    }
  }
  const out = [to];
  while (out[0] !== from && prev[out[0]]) out.unshift(prev[out[0]]);
  return out;
}

/** Nearest stop to a position (where a stroll starts from). */
export function nearestStop(x, z) {
  let best = "home";
  for (const k of Object.keys(STOPS))
    if (dist(STOPS[k], { x, z }) < dist(STOPS[best], { x, z })) best = k;
  return best;
}

/** Pick a different stop, preferring ones not visited last time. */
export function pickStop(current, previous) {
  const options = Object.keys(STOPS).filter((k) => k !== current && k !== previous);
  return options[Math.floor(Math.random() * options.length)] || "home";
}

/** Dense polyline (5 cm) from (x, z) to stop `to`, smoothed. */
export function buildPath(x, z, to) {
  const from = nearestStop(x, z);
  const names = route(from, to);
  const pts = [new Vector3(x, MOOS_FLOOR_Y, z)];
  for (const n of names) {
    const p = NODES[n];
    if (Math.hypot(p.x - x, p.z - z) < 0.2) continue; // already there
    pts.push(new Vector3(p.x, MOOS_FLOOR_Y, p.z));
  }
  if (pts.length < 2) return null;
  const curve = new CatmullRomCurve3(pts, false, "centripetal");
  const n = Math.max(2, Math.ceil(curve.getLength() / 0.05));
  return curve.getSpacedPoints(n);
}

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Pure-pursuit walker: steers the heading towards a point ~0.5 m ahead on the
 * path and always moves along its own heading, so the stride (walk clip
 * playback rate = speed / clip speed) matches the ground speed and the feet
 * don't skate, also while turning.
 */
export class Walker {
  constructor(walkSpeed) {
    this.v = walkSpeed; // world m/s of the walk clip at timeScale 1
    this.path = null;
    this.i = 0;
    this.speed = 0;
  }

  start(path) {
    this.path = path;
    this.i = 0;
  }

  stop() {
    this.path = null;
  }

  get active() {
    return !!this.path;
  }

  /** Advances body {x, z, heading}; returns true when the destination is reached. */
  update(body, dt) {
    const path = this.path;
    if (!path) {
      this.speed = MathUtils.damp(this.speed, 0, 9, dt); // brake (chat opened)
      if (this.speed < 0.01) this.speed = 0;
    } else {
      const last = path.length - 1;
      while (this.i < last && Math.hypot(path[this.i].x - body.x, path[this.i].z - body.z) < 0.5)
        this.i++;
      const end = path[last];
      const toEnd = Math.hypot(end.x - body.x, end.z - body.z);
      const tgt = path[this.i];
      const want = Math.atan2(tgt.x - body.x, tgt.z - body.z);
      const err = wrap(want - body.heading);
      const turnRate = MathUtils.clamp(err * 3.2, -2.4, 2.4);
      body.heading = wrap(body.heading + turnRate * dt);
      // slow down for tight turns and for the last 0.7 m
      const turn = MathUtils.clamp(Math.cos(err), 0.18, 1);
      const arrive = MathUtils.clamp(toEnd / 0.7, 0.22, 1);
      this.speed = MathUtils.damp(this.speed, this.v * turn * arrive, 3.5, dt);
      if (toEnd < 0.05 || (this.i === last && toEnd < 0.12 && Math.abs(err) > 1.2)) {
        this.path = null;
        return true;
      }
    }
    body.x += Math.sin(body.heading) * this.speed * dt;
    body.z += Math.cos(body.heading) * this.speed * dt;
    return false;
  }
}

/** Turn in place towards `want` (rad/s capped, eases in). Returns the remaining error. */
export function turnTowards(body, want, dt, maxRate = 1.6) {
  const err = wrap(want - body.heading);
  body.heading = wrap(body.heading + MathUtils.clamp(err * 3, -maxRate, maxRate) * dt);
  return err;
}
