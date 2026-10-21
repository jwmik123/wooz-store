import { CanvasTexture, LinearFilter, NoColorSpace } from "three/webgpu";
import { uniform } from "three/tsl";

/*
 * Condensation on the greenhouse glass while it is closed for the sale drop
 * (lib/drop.js). The glass material (./glassMaterial.js, `fog` option) reads:
 *
 *   uFog      overall amount, 0 = clean … 1 = fogged
 *   uFogLine  world y above which the glass has dried (the sun burns it off
 *             top to bottom at T-0); far above the roof = fogged everywhere
 *   mask      screen-space wipe mask (R: 0 = fogged … 1 = wiped clear). The
 *             intro camera holds still while the fog is up, so screen space is
 *             enough and needs no per-pane UV atlas.
 *
 * Wipes fade back to fog over a few seconds (8-bit canvas, decayed in steps).
 */

export const uFog = uniform(1);
export const uFogLine = uniform(9);

const W = 256;
let mask = null;

function create() {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = Math.max(64, Math.round((W * window.innerHeight) / window.innerWidth));
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

/**
 * Wipe at a client-space point. `strength` 0…1 (the caller scales it with the
 * pointer speed so a resting cursor doesn't clear a hole).
 */
export function wipeFog(clientX, clientY, strength = 1) {
  const m = mask ?? create();
  const { canvas, ctx } = m;
  const sx = canvas.width / window.innerWidth;
  const sy = canvas.height / window.innerHeight;
  // Brush: ~7 % of the screen height, round on screen.
  const ry = 0.07 * canvas.height;
  const rx = (ry * sx) / sy;
  ctx.save();
  ctx.translate(clientX * sx, clientY * sy);
  ctx.scale(rx / ry, 1);
  const g = ctx.createRadialGradient(0, 0, 0, 0, 0, ry);
  g.addColorStop(0, `rgba(255,255,255,${0.55 * strength})`);
  g.addColorStop(0.55, `rgba(255,255,255,${0.35 * strength})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
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
