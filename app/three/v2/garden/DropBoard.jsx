"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  InstancedMesh,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  PlaneGeometry,
  Raycaster,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  Vector2,
} from "three/webgpu";
import { color, cos, float, fract, instanceIndex, mix, pow, select, texture, uniform, vec3 } from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { uNightFactor } from "../uniforms";
import { terrainHeight } from "./gardenCommon";
import { useTierSettings } from "../perf/quality";
import { setPointerCursor } from "../interactions";
import { dropLabel, dropTime, useDropStore } from "@/lib/drop";
import { tr, useLocale } from "@/lib/i18n";
import useLoadingStore from "../../../components/loader/loadingStore";

/*
 * Countdown board for the sale drop (lib/drop.js), same roadside-marquee family
 * as SaleSign.jsx: a red panel with chasing bulbs, "Sale drop" lettering and
 * split-flap digits (days : hours : min : sec), and below it a wooden plank
 * with two push-buttons that open the calendar sheet (components/ui/DropSheet).
 *
 * Real metres: panel 2.3 × 1.3 m, top ≈ 2.4 m above the lawn, left of the path
 * in the intro shot. At T-0 every flap rattles to NOW OPEN and the bulbs flash.
 *
 * The board does its own raycasting on the canvas (R3F events are off during
 * the intro, see Scene.jsx IntroEventGate), so only its two buttons react.
 *
 * Draw calls: panel, rim, frame, plank, bulbs, face, flaps (all 8 digits are one
 * mesh, CPU-animated quads), colons, 2 × (button + label).
 */

// Framed together with the greenhouse by the intro shot (cameraStore
// introDrop / introDropPortrait, whose DOF focus sits on these spots).
export const DROP_BOARD = {
  landscape: { x: -3.0, z: 6.9, rotY: 0.6, top: 2.6, scale: 1.1 },
  // Portrait: three layers (title / greenhouse front / this board), the board
  // low in the foreground on the path so its buttons sit in the thumb zone.
  portrait: { x: 0, z: 7.6, rotY: 0, top: 1.42, scale: 0.75 },
};

const isPortrait = () => typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8;

