import { BoxGeometry, BufferGeometry, Float32BufferAttribute, Matrix4, Vector3 } from "three/webgpu";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";

/*
 * Greenhouse glazing layout, WORLD space (metres). Measured from the studio
 * mesh in the running scene (triangles rasterised per wall, glazing-bar
 * vertices fitted):
 *
 *  - side walls: glazing bars between x = ±2.038 and ±2.078 -> glass at ±2.058,
 *    glazed area y [-1.80, 0.70], z [-3.20, 3.25]; the plane edges sit inside
 *    the perimeter frame (sill, eave beam, corner posts).
 *  - roof: gable, ridge along Z at x = 0. Glazing-bar mid plane on the +x slope
 *    passes through (1.796, 1.107) with dy/dx = -0.4863 (25.9°); glazed between
 *    the ridge beam (|x| < 0.25) and the eave beam (|x| > 1.8), z ±3.25.
 *    Each slope has two pane rows split by a purlin at |x| ≈ 1.03; panes are
 *    separated by rafters, the middle pane spans z ±0.333 (rafter centres).
 *  - back wall is solid, the front gable + doorway are open: no glass there.
 */

const ROOF_X0 = 1.796;
const ROOF_Y0 = 1.107;
const ROOF_SLOPE = 0.4863;
export const ROOF_ANGLE = Math.atan(ROOF_SLOPE); // 25.9°
const roofY = (ax) => ROOF_Y0 - ROOF_SLOPE * (ax - ROOF_X0);

const SIDE_X = 2.058;
const SIDE = { y0: -1.88, y1: 0.75, z0: -3.23, z1: 3.3 };
const ROOF = { x0: 0.22, x1: 1.85, z0: -3.28, z1: 3.28 };

/** The opened roof pane: +x (east, morning-sun) slope, upper row, middle bay. */
export const OPEN_PANE = { x0: 0.24, x1: 1.031, z0: -0.333, z1: 0.333 };
export const OPEN_ANGLE = (25 * Math.PI) / 180;

/**
 * Quad from 4 corners (a,b,c,d counter-clockwise), with a normal and uv =
 * (along, metres above the pane's lower edge) for the dust gradient.
 */
function quad(corners, normal, uvs) {
  const g = new BufferGeometry();
  const [a, b, c, d] = corners;
  g.setAttribute("position", new Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.setAttribute("normal", new Float32BufferAttribute(Array(6).fill(normal).flat(), 3));
  const [ua, ub, uc, ud] = uvs;
  g.setAttribute("uv", new Float32BufferAttribute([...ua, ...ub, ...uc, ...ua, ...uc, ...ud], 2));
  return g;
}

function sidePane(sign) {
  const { y0, y1, z0, z1 } = SIDE;
  const x = SIDE_X * sign;
  const h = y1 - y0;
  return quad(
    [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]],
    [sign, 0, 0],
    [[z0, 0], [z1, 0], [z1, h], [z0, h]],
  );
}

/** Roof rectangle on one slope between |x| in [ax0, ax1] and z in [z0, z1]. */
function roofRect(sign, ax0, ax1, z0, z1) {
  const n = [sign * Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE), 0];
  const up = (ax) => (ROOF.x1 - ax) / Math.cos(ROOF_ANGLE); // metres up-slope from the eave
  const P = (ax, z) => [sign * ax, roofY(ax), z];
  return quad(
    [P(ax1, z0), P(ax1, z1), P(ax0, z1), P(ax0, z0)],
    n,
    [[z0, up(ax1)], [z1, up(ax1)], [z1, up(ax0)], [z0, up(ax0)]],
  );
}

/** Hinge + rotation of the opened sash (hinged at its ridge-side edge). */
export function sashFrame() {
  const { x0, x1, z0, z1 } = OPEN_PANE;
  const length = (x1 - x0) / Math.cos(ROOF_ANGLE) + 0.02;
  const width = z1 - z0 + 0.02;
  // Sits on top of the glazing bars: lift the hinge along the slope normal.
  const n = new Vector3(Math.sin(ROOF_ANGLE), Math.cos(ROOF_ANGLE), 0);
  const hinge = new Vector3(x0, roofY(x0), 0).addScaledVector(n, 0.01);
  const closed = new Matrix4().makeTranslation(hinge).multiply(new Matrix4().makeRotationZ(-ROOF_ANGLE));
  const open = new Matrix4()
    .makeTranslation(hinge)
    .multiply(new Matrix4().makeRotationZ(-ROOF_ANGLE + OPEN_ANGLE));
  return { length, width, closed, open };
}

/** All fixed glass + the opened sash's glass, one geometry (one draw call). */
export function createGlassGeometry() {
  const { x0, x1, z0, z1 } = OPEN_PANE;
  const parts = [sidePane(1), sidePane(-1), roofRect(-1, ROOF.x0, ROOF.x1, ROOF.z0, ROOF.z1)];
  // +x slope with the opened pane left out.
  parts.push(roofRect(1, ROOF.x0, ROOF.x1, ROOF.z0, z0));
  parts.push(roofRect(1, ROOF.x0, ROOF.x1, z1, ROOF.z1));
  parts.push(roofRect(1, x1, ROOF.x1, z0, z1));

  // Sash glass (sash-local: x down-slope from the hinge, y = slope normal).
  const { length, width, open } = sashFrame();
  const inset = 0.02;
  const sl = length - inset;
  const hz = width / 2 - inset;
  const g = quad(
    [[sl, 0.012, -hz], [sl, 0.012, hz], [inset, 0.012, hz], [inset, 0.012, -hz]],
    [0, 1, 0],
    [[-hz, 0], [hz, 0], [hz, sl], [-hz, sl]],
  );
  g.applyMatrix4(open);
  parts.push(g);

  const merged = mergeGeometries(parts, false);
  parts.forEach((p) => p.dispose());
  merged.computeBoundingSphere();
  return merged;
}

/** Sash frame (4 rails) + a slim stay arm, one geometry. */
export function createSashFrameGeometry() {
  const { length, width, open, closed } = sashFrame();
  const bar = 0.035;
  const thick = 0.028;
  const box = (sx, sy, sz, cx, cy, cz) => new BoxGeometry(sx, sy, sz).translate(cx, cy, cz);
  const rails = [
    box(bar, thick, width, bar / 2, thick / 2, 0), // hinge (top) rail
    box(bar, thick, width, length - bar / 2, thick / 2, 0), // bottom rail
    box(length, thick, bar, length / 2, thick / 2, -width / 2 + bar / 2),
    box(length, thick, bar, length / 2, thick / 2, width / 2 - bar / 2),
  ];
  rails.forEach((r) => r.applyMatrix4(open));

  // Stay arm: from the fixed purlin below the opening to the sash's side rail.
  const zArm = width / 2 - bar - 0.012;
  const from = new Vector3(length + 0.01, 0.0, zArm).applyMatrix4(closed);
  const to = new Vector3(length * 0.72, 0.004, zArm).applyMatrix4(open);
  const dir = to.clone().sub(from);
  const arm = new BoxGeometry(0.012, dir.length(), 0.008);
  arm.applyMatrix4(
    new Matrix4()
      .makeTranslation(from.clone().add(to).multiplyScalar(0.5))
      .multiply(new Matrix4().makeRotationZ(Math.atan2(dir.y, dir.x) - Math.PI / 2)),
  );

  const merged = mergeGeometries([...rails, arm].map((g) => g.toNonIndexed()), false);
  rails.forEach((r) => r.dispose());
  arm.dispose();
  return merged;
}
