import { Color } from "three/webgpu";
import {
  Fn,
  abs,
  dot,
  float,
  floor,
  fract,
  fwidth,
  max,
  min,
  mix,
  normalView,
  normalWorldGeometry,
  positionView,
  positionWorld,
  select,
  sin,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import { getFinishNoiseTexture } from "./finishNoise";

/*
 * Studio surface finishes (walls, timber, floor) — art direction on top of the
 * baked albedo atlas, inside the ONE shared studio material.
 *
 * The atlas paints every wall, post, beam and the floor a flat near-white, which
 * reads as "unfinished". Here, per pixel:
 *
 *  1. MASKS (no extra geometry / material / draw call)
 *     white   albedo luminance high + chroma low  → painted surfaces only; the
 *             green WOOZ logo, dark frames, books, plants, rugs, wood fall out.
 *     shell   world position near the greenhouse shell (side walls |x|≈1.96,
 *             back wall z≈-3.3, front frame, everything above the knee walls)
 *             → excludes white props inside (table, lamp, pots, chair).
 *     class   world geometry normal + height split the shell into
 *               plaster  vertical masonry: knee walls + the whole back gable
 *               timber   posts, beams, purlins, roof frame (painted wood)
 *               floor    up-facing at floor level
 *
 *  2. FINISH  world-space planar mapping (dominant normal axis) of one tiny
 *     tileable noise texture at two scales = 2 texture taps per pixel:
 *       big   (2.2 m tile)    R mottling 30–80 cm, G trowel layers 10–45 cm
 *       small (0.35 m tile)   B 3–5 mm sand grain, A brush-hair streaks
 *     + (brick preset) an analytic stretcher-bond pattern, 210×50 mm Dutch
 *     waalformaat with 12 mm joints, anti-aliased with fwidth and faded out
 *     where a pixel covers > ~1.5 cm (no moiré in the overview).
 *     → albedo (colour + tone), a height for a screen-space-derivative bump (so
 *     the sun rakes across the relief; no extra taps) and a roughness tweak.
 *
 * The baked GI is multiplied by the NEW albedo (applyBakedLighting), so the
 * lightmap still reads; brightness is kept close to the original white.
 * Cost (M-series, 1680×1050, whole frame): ≈ +0.2 ms, 0 extra draw calls.
 */

/** Studio world-frame landmarks (measured on the mesh, see Studio.jsx frame). */
export const SHELL = {
  floorY: -1.87,
  /** Top of the knee walls (sill under the side windows), world y. */
  kneeTopY: -0.98,
  sideX: 1.96,
  backZ: -3.28,
  frontZ: 3.28,
};

const lin = (hex) => new Color().setStyle(hex, "srgb");

/**
 * Presets. Colours are sRGB hex (converted to linear uniforms).
 *   wallA / wallB   plaster main + mottle tone
 *   lower / accent  two-tone: lower wainscot band / back (logo) wall
 *   trim            skirting / dado rail
 *   timber          painted posts + beams
 *   brick           brick body under the whitewash (preset 2)
 */
export const FINISH_PRESETS = {
  "Warm limewash": {
    kind: 0,
    wallA: "#f1e6d3",
    wallB: "#ddcdb4",
    lower: "#f1e6d3",
    accent: "#f1e6d3",
    trim: "#d3c4ad",
    timber: "#f1e9dc",
    brick: "#c98d6c",
    texture: 1,
    bump: 1,
  },
  "Pastel two-tone": {
    kind: 1,
    wallA: "#f4ece0",
    wallB: "#e8dccb",
    lower: "#c3d4bf",
    accent: "#f1dcd0",
    trim: "#a9bfa7",
    timber: "#f3ece2",
    brick: "#c98d6c",
    texture: 0.85,
    bump: 0.9,
  },
  "Whitewashed brick": {
    kind: 2,
    wallA: "#f2e9dc",
    wallB: "#e2d6c5",
    lower: "#f2e9dc",
    accent: "#f2e9dc",
    trim: "#d6cab9",
    timber: "#f2ece3",
    brick: "#c4876a",
    texture: 1,
    bump: 1,
  },
};
export const DEFAULT_PRESET = "Whitewashed brick";

/** Live tunables (leva "Studio materials"). */
export const finishUniforms = {
  amount: uniform(1), // 0 = original atlas, 1 = full finish
  texture: uniform(1), // tonal texture strength
  bump: uniform(1), // normal strength
  wallA: uniform(new Color()),
  wallB: uniform(new Color()),
  lower: uniform(new Color()),
  accent: uniform(new Color()),
  trim: uniform(new Color()),
  timber: uniform(new Color()),
  brick: uniform(new Color()),
  bandHeight: uniform(0.92), // two-tone: band top above the floor (m)
  floorAmount: uniform(1),
  floorTone: uniform(new Color()),
};
export const FLOOR_TONE = "#d8d2c8";

export function applyPresetColours(name) {
  const p = FINISH_PRESETS[name] ?? FINISH_PRESETS[DEFAULT_PRESET];
  for (const k of ["wallA", "wallB", "lower", "accent", "trim", "timber", "brick"])
    finishUniforms[k].value.copy(lin(p[k]));
  finishUniforms.texture.value = p.texture;
  finishUniforms.bump.value = p.bump;
  return p;
}
applyPresetColours(DEFAULT_PRESET);
finishUniforms.floorTone.value.copy(lin(FLOOR_TONE));

const LUMA = vec3(0.2126, 0.7152, 0.0722);

/** Brick pattern (stretcher bond, Dutch waalformaat 210×50 mm, 12 mm joints). */
function brickPattern(wuv) {
  const size = vec2(0.222, 0.062);
  const q0 = wuv.div(size);
  const row = floor(q0.y);
  const q = vec2(q0.x.add(row.mul(0.5)), q0.y);
  const cell = fract(q);
  const id = floor(q);
  const dx = min(cell.x, cell.x.oneMinus()).mul(size.x);
  const dy = min(cell.y, cell.y.oneMinus()).mul(size.y);
  const d = min(dx, dy); // metres to nearest joint centre-line… edge
  const w = max(fwidth(wuv.x), fwidth(wuv.y)).max(1e-5);
  const half = float(0.006);
  const mortar = smoothstep(half.add(w), half.sub(w), d);
  // Rounded arris: the brick face only reaches full height ~6 mm inside.
  const face = smoothstep(half, half.add(0.007), d);
  // Fade the pattern out where a pixel spans > ~1.5 cm (no moiré at distance).
  const detail = smoothstep(0.03, 0.012, w);
  const rnd = fract(sin(dot(id, vec2(12.9898, 78.233))).mul(43758.5453));
  return { mortar: mix(float(0.18), mortar, detail), face: face.mul(detail), rnd, detail };
}

/**
 * Builds the finish graph for the studio albedo node (linear vec3).
 * `kind`: 0 limewash, 1 two-tone, 2 brick. `view`: 0 final, 1 mask debug.
 * Returns { colorNode, normalNode, roughnessNode }.
 */
export function createStudioFinish(albedoNode, { kind = 0, view = 0 } = {}) {
  const U = finishUniforms;
  const noise = getFinishNoiseTexture();

  const masks = () => {
    const a = albedoNode.rgb;
    const lum = dot(a, LUMA);
    const mx = max(a.r, max(a.g, a.b));
    const mn = min(a.r, min(a.g, a.b));
    const chroma = mx.sub(mn).div(mx.max(1e-3));
    const lowChroma = smoothstep(0.16, 0.07, chroma);
    const white = smoothstep(0.5, 0.66, lum).mul(lowChroma);

    const p = positionWorld;
    const n = normalWorldGeometry;
    const an = abs(n);
    const h = p.y.sub(SHELL.floorY);

    const side = smoothstep(SHELL.sideX - 0.2, SHELL.sideX - 0.08, abs(p.x));
    const back = smoothstep(SHELL.backZ + 0.3, SHELL.backZ + 0.12, p.z);
    const front = smoothstep(SHELL.frontZ - 0.3, SHELL.frontZ - 0.12, p.z);
    const roof = smoothstep(0.1, 0.3, p.y);
    const shell = max(max(side, back), max(front, roof));

    const vertical = smoothstep(0.55, 0.35, an.y);
    const flat = smoothstep(0.8, 0.95, an.y);
    const atFloor = smoothstep(0.08, 0.04, h);
    const floorM = flat
      .mul(atFloor)
      .mul(smoothstep(0.3, 0.45, lum))
      .mul(lowChroma);

    const belowKnee = smoothstep(SHELL.kneeTopY + 0.02, SHELL.kneeTopY - 0.02, p.y);
    const masonry = max(back, max(side, front).mul(belowKnee)).mul(vertical);
    const paint = white.mul(shell).mul(atFloor.mul(flat).oneMinus());
    const plaster = paint.mul(masonry);
    const timber = paint.sub(plaster).max(0);
    return { plaster, timber, floorM, an, h, p, back };
  };

  const build = () => {
    const { plaster, timber, floorM, an, h, p, back } = masks();

    // Planar world mapping along the dominant normal axis.
    const wuv = select(
      an.y.greaterThan(max(an.x, an.z)),
      p.xz,
      select(an.x.greaterThan(an.z), vec2(p.z, p.y), p.xy),
    );
    const big = texture(noise, wuv.div(2.2));
    const small = texture(noise, wuv.div(0.35));
    const mott = big.r.sub(0.5); // 30–80 cm clouds
    const stroke = big.g.sub(0.5); // 10–45 cm trowel layers
    const grain = small.b.sub(0.5); // 3–5 mm sand
    // Brush-hair streaks (vertical, 2 × 17 cm), only in some trowel patches.
    const streak = small.a.sub(0.5).mul(smoothstep(-0.05, 0.25, stroke));
    const T = U.texture;

    // ---- plaster / limewash (also the base of two-tone and brick mortar wash)
    const cloudy = smoothstep(-0.22, 0.28, mott.add(stroke.mul(0.35)));
    const lowerBand =
      kind === 1 ? smoothstep(U.bandHeight.add(0.002), U.bandHeight.sub(0.002), h) : float(0);
    // Two-tone: pastel accent on the back (logo) wall, sage band elsewhere.
    const accentM = kind === 1 ? back : float(0);
    const mainA = mix(U.wallA, U.accent, accentM);
    const mainB = mix(U.wallB, U.accent.mul(0.93), accentM);
    const bandM = lowerBand.mul(accentM.oneMinus());
    const baseA = mix(mainA, U.lower, bandM);
    const baseB = mix(mainB, U.lower.mul(0.9), bandM);
    const tone = float(1)
      .add(mott.mul(0.26).mul(T))
      .add(stroke.mul(0.04).mul(T))
      .add(grain.mul(0.02).mul(T))
      .add(streak.mul(0.02).mul(T));
    let wall = mix(baseA, baseB, cloudy.mul(T)).mul(tone);
    let height = mott.mul(0.5).add(stroke.mul(0.3)).add(streak.mul(0.04)).add(grain.mul(0.02));
    let rough = float(0.9).add(grain.mul(0.08));

    if (kind === 2) {
      const b = brickPattern(wuv);
      // Brick body: per-brick hue/value jitter; whitewash coverage varies with
      // the brush strokes so some bricks glow through warmer than others.
      const brickCol = U.brick.mul(float(0.82).add(b.rnd.mul(0.3)));
      const wash = float(0.78)
        .add(stroke.mul(0.55))
        .add(b.rnd.sub(0.5).mul(0.22))
        .add(grain.mul(0.18))
        .clamp(0.45, 1);
      const washCol = mix(U.wallA, U.wallB, cloudy.mul(0.5));
      const brickFace = mix(brickCol, washCol, mix(float(0.9), wash, b.detail.mul(T)));
      const mortarCol = U.wallB.mul(0.97).mul(float(1).add(grain.mul(0.1)));
      wall = mix(brickFace, mortarCol, b.mortar).mul(float(1).add(grain.mul(0.04).mul(T)));
      height = b.face.mul(1.6).add(grain.mul(0.35)).add(stroke.mul(0.2));
      rough = float(0.88).add(b.mortar.mul(0.08));
    }

    // Grime + skirting near the floor (masonry only).
    const grime = smoothstep(0.32, 0.0, h).mul(float(0.55).add(mott)).clamp(0, 1);
    wall = wall.mul(float(1).sub(grime.mul(0.07)));
    const skirting = smoothstep(0.092, 0.088, h);
    const dado =
      kind === 1
        ? smoothstep(0.012, 0.009, abs(h.sub(U.bandHeight))).mul(accentM.oneMinus())
        : float(0);
    const trimM = max(skirting, dado);
    wall = mix(wall, U.trim.mul(float(1).add(grain.mul(0.03))), trimM);
    height = mix(height, float(1.4), trimM);
    rough = mix(rough, float(0.55), trimM);

    // ---- painted timber: same family, only a faint brushed grain.
    const timberCol = U.timber.mul(
      float(1).add(streak.mul(0.05).mul(T)).add(grain.mul(0.025).mul(T)),
    );

    // ---- floor: warm micro-cement, keeps the atlas' own value (+ rugs).
    const a = albedoNode.rgb;
    const floorCol = U.floorTone
      .mul(dot(a, LUMA).div(0.62))
      .mul(
        float(1)
          .add(mott.mul(0.16).mul(T))
          .add(stroke.mul(0.05).mul(T))
          .add(grain.mul(0.04).mul(T)),
      );

    const amount = U.amount;
    let color = mix(a, wall, plaster.mul(amount));
    color = mix(color, timberCol, timber.mul(amount));
    color = mix(color, floorCol, floorM.mul(amount).mul(U.floorAmount));

    if (view === 1) color = vec3(plaster, timber, floorM).mul(0.8).add(a.mul(0.15));

    // Per-class relief (metres ≈ value × 12 mm): plaster / brick, brushed paint
    // on the timber, a faint float-finish undulation on the floor.
    const timberH = streak.mul(0.08).add(grain.mul(0.01));
    const floorH = mott.mul(0.25).add(stroke.mul(0.1));
    const hgt = height
      .mul(plaster)
      .add(timberH.mul(timber))
      .add(floorH.mul(floorM).mul(U.floorAmount))
      .mul(amount)
      .mul(U.bump)
      .mul(0.012);
    return { color, hgt, rough: mix(float(0.85), rough, plaster.add(floorM).clamp(0, 1)) };
  };

  const r = build();

  // Screen-space bump (Mikkelsen, surface-gradient) from dFdx/dFdy of the
  // height: no extra texture taps.
  const normalNode = Fn(() => {
    const N = normalView;
    const sx = positionView.dFdx();
    const sy = positionView.dFdy();
    const R1 = sy.cross(N);
    const R2 = N.cross(sx);
    const det = sx.dot(R1);
    const dh = vec2(r.hgt.dFdx(), r.hgt.dFdy());
    const grad = det.sign().mul(dh.x.mul(R1).add(dh.y.mul(R2)));
    return det.abs().mul(N).sub(grad).normalize();
  })();

  return { colorNode: r.color, normalNode, roughnessNode: r.rough };
}