function usePlacement() {
  const [portrait, setPortrait] = useState(isPortrait);
  useEffect(() => {
    const on = () => setPortrait(isPortrait());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return DROP_BOARD[portrait ? "portrait" : "landscape"];
}

// --- Dimensions (panel-local, metres, origin = panel centre) -----------------

const PW = 2.3;
const PH = 1.3;
const PR = 0.16;

const TILE_W = 0.18;
const TILE_H = 0.27;
const PAIR_GAP = 0.02;
const GROUP_GAP = 0.11;
const FLAP_Y = -0.07;
const OPEN_PITCH = TILE_W + 0.035;

const PLANK_Y = -PH / 2 - 0.3;
const BTN = { w: 0.74, h: 0.24, r: 0.08, x: 0.42 };

const tileX = (i) => {
  const group = Math.floor(i / 2);
  const groupW = TILE_W * 2 + PAIR_GAP;
  const total = groupW * 4 + GROUP_GAP * 3;
  return -total / 2 + group * (groupW + GROUP_GAP) + (i % 2) * (TILE_W + PAIR_GAP) + TILE_W / 2;
};
const openX = (i) => (i - 3.5) * OPEN_PITCH;
const colonX = (k) => (tileX(k * 2 + 1) + tileX(k * 2 + 2)) / 2;

function roundedRect(w, h, r) {
  const s = new Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

const lin = (hex) => color(hex);
const flat = (parts) => {
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  parts.forEach((g) => g.dispose());
  return merged;
};

// --- Fonts / canvases ---------------------------------------------------------

async function fontFamilies() {
  const css = getComputedStyle(document.documentElement);
  const pick = (v, fb) => css.getPropertyValue(v).trim() || fb;
  const f = {
    sign: pick("--wz-font-sign", "Lobster, 'Brush Script MT', cursive"),
    display: pick("--wz-font-display", "Fraunces, Georgia, serif"),
    sans: pick("--wz-font-sans", "system-ui, sans-serif"),
  };
  await Promise.all(
    [`200px ${f.sign}`, `600 200px ${f.display}`, `600 60px ${f.sans}`].map((s) =>
      document.fonts.load(s, "Sale drop 0123456789").catch(() => {})
    )
  );
  return f;
}

const canvasTexture = (c) => {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
};

// Face: lettering + unit labels, drawn over the whole panel (transparent elsewhere).
const FACE_W = 2048;
const FACE_H = Math.round((FACE_W * PH) / PW);
const PX = FACE_W / PW; // px per metre
const fx = (x) => FACE_W / 2 + x * PX;
const fy = (y) => FACE_H / 2 - y * PX;

function drawFace(g, f, open, locale) {
  g.clearRect(0, 0, FACE_W, FACE_H);
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";

  // "Sale drop" in the SaleSign treatment: cream face, red outline, stepped shadow.
  g.font = `${Math.round(0.3 * PX)}px ${f.sign}`;
  const tx = fx(0);
  const ty = fy(0.38);
  for (let k = 4; k >= 1; k--) {
    g.fillStyle = k > 2 ? "#5e1b1a" : "#9a2c29";
    g.strokeStyle = g.fillStyle;
    g.lineWidth = 22;
    g.strokeText("Sale drop", tx - k * 5, ty + k * 6);
  }
  g.strokeStyle = "#b8352f";
  g.lineWidth = 22;
  g.strokeText("Sale drop", tx, ty);
  const grad = g.createLinearGradient(0, ty - 90, 0, ty + 90);
  grad.addColorStop(0, "#fffaf0");
  grad.addColorStop(0.55, "#fff1d6");
  grad.addColorStop(1, "#f7dcb4");
  g.fillStyle = grad;
  g.fillText("Sale drop", tx, ty);

  // Subtitle + unit labels: small caps, cream.
  g.fillStyle = "rgba(255,241,214,0.92)";
  const caps = (text, x, y, size, spacing) => {
    g.font = `600 ${Math.round(size * PX)}px ${f.sans}`;
    if ("letterSpacing" in g) g.letterSpacing = `${spacing}px`;
    g.fillText(text.toUpperCase(), fx(x), fy(y));
  };
  caps(open ? tr("board.open") : dropLabel(locale), 0, 0.16, 0.075, 10);
  if (!open)
    tr("board.units").forEach((label, k) => {
      caps(label, (tileX(k * 2) + tileX(k * 2 + 1)) / 2, FLAP_Y - TILE_H / 2 - 0.085, 0.06, 8);
    });
  if ("letterSpacing" in g) g.letterSpacing = "0px";
}

// Flap glyph atlas: 4 × 5 cells, each a whole tile (dark card, cream glyph).
// Letters cover NOW OPEN and NU OPEN (board.flaps in lib/i18n.js).
const GLYPHS = "0123456789NOWPE U";
const COLS = 4;
const ROWS = 5;
const CELL_W = 180;
const CELL_H = Math.round((CELL_W * TILE_H) / TILE_W);

function drawAtlas(f) {
  const c = document.createElement("canvas");
  c.width = CELL_W * COLS;
  c.height = CELL_H * ROWS;
  const g = c.getContext("2d");
  g.textAlign = "center";
  g.textBaseline = "middle";
  [...GLYPHS].forEach((ch, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H;
    const top = g.createLinearGradient(0, y, 0, y + CELL_H);
    top.addColorStop(0, "#2a4134");
    top.addColorStop(0.5, "#1f3328");
    top.addColorStop(0.5, "#17271e");
    top.addColorStop(1, "#122019");
    g.fillStyle = top;
    g.fillRect(x, y, CELL_W, CELL_H);
    g.fillStyle = "#fff1d6";
    g.font = `600 ${Math.round(CELL_H * 0.72)}px ${f.display}`;
    g.fillText(ch, x + CELL_W / 2, y + CELL_H * 0.53);
    // Hinge seam + a faint highlight under it.
    g.fillStyle = "rgba(0,0,0,0.7)";
    g.fillRect(x, y + CELL_H / 2 - 2, CELL_W, 4);
    g.fillStyle = "rgba(255,255,255,0.06)";
    g.fillRect(x, y + CELL_H / 2 + 2, CELL_W, 3);
  });
  return c;
}

function drawButtonLabel(f, text, icon) {
  const c = document.createElement("canvas");
  c.width = 640;
  c.height = Math.round((640 * (BTN.h - 0.03)) / (BTN.w - 0.04));
  const g = c.getContext("2d");
  const ink = "#1B3327";
  g.strokeStyle = ink;
  g.fillStyle = ink;
  g.lineWidth = 9;
  g.lineCap = "round";
  g.lineJoin = "round";
  const iconW = 70;
  // Largest size up to 80 px that leaves a margin on both sides.
  g.font = `600 80px ${f.sans}`;
  const fit = Math.min(80, Math.floor((80 * (c.width - iconW - 26 - 60)) / g.measureText(text).width));
  g.font = `600 ${fit}px ${f.sans}`;
  const tw = g.measureText(text).width;
  const x0 = (c.width - tw - iconW - 26) / 2;
  const cy = c.height / 2;
  // Icon (lucide-ish): calendar or alarm clock, 70 px.
  g.save();
  g.translate(x0, cy - 35);
  if (icon === "calendar") {
    g.beginPath();
    g.roundRect(4, 10, 62, 56, 10);
    g.moveTo(4, 30);
    g.lineTo(66, 30);
    g.moveTo(20, 2);
    g.lineTo(20, 16);
    g.moveTo(50, 2);
    g.lineTo(50, 16);
    g.moveTo(35, 40);
    g.lineTo(35, 58);
    g.moveTo(26, 49);
    g.lineTo(44, 49);
    g.stroke();
  } else {
    g.beginPath();
    g.arc(35, 40, 26, 0, Math.PI * 2);
    g.moveTo(35, 26);
    g.lineTo(35, 40);
    g.lineTo(45, 48);
    g.moveTo(8, 10);
    g.lineTo(0, 18);
    g.moveTo(62, 10);
    g.lineTo(70, 18);
    g.stroke();
  }
  g.restore();
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(text, x0 + iconW + 26, cy + 3);
  return canvasTexture(c);
}

/** Rebuilt when the language changes (lettering + button labels). */
function useCanvases(locale) {
  const [res, setRes] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    fontFamilies().then((f) => {
      if (!alive) return;
      const face = document.createElement("canvas");
      face.width = FACE_W;
      face.height = FACE_H;
      const faceCtx = face.getContext("2d");
      drawFace(faceCtx, f, false, locale);
      made = {
        fonts: f,
        faceCtx,
        face: canvasTexture(face),
        atlas: canvasTexture(drawAtlas(f)),
        labels: {
          calendar: drawButtonLabel(f, tr("board.calendar"), "calendar"),
          remind: drawButtonLabel(f, tr("board.remind"), "alarm"),
        },
      };
      setRes(made);
    });
    return () => {
      alive = false;
      if (!made) return;
      made.face.dispose();
      made.atlas.dispose();
      made.labels.calendar.dispose();
      made.labels.remind.dispose();
    };
  }, [locale]);
  return res;
}

// --- Geometry -----------------------------------------------------------------

function buildPanel(bulbCount, low) {
  const panel = new ExtrudeGeometry(roundedRect(PW, PH, PR), {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: low ? 1 : 3,
    curveSegments: low ? 6 : 12,
  });
  panel.translate(0, 0, -0.095);

  const rimShape = roundedRect(PW + 0.15, PH + 0.15, PR + 0.07);
  rimShape.holes.push(roundedRect(PW - 0.01, PH - 0.01, PR));
  const rim = new ExtrudeGeometry(rimShape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: low ? 1 : 2,
    curveSegments: low ? 6 : 12,
  });
  rim.translate(0, 0, -0.11);

  const pts = roundedRect(PW - 0.2, PH - 0.2, PR - 0.06).getSpacedPoints(bulbCount).slice(0, bulbCount);
  const sock = new CylinderGeometry(0.03, 0.034, 0.03, low ? 6 : 10);
  sock.rotateX(Math.PI / 2);
  const parts = [rim];
  for (const p of pts) parts.push(sock.clone().translate(p.x, p.y, 0.012));
  sock.dispose();
  return { panel, rim: flat(parts), pts };
}

