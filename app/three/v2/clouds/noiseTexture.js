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
 * Tileable cloud noise, generated once on the CPU (~20 ms) and shared by every
 * cloud material. Sampling a mip-mapped texture is far cheaper than procedural
 * noise in the fragment shader and the mips anti-alias the cloud sea for free
 * towards the horizon.
 *
 *   R  perlin fbm (4 octaves, base freq 4)      -> large shapes
 *   G  inverted worley fbm (3 octaves, freq 6)  -> billowy cauliflower tops
 *   B  perlin fbm (3 octaves, base freq 12)     -> detail
 *   A  inverted worley (freq 14)                -> fine puffs / edge erosion
 */

const SIZE = 256;

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Periodic 2D gradient noise in [-1, 1] with integer period `p`. */
function perlin(x, y, p, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const grad = (ix, iy, dx, dy) => {
    const a = hash2(((ix % p) + p) % p, ((iy % p) + p) % p, seed) * Math.PI * 2;
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

/** Periodic 2D worley (F1 distance, ~0..1) with integer period `p`. */
function worley(x, y, p, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  let d = 9;
  for (let j = -1; j <= 1; j++) {
    for (let i = -1; i <= 1; i++) {
      const cx = xi + i;
      const cy = yi + j;
      const wx = ((cx % p) + p) % p;
      const wy = ((cy % p) + p) % p;
      const px = cx + hash2(wx, wy, seed) - x;
      const py = cy + hash2(wx, wy, seed + 17) - y;
      d = Math.min(d, px * px + py * py);
    }
  }
  return Math.sqrt(d);
}

function perlinFbm(u, v, freq, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq << o;
    sum += perlin(u * f, v * f, f, seed + o * 31) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm; // ~[-1, 1]
}

function worleyFbm(u, v, freq, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    const f = freq << o;
    sum += (1 - Math.min(worley(u * f, v * f, f, seed + o * 13), 1)) * amp;
    norm += amp;
    amp *= 0.5;
  }
  return sum / norm; // ~[0, 1]
}

const to8 = (v) => Math.max(0, Math.min(255, Math.round(v * 255)));

let cached = null;

/** Shared, lazily generated cloud noise texture (see header for channels). */
export function getCloudNoiseTexture() {
  if (cached) return cached;
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const u = x / SIZE;
      const v = y / SIZE;
      const i = (y * SIZE + x) * 4;
      data[i] = to8(perlinFbm(u, v, 4, 4, 1) * 0.5 + 0.5);
      data[i + 1] = to8(worleyFbm(u, v, 6, 3, 7));
      data[i + 2] = to8(perlinFbm(u, v, 12, 3, 5) * 0.5 + 0.5);
      data[i + 3] = to8(1 - Math.min(worley(u * 14, v * 14, 14, 3), 1));
    }
  }
  const tex = new DataTexture(data, SIZE, SIZE, RGBAFormat, UnsignedByteType);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.anisotropy = 8;
  tex.colorSpace = NoColorSpace;
  tex.name = "cloudNoise";
  tex.needsUpdate = true;
  cached = tex;
  return tex;
}
