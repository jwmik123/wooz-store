import { CanvasTexture, SRGBColorSpace } from "three/webgpu";

/*
 * One shared canvas atlas for every tag face: 4 × 2 cells (portrait, 7:11).
 * Cell i = tag i. Redrawn in place when the sale data arrives.
 */

export const COLS = 4;
export const ROWS = 2;
const CW = 320;
const CH = Math.round((CW * 11) / 7); // 503
const KRAFT = "#c8a171";
const KRAFT_DARK = "#b48a5a";
const INK = "#1b3327";
const SALE = "#d9412f";
const CREAM = "#fff6e8";

/** UV rect (u0, v0, su, sv) of cell i (CanvasTexture.flipY: v = 0 at the bottom). */
export function cellRect(i) {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  return [col / COLS, 1 - (row + 1) / ROWS, 1 / COLS, 1 / ROWS];
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

// Deterministic speckle so the kraft has some fibre.
function speckle(g, x, y, w, h, seed, tint) {
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  g.fillStyle = tint;
  for (let k = 0; k < 260; k++) {
    g.globalAlpha = 0.05 + rnd() * 0.12;
    g.fillRect(x + rnd() * w, y + rnd() * h, 1 + rnd() * 2.5, 1 + rnd() * 1.5);
  }
  g.globalAlpha = 1;
}

function drawCell(g, i, tag, salePct, fonts) {
  const x = (i % COLS) * CW;
  const y = Math.floor(i / COLS) * CH;
  const sale = salePct > 0;
  const bg = sale ? SALE : KRAFT;
  const ink = sale ? CREAM : INK;
  g.save();
  g.translate(x, y);
  g.fillStyle = bg;
  g.fillRect(0, 0, CW, CH);
  speckle(g, 0, 0, CW, CH, i + 1, sale ? "#7a1a10" : "#6b4a24");
  // Reinforcement ring around the punched hole.
  g.strokeStyle = sale ? "rgba(255,246,232,0.35)" : KRAFT_DARK;
  g.lineWidth = 6;
  g.beginPath();
  g.arc(CW / 2, CH * (0.013 / 0.11), CW * 0.115, 0, Math.PI * 2);
  g.stroke();
  // Stitched-in border.
  g.setLineDash([10, 8]);
  g.lineWidth = 2.5;
  g.strokeStyle = sale ? "rgba(255,246,232,0.55)" : "rgba(27,51,39,0.35)";
  g.strokeRect(16, CH * 0.22, CW - 32, CH * 0.74);
  g.setLineDash([]);

  g.fillStyle = ink;
  g.textAlign = "center";
  g.textBaseline = "alphabetic";
  // Eyebrow.
  g.font = `700 22px ${fonts.sans}`;
  g.letterSpacing = "5px";
  g.fillText(sale ? "SALE" : "WOOZ", CW / 2, CH * 0.29);
  g.letterSpacing = "0px";

  // Name runs up the long side (reads best when the card is small on screen).
  const display = (s) => `600 ${s}px ${fonts.display}`;
  const sansF = (s) => `600 ${s}px ${fonts.sans}`;
  const len = CH * 0.6; // usable length along the card
  g.save();
  g.translate(CW / 2, CH * 0.645);
  g.rotate(-Math.PI / 2);
  g.textBaseline = "middle";
  const big = sale ? `Sale −${salePct}%` : tag.name;
  const small = sale ? tag.name : tag.sub;
  const size = fit(g, big, display, Math.round(CW * 0.52), len);
  g.font = display(size);
  g.fillText(big, 0, -CW * 0.06);
  g.font = sansF(fit(g, small, sansF, 30, len));
  g.fillText(small, 0, CW * 0.3);
  g.restore();
  g.restore();
}

/** Builds (or redraws) the atlas for `tags` with `sale` (Map handle -> %). */
export function drawTagAtlas(tags, sale, texture) {
  const canvas = texture?.image ?? document.createElement("canvas");
  canvas.width = CW * COLS;
  canvas.height = CH * ROWS;
  const g = canvas.getContext("2d");
  const fonts = {
    display: cssFont("--wz-font-display", "Georgia, serif"),
    sans: cssFont("--wz-font-sans", "system-ui, sans-serif"),
  };
  g.clearRect(0, 0, canvas.width, canvas.height);
  tags.forEach((t, i) => drawCell(g, i, t, sale?.get(t.key) ?? 0, fonts));
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
export async function loadTagFonts() {
  const d = cssFont("--wz-font-display", "serif");
  const s = cssFont("--wz-font-sans", "sans-serif");
  try {
    await Promise.all([
      document.fonts.load(`600 80px ${d}`, "Hoodies"),
      document.fonts.load(`700 22px ${s}`, "WOOZ"),
    ]);
  } catch {
    /* fallback faces */
  }
}
