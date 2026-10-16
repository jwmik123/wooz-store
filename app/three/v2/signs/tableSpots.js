import { Vector3 } from "three/webgpu";

/*
 * Table pieces (part of the studio shell mesh; click boxes in Hotspots.jsx).
 * `at` / `size` are studio-local (as the hit boxes); `center` / `half` world.
 * Imported by the shell material (spotGlow.js), so no Studio.jsx import here
 * (cycle): STUDIO_OFFSET is repeated below.
 */

const OFFSET = [0, -1.89472, -1.40451]; // = STUDIO_OFFSET (Studio.jsx)
const toWorld = (x, y, z) => new Vector3(-z + OFFSET[0], y + OFFSET[1], x + OFFSET[2]);

/** Table top under each piece, studio-local y. */
const TABLE_Y = 0.735;

const spot = (key, label, at, size, pool, phase) => {
  const center = toWorld(...at);
  const half = new Vector3(size[2] / 2, size[1] / 2, size[0] / 2);
  const table = toWorld(at[0], TABLE_Y, at[2]);
  return { key, label, at, size, center, half, table, pool, phase };
};

/** label = the hover chip (says what happens); pool = light pool radius (m). */
export const TABLE_SPOTS = {
  totebag: spot("totebag", "Totebag", [3.4, 0.79, -0.55], [0.36, 0.11, 0.4], 0.28, 0),
  coffee: spot("coffee", "Watch the film", [2.9, 0.79, 0.5], [0.14, 0.12, 0.14], 0.15, 2.1),
  lookbook: spot("lookbook", "Flip through the lookbook", [3.0, 0.76, 0.0], [0.34, 0.08, 0.44], 0.28, 4.2),
};
export const TABLE_KEYS = ["coffee", "lookbook", "totebag"];