/** Posts, flap housings, plank hangers (one dark steel material). */
function buildFrame(groundLocalY) {
  const parts = [];
  const postH = -groundLocalY + 0.2;
  for (const x of [-0.82, 0.82]) {
    const p = new BoxGeometry(0.07, postH, 0.07);
    p.translate(x, groundLocalY + postH / 2, -0.16);
    parts.push(p);
    const foot = new BoxGeometry(0.16, 0.06, 0.16);
    foot.translate(x, groundLocalY + 0.03, -0.16);
    parts.push(foot);
    const clamp = new BoxGeometry(0.14, 0.5, 0.025);
    clamp.translate(x, 0, -0.125);
    parts.push(clamp);
  }
  // Flap housings: a dark tray behind each pair of digits.
  for (let k = 0; k < 4; k++) {
    const cx = (tileX(k * 2) + tileX(k * 2 + 1)) / 2;
    const tray = new BoxGeometry(TILE_W * 2 + PAIR_GAP + 0.05, TILE_H + 0.05, 0.03);
    tray.translate(cx, FLAP_Y, 0.0);
    parts.push(tray);
  }
  // Hangers from the panel's bottom edge down to the plank.
  for (const x of [-0.72, 0.72]) {
    const rod = new BoxGeometry(0.025, 0.26, 0.025);
    rod.translate(x, -PH / 2 - 0.1, 0.0);
    parts.push(rod);
  }
  return flat(parts);
}

