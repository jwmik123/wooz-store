/*
 * A finger drawn through condensation, as it looks on a real fogged window,
 * rasterised into a 2D canvas (black background, additive):
 *
 *   R  the cleared track: a slightly wobbly band (a thin damp film stays; the
 *      shader keeps a little haze in it), plus the thin trails of drips
 *   G  water drops: the rim of beads the finger pushes up along both edges,
 *      a bigger drop where the stroke starts / ends, and the drop at the
 *      bottom of each drip trail (the shader renders G as refracting beads)
 *
 * Sizes are in canvas px; `w` is the finger width.
 */

/** Small deterministic PRNG so the doodles look the same on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const RED = "rgb(255,0,0)";
const GREEN = "rgb(0,255,0)";

function dot(g, x, y, r, color) {
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, Math.max(0.4, r), 0, Math.PI * 2);
  g.fill();
}

/** A drip: a thin clear trail running down from (x, y) with a drop at its end. */
function drip(g, x, y, w, rand) {
  const len = w * (1.2 + rand() * 3.2);
  g.strokeStyle = "rgb(200,0,0)";
  g.lineWidth = Math.max(0.6, w * 0.13);
  g.beginPath();
  g.moveTo(x, y);
  let px = x;
  const steps = 6;
  for (let i = 1; i <= steps; i++) {
    px += (rand() - 0.5) * w * 0.08;
    g.lineTo(px, y + (len * i) / steps);
  }
  g.stroke();
  dot(g, px, y + len, w * (0.16 + rand() * 0.08), GREEN);
}

/** Beads along one segment's edges (+ the odd drip off its lower edge). */
function edgeBeads(g, ax, ay, bx, by, w, rand, drips) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.01) return;
  const nx = -dy / len;
  const ny = dx / len;
  const step = Math.max(1, w * 0.32);
  for (let t = rand() * step; t < len; t += step * (0.6 + rand() * 0.8)) {
    const x = ax + (dx * t) / len;
    const y = ay + (dy * t) / len;
    for (const side of [-1, 1]) {
      if (rand() < 0.5) continue;
      const r = w * (0.04 + rand() * rand() * 0.1);
      const off = w / 2 + r * (0.2 + rand() * 0.9);
      dot(g, x + nx * side * off, y + ny * side * off, r, GREEN);
    }
    // Water gathers on the LOWER edge of flat-ish strokes and runs down.
    if (drips && Math.abs(nx) < 0.6 && rand() < 0.035 * (step / w) * 3) {
      const lower = ny > 0 ? 1 : -1;
      drip(g, x + nx * lower * (w / 2), y + ny * lower * (w / 2), w, rand);
    }
  }
}

/** One straight piece of a stroke (mouse trails are drawn piece by piece). */
export function fingerSegment(g, ax, ay, bx, by, w, rand, { drips = true, core = 1 } = {}) {
  g.save();
  g.globalCompositeOperation = "lighter";
  g.lineCap = "round";
  g.strokeStyle = `rgba(255,0,0,${core})`;
  g.lineWidth = w * (0.85 + rand() * 0.3);
  g.beginPath();
  g.moveTo(ax, ay);
  g.lineTo(bx, by);
  g.stroke();
  edgeBeads(g, ax, ay, bx, by, w, rand, drips);
  g.restore();
}

/**
 * A whole hand-drawn stroke through `pts` ([[x, y], ...]); a little wobble is
 * added, so straight guide points read as drawn by hand.
 */
export function fingerStroke(g, pts, w, rand, opts = {}) {
  const wob = w * 0.18;
  const p = pts.map(([x, y]) => [x + (rand() - 0.5) * wob, y + (rand() - 0.5) * wob]);
  for (let i = 1; i < p.length; i++) fingerSegment(g, p[i - 1][0], p[i - 1][1], p[i][0], p[i][1], w, rand, opts);
  g.save();
  g.globalCompositeOperation = "lighter";
  // Bigger drops where the finger landed and lifted off.
  dot(g, p[0][0] + (rand() - 0.5) * w * 0.3, p[0][1] + w * 0.35, w * 0.2, GREEN);
  const e = p[p.length - 1];
  dot(g, e[0] + (rand() - 0.5) * w * 0.3, e[1] + w * 0.4, w * 0.24, GREEN);
  g.restore();
}

/** Points on a circle / arc (radians), for faces, suns, hearts... */
export const arc = (cx, cy, r, a0, a1, n = 24) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
