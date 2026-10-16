import {
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RGBAFormat,
  RepeatWrapping,
  UnsignedByteType,
} from "three/webgpu";

/*
 * Tileable surface-finish noise for the studio walls / floor, generated once on
 * the CPU (~25 ms, 256² RGBA8, mip-mapped). Two taps per wall pixel sample it at
 * two world scales (see wallFinish.js), so the shader does no procedural fbm.
 *
 *   R  perlin fbm, base freq 3, 4 oct   -> broad tonal mottling (cloudy limewash)
 *   G  terraced perlin fbm, freq 5, 3 oct -> trowel layers (soft plateaus)
 *
 * wallFinish.js: R+G at a 2.2 m tile, B+A at a 0.35 m tile.
 *   B  value noise, freq 64 + 128       -> fine sand grain of the plaster
 *   A  anisotropic perlin (x 20, y 2)   -> brush-hair streaks (vertical)
 */

const SIZE = 256;

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const wrap = (i, p) => ((i % p) + p) % p;

/** Periodic gradient noise in ~[-1, 1], periods px × py (integers). */
function perlin(x, y, px, py, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const grad = (ix, iy, dx, dy) => {
    const a = hash2(wrap(ix, px), wrap(iy, py), seed) * Math.PI * 2;
    return Math.cos(a) * dx + Math.sin(a) * dy;
  };
  const u = fade(xf);
  const v = fade(yf);
  const n00 = grad(xi, yi, xf, yf);
  const n10 = grad(xi + 1, yi, xf - 1, yf);
  const n01 = grad(xi, yi + 1, xf, yf - 1);
  const n11 = grad(xi + 1, yi + 1, xf - 1, yf - 1);
  const nx0 = n00 + u * (n10 - n00);
  const nx1 = n01 + u * (n11 - n01);
  return (nx0 + v * (nx1 - nx0)) * 1.41;
}

/** Periodic value noise in [0, 1]. */
function value(x, y, p, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const u = fade(x - xi);
  const v = fade(y - yi);
  const h = (i, j) => hash2(wrap(xi + i, p), wrap(yi + j, p), seed);
  const a = h(0, 0) + u * (h(1, 0) - h(0, 0));
  const b = h(0, 1) + u * (h(1, 1) - h(0, 1));
  return a + v * (b - a);
}

function fbm(u, v, fx, fy, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const n = perlin(u * (fx << o), v * (fy << o), fx << o, fy << o, seed + o * 31);
    sum += n * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm;
}

const to8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

let cached = null;

export function getFinishNoiseTexture() {
  if (cached) return cached;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const i = (y * SIZE + x) * 4;
      data[i] = to8(fbm(u, v, 3, 3, 4, 11) * 0.55 + 0.5);
      // Trowel layers: soft plateaus with gentle edges (tanh-terraced fbm).
      data[i + 1] = to8(0.5 + 0.47 * Math.tanh(2.6 * fbm(u, v, 5, 5, 3, 23)));
      data[i + 2] = to8(value(u * 64, v * 64, 64, 5) * 0.6 + value(u * 128, v * 128, 128, 9) * 0.4);
      data[i + 3] = to8(fbm(u, v, 20, 2, 2, 41) * 0.6 + 0.5);
    }
  }
  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = NoColorSpace;
  tex.name = "studioFinishNoise";
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