/**
 * All 8 split-flap digits as one mesh: per tile 4 quads (static top, static
 * bottom, falling flap front, flap back), rewritten on the CPU every frame.
 */
class FlapRow {
  constructor() {
    const quads = 8 * 4;
    this.pos = new Float32Array(quads * 4 * 3);
    this.nor = new Float32Array(quads * 4 * 3);
    this.uv = new Float32Array(quads * 4 * 2);
    const idx = [];
    for (let q = 0; q < quads; q++) {
      const b = q * 4;
      if (q % 4 === 3) idx.push(b, b + 2, b + 1, b, b + 3, b + 2); // back face
      else idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    this.geometry = new BufferGeometry();
    this.geometry.setIndex(idx);
    this.geometry.setAttribute("position", new BufferAttribute(this.pos, 3));
    this.geometry.setAttribute("normal", new BufferAttribute(this.nor, 3));
    this.geometry.setAttribute("uv", new BufferAttribute(this.uv, 2));
    this.geometry.boundingSphere = null;
    this.tiles = Array.from({ length: 8 }, (_, i) => ({ cur: "0", next: "0", want: "0", t: -1, x: tileX(i) }));
    this.open = false;
  }

  /** Target glyph per tile; flips start one by one (never mid-flip). */
  set(chars) {
    for (let i = 0; i < 8; i++) this.tiles[i].want = chars[i] ?? " ";
  }

  update(dt) {
    const FLIP = 0.3;
    for (let i = 0; i < 8; i++) {
      const tile = this.tiles[i];
      if (tile.t >= 0) {
        tile.t += dt / FLIP;
        if (tile.t >= 1) {
          tile.cur = tile.next;
          tile.t = -1;
        }
      }
      if (tile.t < 0 && tile.want !== tile.cur) {
        // On the way to NOW OPEN, ratchet through a few digits like a real board.
        tile.next = this.open && tile.rattle-- > 0 ? GLYPHS[(Math.random() * 10) | 0] : tile.want;
        tile.t = 0;
      }
      const tx = this.open ? openX(i) : tileX(i);
      tile.x += (tx - tile.x) * (1 - Math.exp(-dt * 4));
      this.writeTile(i, tile);
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.normal.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
  }

  startOpening() {
    this.open = true;
    this.tiles.forEach((t, i) => (t.rattle = 4 + i));
  }

  writeTile(i, tile) {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const g = 0.0025;
    const x0 = tile.x - hw;
    const x1 = tile.x + hw;
    const flipping = tile.t >= 0;
    const top = flipping ? tile.next : tile.cur;
    const q = i * 4;
    // Static halves (z = 0.02, just in front of the housing tray).
    this.quad(q, x0, x1, [g, hh], 0, 0, top, false);
    this.quad(q + 1, x0, x1, [-hh, -g], 0, 0, tile.cur, false);
    if (!flipping) {
      this.collapse(q + 2);
      this.collapse(q + 3);
      return;
    }
    // Gravity ease with a tiny settle at the end.
    const e = Math.min(1, tile.t * tile.t * 1.08);
    const th = Math.PI * e;
    this.quad(q + 2, x0, x1, [g, hh], th, 0.004, tile.cur, false);
    this.quad(q + 3, x0, x1, [g, hh], th, 0.004, tile.next, true);
  }

  /** Quad spanning y∈[ya, yb] (hinge at y = 0), rotated by th towards the viewer. */
  quad(q, x0, x1, [ya, yb], th, lift, glyph, back) {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const gi = Math.max(0, GLYPHS.indexOf(glyph));
    const u0 = (gi % COLS) / COLS;
    const u1 = u0 + 1 / COLS;
    const vTop = 1 - Math.floor(gi / COLS) / ROWS;
    const vBot = vTop - 1 / ROWS;
    const cellV = (y) => vBot + ((y + TILE_H / 2) / TILE_H) * (vTop - vBot);
    const corners = [
      [x0, ya],
      [x1, ya],
      [x1, yb],
      [x0, yb],
    ];
    const nz = back ? -c : c;
    const ny = back ? s : -s;
    for (let k = 0; k < 4; k++) {
      const [x, y] = corners[k];
      const o = (q * 4 + k) * 3;
      this.pos[o] = x;
      this.pos[o + 1] = y * c + FLAP_Y;
      this.pos[o + 2] = 0.02 + y * s + lift;
      this.nor[o] = 0;
      this.nor[o + 1] = ny;
      this.nor[o + 2] = nz;
      const ou = (q * 4 + k) * 2;
      this.uv[ou] = x === x0 ? u0 : u1;
      // The back of the flap shows the new glyph's lower half once it has fallen.
      this.uv[ou + 1] = cellV(back ? -y : y);
    }
  }

  collapse(q) {
    this.pos.fill(0, q * 12, q * 12 + 12);
  }
}

// --- Materials ----------------------------------------------------------------

// Bulb chase phase (integrated on the CPU so the speed can change smoothly) and
// the T-0 flash.
const uChase = uniform(0);
const uFlash = uniform(0);

function makeMaterials() {
  const panel = new MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.05 });
  panel.colorNode = lin("#c9473f");
  panel.emissiveNode = lin("#c9473f").mul(uNightFactor.mul(0.22).add(uFlash.mul(0.25)));
  panel.name = "dropBoardPanel";

