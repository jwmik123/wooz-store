import { CanvasTexture, SRGBColorSpace } from "three/webgpu";
import { SIGN_H, SIGN_W } from "./signLayout";

/*
 * One shared canvas atlas for every signboard face: 1 column × 4 rows.
 * Cell i = sign i. Redrawn in place when the brand fonts / sale data arrive.
 */

export const ROWS = 4;
const CW = 1024;
const CH = Math.round((CW * SIGN_H) / SIGN_W);
const CREAM = "#f3ead9";
const CREAM_DARK = "#e2d5bd";
const EDGE = "#2b2a26";
const INK = "#1b3327";
const SALE = "#d9412f";
const SALE_INK = "#fff6e8";

/** UV rect (u0, v0, su, sv) of cell i (CanvasTexture.flipY: v = 0 at the bottom). */
export function cellRect(i) {
  return [0, 1 - (i + 1) / ROWS, 1, 1 / ROWS];
}

function cssFont(name, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Biggest font size (≤ max) at which `text` fits `width`. */
function fit(g, text, font, max, width) {
  let size = max;
  g.font = font(size);
  while (size > 10 && g.measureText(text).width > width) {
    size -= 2;
    g.font = font(size);
  }
  return size;
}

// Painted-board grain: faint horizontal streaks.
function grain(g, w, h, seed) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = CREAM_DARK;
  for (let k = 0; k < 90; k++) {
    g.globalAlpha = 0.08 + rnd() * 0.18;
    g.fillRect(rnd() * w, rnd() * h, 60 + rnd() * 260, 1 + rnd() * 2);
  }
  g.globalAlpha = 1;
}

function drawCell(g, i, sign, salePct, fonts) {
  const y0 = i * CH;
  const sale = salePct > 0;
  g.save();
  g.translate(0, y0);
  g.fillStyle = CREAM;
  g.fillRect(0, 0, CW, CH);
  grain(g, CW, CH, i + 1);
  // Thin dark edge (the board's painted rim).
  g.strokeStyle = EDGE;
  g.lineWidth = 10;
  g.strokeRect(5, 5, CW - 10, CH - 10);

  const stripH = sale ? Math.round(CH * 0.27) : 0;
  const nameH = CH - stripH;
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const display = (s) => `600 ${s}px ${fonts.display}`;
  const size = fit(g, sign.name, display, Math.round(nameH * 0.62), CW * 0.84);
  g.font = display(size);
  g.fillText(sign.name, CW / 2, 12 + (nameH - 12) * 0.52);

  if (sale) {
    g.fillStyle = SALE;
    g.fillRect(12, CH - 12 - stripH, CW - 24, stripH);
    g.fillStyle = SALE_INK;
    const sans = (s) => `700 ${s}px ${fonts.sans}`;
    const label = `Sale −${salePct}%`;
    g.font = sans(fit(g, label, sans, Math.round(stripH * 0.62), CW * 0.8));
    g.letterSpacing = "4px";
    g.fillText(label, CW / 2, CH - 12 - stripH / 2 + 2);
    g.letterSpacing = "0px";
  }
  g.restore();
}

/** Builds (or redraws) the atlas for `signs` with `sale` (Map handle -> %). */
export function drawSignAtlas(signs, sale, texture) {
  const canvas = texture?.image ?? document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH * ROWS;
  const g = canvas.getContext("2d");
  const fonts = {
    display: cssFont("--wz-font-display", "Georgia, serif"),
    sans: cssFont("--wz-font-sans", "system-ui, sans-serif"),
  };
  g.clearRect(0, 0, canvas.width, canvas.height);
  signs.forEach((s, i) => drawCell(g, i, s, sale?.get(s.key) ?? 0, fonts));
  if (texture) {
    texture.needsUpdate = true;
    return texture;
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** Waits for the brand fonts so the first draw isn't in a fallback face. */
export async function loadSignFonts() {
  const d = cssFont("--wz-font-display", "serif");
  const s = cssFont("--wz-font-sans", "sans-serif");
  try {
    await Promise.all([
      document.fonts.load(`600 120px ${d}`, "Hoodies"),
      document.fonts.load(`700 40px ${s}`, "Sale"),
    ]);
  } catch {
    /* fallback faces */
  }
}
