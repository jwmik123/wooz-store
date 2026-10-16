import { CanvasTexture, SRGBColorSpace } from "three/webgpu";
import { SIGN_H, SIGN_W } from "./signLayout";

/*
 * One shared canvas atlas for every signboard face + sale tag: 1 column ×
 * ROWS. Cells 0..3 = signs, SALE_CELL0.. = sale tags (same aspect).
 * Redrawn in place when the brand fonts / sale data arrive.
 */

export const ROWS = 9;
export const SALE_CELL0 = 4;
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

function drawCell(g, i, sign, fonts) {
  g.save();
  g.translate(0, i * CH);
  g.fillStyle = CREAM;
  g.fillRect(0, 0, CW, CH);
  grain(g, CW, CH, i + 1);
  // Thin dark edge (the board's painted rim).
  g.strokeStyle = EDGE;
  g.lineWidth = 10;
  g.strokeRect(5, 5, CW - 10, CH - 10);
  g.fillStyle = INK;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const display = (s) => `600 ${s}px ${fonts.display}`;
  g.font = display(fit(g, sign.name, display, Math.round(CH * 0.62), CW * 0.84));
  g.fillText(sign.name, CW / 2, CH * 0.53);
  g.restore();
}

/** Red sale swing tag: "Sale −X%" + a punched hole on the left. */
function drawSaleCell(g, i, pct, fonts) {
  g.save();
  g.translate(0, i * CH);
  g.fillStyle = SALE;
  g.fillRect(0, 0, CW, CH);
  g.fillStyle = SALE_INK;
  g.beginPath();
  g.arc(CH * 0.42, CH / 2, CH * 0.13, 0, Math.PI * 2);
  g.fill();
  g.textAlign = "center";
  g.textBaseline = "middle";
  const sans = (s) => `700 ${s}px ${fonts.sans}`;
  const label = `Sale −${pct}%`;
  g.font = sans(fit(g, label, sans, Math.round(CH * 0.56), CW - CH * 1.1));
  g.fillText(label, CW / 2 + CH * 0.3, CH * 0.53);
  g.restore();
}

/** Builds (or redraws) the atlas for `signs` + `saleTags` (layoutSaleTags). */
export function drawSignAtlas(signs, saleTags, texture) {
  const canvas = texture?.image ?? document.createElement("canvas");
  canvas.width = CW;
  canvas.height = CH * ROWS;
  const g = canvas.getContext("2d");
  const fonts = {
    display: cssFont("--wz-font-display", "Georgia, serif"),
    sans: cssFont("--wz-font-sans", "system-ui, sans-serif"),
  };
  g.clearRect(0, 0, canvas.width, canvas.height);
  signs.forEach((s, i) => drawCell(g, i, s, fonts));
  saleTags?.forEach((t, k) => drawSaleCell(g, SALE_CELL0 + k, t.pct, fonts));
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