  const rim = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.45 });
  rim.colorNode = lin("#8f2f2c");
  rim.emissiveNode = lin("#8f2f2c").mul(uNightFactor.mul(0.12));
  rim.name = "dropBoardRim";

  const frame = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0.6 });
  frame.colorNode = lin("#2b2a2e");
  frame.name = "dropBoardFrame";

  const plank = new MeshStandardNodeMaterial({ roughness: 0.75, metalness: 0 });
  plank.colorNode = lin("#b98a55");
  plank.emissiveNode = lin("#b98a55").mul(uNightFactor.mul(0.08));
  plank.name = "dropBoardPlank";

  const bulb = new MeshBasicNodeMaterial();
  bulb.name = "dropBoardBulbs";
  const i = float(instanceIndex);
  const isRed = fract(i.mul(0.5)).greaterThan(0.25);
  const hue = select(isRed, vec3(1.0, 0.16, 0.12), vec3(1.0, 0.82, 0.55));
  const wave = cos(i.mul(Math.PI / 2).sub(uChase)).mul(0.5).add(0.5);
  const chase = mix(float(0.35), float(1), pow(wave, 2.5));
  const level = mix(float(2.4), float(4.2), uNightFactor);
  bulb.colorNode = hue.mul(mix(chase, float(1.6), uFlash)).mul(level);

  const colon = new MeshBasicNodeMaterial();
  colon.colorNode = lin("#fff1d6").mul(mix(float(0.9), float(1.8), uNightFactor));
  colon.name = "dropBoardColons";

  return { panel, rim, frame, plank, bulb, colon };
}

