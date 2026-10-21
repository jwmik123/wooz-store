import { CanvasTexture, LinearFilter, NoColorSpace } from "three/webgpu";
import { uniform } from "three/tsl";
import { arc, fingerStroke, rng } from "./fingerStroke";

/*
 * Condensation on the greenhouse glass while it is closed for the sale drop
 * (lib/drop.js). The glass material (./glassMaterial.js, `fog` option) reads:
 *
 *   uFog      overall amount, 0 = clean … 1 = fogged
 *   uFogLine  world y above which the glass has dried (the sun burns it off
 *             top to bottom at T-0); far above the roof = fogged everywhere
 *   mask      the visitor's wipes, screen space (the intro camera holds still
 *             while the fog is up), R = wiped clear; fogs up again in seconds.
 *   doodles   small finger drawings someone left on the front glass at hand
 *             height, same R/G encoding, mapped by world x/y (DOODLE).
 */

export const uFog = uniform(1);
export const uFogLine = uniform(9);

// --- Visitor's wipes (screen space) -------------------------------------------

const MASK_W = 256;
let mask = null;

function create() {
  const canvas = document.createElement("canvas");
  canvas.width = MASK_W;
  canvas.height = Math.max(64, Math.round((MASK_W * window.innerHeight) / window.innerWidth));
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = NoColorSpace;
  texture.flipY = false; // canvas top = screenUV.y 0
  texture.generateMipmaps = false;
  texture.minFilter = LinearFilter;
  texture.magFilter = LinearFilter;
  mask = { canvas, ctx, texture, decay: 0, dirty: false };
  return mask;
}

/** The wipe mask texture (created on first use, client only). */
export const getFogMaskTexture = () => (mask ?? create()).texture;
export const FOG_MASK_W = MASK_W;

/**
 * Wipe at a client-space point: a soft round brush (~4.5 % of the screen
 * height) into R. `strength` 0…1.
 */
export function wipeFog(clientX, clientY, strength = 1) {
  const m = mask ?? create();
  const { canvas, ctx } = m;
  const sx = canvas.width / window.innerWidth;
  const sy = canvas.height / window.innerHeight;
  const ry = 0.045 * canvas.height;
  const rx = (ry * sx) / sy;
  ctx.save();
  ctx.translate(clientX * sx, clientY * sy);
  ctx.scale(rx / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, `rgba(255,0,0,${0.42 * strength})`);
  g.addColorStop(0.5, `rgba(255,0,0,${0.24 * strength})`);
  g.addColorStop(1, "rgba(255,0,0,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, ry, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  m.dirty = true;
}

/** Let wiped spots fog up again (call every frame). */
export function decayFog(dt) {
  if (!mask) return;
  mask.decay += dt;
  if (mask.decay >= 0.1) {
    mask.decay = 0;
    mask.ctx.fillStyle = "rgba(0,0,0,0.045)";
    mask.ctx.fillRect(0, 0, mask.canvas.width, mask.canvas.height);
    mask.dirty = true;
  }
  if (mask.dirty) {
    mask.texture.needsUpdate = true;
    mask.dirty = false;
  }
}

// --- Doodles on the front glass (world space) --------------------------------

/** Canvas size and mapping (the shader maps world x/y on the front → uv). */
export const DOODLE = { size: 2048, ppm: 2048 / 4.2, x0: -2.1, y0: 2.1 };

let doodles = null;

function drawDoodles(g) {
  const { ppm, x0, y0 } = DOODLE;
  const P = (x, y) => [(x - x0) * ppm, (y0 - y) * ppm];
  const pts = (list) => list.map(([x, y]) => P(x, y));
  const w = 0.022 * ppm; // one finger
  const rand = rng(42);
  const stroke = (list, opts) => fingerStroke(g, pts(list), w, rand, opts);
  const circle = (cx, cy, r, a0 = 0, a1 = Math.PI * 2, n = 28) => stroke(arc(cx, cy, r, a0, a1, n));
  // Hand height on the glass: the floor is at y -1.87, so roughly y -0.9 … -0.2.

  // Left panel: a smiley.
  circle(-1.45, -0.48, 0.1, -Math.PI * 0.45, Math.PI * 1.5);
  stroke([[-1.485, -0.455], [-1.483, -0.445]]);
  stroke([[-1.415, -0.455], [-1.413, -0.445]]);
  circle(-1.45, -0.49, 0.055, Math.PI * 1.15, Math.PI * 1.85, 10);
  // Left door: a heart.
  stroke(
    Array.from({ length: 33 }, (_, i) => {
      const t = (i / 32) * Math.PI * 2;
      const hx = 16 * Math.sin(t) ** 3;
      const hy = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
      return [-0.28 + hx * 0.0058, -0.45 + hy * 0.0058];
    })
  );

  // Right panel: a sun.
  circle(1.0, -0.32, 0.05, 0, Math.PI * 2, 18);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    stroke([[1.0 + Math.cos(a) * 0.075, -0.32 + Math.sin(a) * 0.075], [1.0 + Math.cos(a) * 0.11, -0.32 + Math.sin(a) * 0.11]]);
  }
}

/** The doodle texture (front glass). */
export function getFogDoodleTexture() {
  if (doodles) return doodles;
  const c = document.createElement("canvas");
  c.width = c.height = DOODLE.size;
  const g = c.getContext("2d");
  g.fillStyle = "#000";
  g.fillRect(0, 0, c.width, c.height);
  drawDoodles(g);
  doodles = new CanvasTexture(c);
  doodles.colorSpace = NoColorSpace;
  doodles.flipY = false;
  doodles.anisotropy = 8;
  return doodles;
}