function makeTexturedMaterials(tex) {
  const face = new MeshStandardNodeMaterial({ roughness: 0.45, alphaTest: 0.5, side: DoubleSide });
  face.name = "dropBoardFace";
  const t = texture(tex.face);
  face.colorNode = t;
  face.opacityNode = t.a;
  const cream = t.r.mul(t.g).mul(t.b);
  face.emissiveNode = t.rgb.mul(cream).mul(mix(float(0.35), float(1.6), uNightFactor));

  const flaps = new MeshStandardNodeMaterial({ roughness: 0.5, metalness: 0 });
  flaps.name = "dropBoardFlaps";
  const a = texture(tex.atlas);
  flaps.colorNode = a;
  // The cream glyphs glow a little at night (over the bloom threshold).
  flaps.emissiveNode = a.rgb.mul(a.r.mul(a.g)).mul(mix(float(0.15), float(1.2), uNightFactor));

  const buttons = {};
  for (const key of ["calendar", "remind"]) {
    const hover = uniform(0);
    const body = new MeshStandardNodeMaterial({ roughness: 0.38, metalness: 0 });
    body.colorNode = lin("#f6e6c6");
    body.emissiveNode = lin("#fff1d6").mul(hover.mul(0.35).add(uNightFactor.mul(0.25)));
    body.name = `dropBoardButton_${key}`;
    const label = new MeshStandardNodeMaterial({ roughness: 0.4, transparent: true, depthWrite: false });
    const l = texture(tex.labels[key]);
    label.colorNode = l;
    label.opacityNode = l.a;
    label.name = `dropBoardLabel_${key}`;
    buttons[key] = { hover, body, label };
  }
  return { face, flaps, buttons };
}

// --- Component ----------------------------------------------------------------

const _o = new Object3D();
const noRay = () => null;
const BUTTONS = [
  { key: "calendar", x: -BTN.x },
  { key: "remind", x: BTN.x },
];

export default function DropBoard() {
  const tier = useTierSettings();
  const low = !tier.bloom;
  const bulbCount = low ? 48 : 64;

  const P = usePlacement();
  const ground = terrainHeight(P.x, P.z);
  const centreY = ground + P.top - (PH / 2) * P.scale;
  const groundLocalY = (ground - centreY) / P.scale - 0.1;

  const built = useMemo(() => buildPanel(bulbCount, low), [bulbCount, low]);
  const frame = useMemo(() => buildFrame(groundLocalY), [groundLocalY]);
  const mats = useMemo(makeMaterials, []);
  const flapRow = useMemo(() => new FlapRow(), []);

  const plank = useMemo(() => {
    const g = new BoxGeometry(1.84, 0.38, 0.05);
    g.translate(0, PLANK_Y, -0.01);
    return g;
  }, []);
  const colons = useMemo(() => {
    const dot = new CylinderGeometry(0.019, 0.019, 0.012, 12);
    dot.rotateX(Math.PI / 2);
    const parts = [];
    for (let k = 0; k < 3; k++)
      for (const dy of [0.05, -0.05]) parts.push(dot.clone().translate(colonX(k), FLAP_Y + dy, 0.02));
    dot.dispose();
    return flat(parts);
  }, []);
  const buttonGeo = useMemo(() => {
    const g = new ExtrudeGeometry(roundedRect(BTN.w, BTN.h, BTN.r), {
      depth: 0.05,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.012,
      bevelSegments: low ? 1 : 3,
      curveSegments: low ? 5 : 10,
    });
    return g;
  }, [low]);
  const labelGeo = useMemo(() => new PlaneGeometry(BTN.w - 0.04, BTN.h - 0.03), []);
  // Tap area: the button plus a margin, mostly vertical (≥ 44 px on a phone).
  const hitGeo = useMemo(() => new PlaneGeometry(BTN.w + 0.06, BTN.h * 1.9), []);
  const hitMat = useMemo(() => new MeshBasicNodeMaterial({ visible: false }), []);
  const faceGeo = useMemo(() => new PlaneGeometry(PW, PH), []);

  const bulbs = useMemo(() => {
    const g = new SphereGeometry(0.034, low ? 6 : 10, low ? 4 : 7);
    const m = new InstancedMesh(g, mats.bulb, built.pts.length);
    built.pts.forEach((p, i) => {
      _o.position.set(p.x, p.y, 0.04);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.name = "dropBoardBulbs";
    m.raycast = noRay;
    m.computeBoundingSphere();
    return m;
  }, [built, mats, low]);

  const locale = useLocale();
  const tex = useCanvases(locale);
  const tMats = useMemo(() => (tex ? makeTexturedMaterials(tex) : null), [tex]);

  useEffect(() => () => (built.panel.dispose(), built.rim.dispose()), [built]);
  useEffect(() => () => frame.dispose(), [frame]);
  useEffect(() => () => bulbs.geometry.dispose(), [bulbs]);
  useEffect(() => () => buttonGeo.dispose(), [buttonGeo]);
  useEffect(
    () => () => {
      [plank, colons, labelGeo, hitGeo, faceGeo, flapRow.geometry].forEach((g) => g.dispose());
      hitMat.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [plank, colons, labelGeo, hitGeo, hitMat, faceGeo, flapRow, mats]
  );
  useEffect(
    () => () => {
      if (!tMats) return;
      tMats.face.dispose();
      tMats.flaps.dispose();
      Object.values(tMats.buttons).forEach((b) => (b.body.dispose(), b.label.dispose()));
    },
    [tMats]
  );

  // --- Buttons: own raycasting on the canvas --------------------------------
  const camera = useThree((s) => s.camera);
  const dom = useThree((s) => s.gl.domElement);
  const buttonRefs = useRef({});
  const groupRefs = useRef({});
  const press = useRef({ hover: null, down: null, z: { calendar: 0, remind: 0 } });

  useEffect(() => {
    const ray = new Raycaster();
    const ndc = new Vector2();
    const live = () =>
      useDropStore.getState().phase === "before" &&
      !useDropStore.getState().sheet &&
      useLoadingStore.getState().revealed;
    const hit = (e) => {
      if (!live()) return null;
      const r = dom.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const targets = Object.values(buttonRefs.current).filter(Boolean);
      return ray.intersectObjects(targets, false)[0]?.object.userData.key ?? null;
    };
    const st = press.current;
    const setHover = (key) => {
      if (st.hover === key) return;
      st.hover = key;
      setPointerCursor(!!key);
    };
    const onMove = (e) => e.pointerType === "mouse" && setHover(hit(e));
    const onDown = (e) => {
      const key = hit(e);
      st.down = key;
      if (e.pointerType !== "mouse") setHover(key);
    };
    const onUp = (e) => {
      const key = hit(e);
      if (key && key === st.down) useDropStore.getState().openSheet(key);
      st.down = null;
      if (e.pointerType !== "mouse") setHover(null);
    };
    const onLeave = () => {
      st.down = null;
      setHover(null);
    };
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerdown", onDown);
    dom.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onLeave);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerdown", onDown);
      dom.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onLeave);
      if (st.hover) setPointerCursor(false);
    };
  }, [camera, dom]);

  // --- Per frame: countdown → flaps, bulbs, buttons -------------------------
  const opening = useRef(false);
  // Language switched after T-0: fresh canvases start closed, show the open face again.
  useEffect(() => {
    if (!opening.current) return;
    flapRow.set(tr("board.flaps"));
    if (tex) {
      drawFace(tex.faceCtx, tex.fonts, true, locale);
      tex.face.needsUpdate = true;
    }
  }, [tex, locale, flapRow]);
  const colonRef = useRef();
  const sheet = useDropStore((s) => s.sheet);
  // The Awwwards ribbon (fixed, bottom right) would cover the sheet's options.
  useEffect(() => {
    const html = document.documentElement;
    if (sheet) html.dataset.wzDropSheet = "";
    else delete html.dataset.wzDropSheet;
    return () => delete html.dataset.wzDropSheet;
  }, [sheet]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1);
    const ms = Math.max(0, dropTime() - Date.now());

    if (ms > 0) {
      const v = [Math.min(99, Math.floor(ms / 864e5)), Math.floor(ms / 36e5) % 24, Math.floor(ms / 6e4) % 60, Math.floor(ms / 1e3) % 60];
      flapRow.set(v.map((n) => String(n).padStart(2, "0")).join(""));
    } else if (!opening.current) {
      opening.current = true;
      flapRow.startOpening();
      flapRow.set(tr("board.flaps"));
      if (tex) {
        drawFace(tex.faceCtx, tex.fonts, true, locale);
        tex.face.needsUpdate = true;
      }
      if (colonRef.current) colonRef.current.visible = false;
    }
    flapRow.update(dt);

    // Bulbs: faster in the last hour, three flashes at T-0.
    const speed = ms > 0 && ms < 3600e3 ? 11 : 5.5;
    uChase.value += dt * speed;
    const since = (Date.now() - dropTime()) / 1000;
    uFlash.value = since >= 0 && since < 1.8 ? Math.max(0, Math.sin((since / 1.8) * Math.PI * 6)) : 0;

    // Push-buttons: rise on hover, sink while pressed or while their sheet is open.
    const st = press.current;
    const k = 1 - Math.exp(-dt * 22);
    for (const { key } of BUTTONS) {
      const target = st.down === key || sheet === key ? -0.032 : st.hover === key ? 0.014 : 0;
      st.z[key] += (target - st.z[key]) * k;
      const g = groupRefs.current[key];
      if (g) g.position.z = 0.03 + st.z[key];
      if (tMats) {
        const h = tMats.buttons[key].hover;
        h.value += ((st.hover === key ? 1 : 0) - h.value) * k;
      }
    }
  });

  return (
    <group name="dropBoard" position={[P.x, centreY, P.z]} rotation={[0, P.rotY, 0]} scale={P.scale}>
      <mesh geometry={built.panel} material={mats.panel} castShadow raycast={noRay} />
      <mesh geometry={built.rim} material={mats.rim} castShadow raycast={noRay} />
      <mesh geometry={frame} material={mats.frame} castShadow raycast={noRay} />
      <mesh geometry={plank} material={mats.plank} castShadow raycast={noRay} />
      <mesh ref={colonRef} geometry={colons} material={mats.colon} raycast={noRay} />
      <primitive object={bulbs} />
      {tMats && (
        <>
          <mesh geometry={faceGeo} material={tMats.face} position={[0, 0, 0.012]} raycast={noRay} />
          <mesh geometry={flapRow.geometry} material={tMats.flaps} frustumCulled={false} raycast={noRay} />
          {BUTTONS.map(({ key, x }) => (
            <group key={key} ref={(g) => (groupRefs.current[key] = g)} position={[x, PLANK_Y, 0.03]}>
              <mesh geometry={buttonGeo} material={tMats.buttons[key].body} position={[0, 0, -0.05]} castShadow raycast={noRay} />
              {/* Invisible tap area, taller than the button (thumbs on phones). */}
              <mesh
                ref={(m) => (buttonRefs.current[key] = m)}
                userData={{ key }}
                geometry={hitGeo}
                material={hitMat}
                position={[0, 0, 0.02]}
              />
              <mesh geometry={labelGeo} material={tMats.buttons[key].label} position={[0, 0, 0.0135]} raycast={noRay} />
            </group>
          ))}
        </>
      )}
    </group>
  );
}
