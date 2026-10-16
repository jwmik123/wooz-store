import { Color, Vector3, Vector4 } from "three/webgpu";
import {
  Fn,
  clamp,
  cross,
  dot,
  exp,
  float,
  length,
  max,
  min,
  mix,
  normalize,
  pow,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
} from "three/tsl";
import {
  uKeyLightDirection,
  uNightFactor,
  uSkyHorizon,
  uSunColor,
  uTime,
  uWindDirection,
  uWindStrength,
} from "../uniforms";
import { uLampColor, uLampGlow } from "../lighting/interior";
import { getCloudNoiseTexture } from "../clouds/noiseTexture";

/*
 * Garden (workstream 8): shared layout, CPU helpers and TSL building blocks.
 *
 * Units are metres. World frame (see Studio.jsx): +Y up, the studio's open
 * front faces +Z (towards the default camera), glass long walls at x ≈ ±2.16.
 *
 * Every garden material is a MeshBasicNodeMaterial with its own cheap lighting
 * (sun/moon + hemisphere fill + analytic shadows + aerial perspective), built
 * from the same uniforms the lighting workstream drives, so the garden matches
 * the studio without paying for the scene's light loop on ~1M grass vertices.
 */

// --- Layout --------------------------------------------------------------------

/** Garden ground level (the studio floor is at -1.87, its slab sits ~15 cm proud). */
export const GROUND_Y = -2.02;

/** Studio footprint in world space. */
export const STUDIO = { x: 2.16, zMin: -3.48, zMax: 3.48, floorY: -1.87 };

/** Path from the studio's open front towards the intro camera. */
export const PATH = { zStart: 3.55, zEnd: 24, halfWidth: 0.5 };

/** Gentle meander of the path centre line (kept straight at the studio). */
export function pathX(z) {
  const t = Math.min(Math.max((z - 5.5) / 3, 0), 1);
  return 0.28 * Math.sin((z - 5.5) * 0.36) * t * t * (3 - 2 * t);
}

/** Fence: rounded rectangle around the garden, gate where the path crosses. */
export const FENCE = { xHalf: 10.5, zMin: -10, zMax: 11.5, corner: 2.5, height: 0.82 };

/** Old apple trees: base position, height (m), crown radius (m), seed. */
export const TREES = [
  { x: -5.3, z: -1.6, height: 5.6, crown: 3.1, seed: 7 },
  { x: 6.1, z: -5.2, height: 6.4, crown: 3.3, seed: 19 },
];

/** Canopy spheres (centre + radius) used for the analytic tree shadows. */
export const TREE_CANOPIES = TREES.map((t) => ({
  center: new Vector3(t.x, GROUND_Y + t.height - t.crown * 0.95, t.z),
  radius: t.crown,
}));

// --- CPU helpers ---------------------------------------------------------------

export function mulberry32(a) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** Smooth 2D value noise in [0, 1]. */
export function valueNoise(x, y, seed = 0) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, seed);
  const b = hash2(xi + 1, yi, seed);
  const c = hash2(xi, yi + 1, seed);
  const d = hash2(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function fbm(x, y, octaves = 3, seed = 0) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += valueNoise(x, y, seed + i * 17) * amp;
    norm += amp;
    x *= 2.03;
    y *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

const smooth = (e0, e1, x) => {
  const t = Math.min(Math.max((x - e0) / (e1 - e0), 0), 1);
  return t * t * (3 - 2 * t);
};

/**
 * Terrain height (world y). Flat garden inside the fence, gently rolling
 * meadows beyond ~15 m, rising towards the horizon.
 */
export function terrainHeight(x, z) {
  const r = Math.hypot(x, z - 2);
  const roll = smooth(13, 40, r);
  const n = fbm(x * 0.018 + 3.1, z * 0.018 - 1.7, 4, 5) - 0.45;
  const swell = fbm(x * 0.004, z * 0.004, 2, 9);
  return GROUND_Y + roll * (n * 7 + smooth(60, 500, r) * swell * 22);
}

/** Distance from the path centre line (Infinity outside the path's z range). */
export function pathDistance(x, z) {
  if (z < PATH.zStart - 0.15 || z > PATH.zEnd) return Infinity;
  return Math.abs(x - pathX(z));
}

/** Signed-ish distance to the studio footprint (0 inside). */
export function studioDistance(x, z) {
  const dx = Math.max(Math.abs(x) - STUDIO.x, 0);
  const dz = Math.max(STUDIO.zMin - z, z - STUDIO.zMax, 0);
  return Math.hypot(dx, dz);
}

/** Distance to the fence line (rounded rectangle). */
export function fenceDistance(x, z) {
  const cz = (FENCE.zMin + FENCE.zMax) / 2;
  const hz = (FENCE.zMax - FENCE.zMin) / 2;
  const qx = Math.abs(x) - (FENCE.xHalf - FENCE.corner);
  const qz = Math.abs(z - cz) - (hz - FENCE.corner);
  const outside = Math.hypot(Math.max(qx, 0), Math.max(qz, 0));
  const inside = Math.min(Math.max(qx, qz), 0);
  return Math.abs(outside + inside - FENCE.corner);
}

/** Points along the fence (rounded rectangle), spacing in metres. */
export function fencePoints(spacing) {
  const pts = [];
  const cz = (FENCE.zMin + FENCE.zMax) / 2;
  const hx = FENCE.xHalf - FENCE.corner;
  const hz = (FENCE.zMax - FENCE.zMin) / 2 - FENCE.corner;
  const c = FENCE.corner;
  // Perimeter param: walk the rounded rect counter-clockwise.
  const segs = [];
  const line = (x0, z0, x1, z1) => segs.push({ len: Math.hypot(x1 - x0, z1 - z0), at: (t) => [x0 + (x1 - x0) * t, z0 + (z1 - z0) * t] });
  const arc = (cx, cz2, a0) =>
    segs.push({ len: (Math.PI / 2) * c, at: (t) => [cx + Math.cos(a0 + (t * Math.PI) / 2) * c, cz2 + Math.sin(a0 + (t * Math.PI) / 2) * c] });
  line(hx + c, cz - hz, hx + c, cz + hz);
  arc(hx, cz + hz, 0);
  line(hx, cz + hz + c, -hx, cz + hz + c);
  arc(-hx, cz + hz, Math.PI / 2);
  line(-hx - c, cz + hz, -hx - c, cz - hz);
  arc(-hx, cz - hz, Math.PI);
  line(-hx, cz - hz - c, hx, cz - hz - c);
  arc(hx, cz - hz, Math.PI * 1.5);
  const total = segs.reduce((s, g) => s + g.len, 0);
  const n = Math.round(total / spacing);
  let si = 0;
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    while (d > acc + segs[si].len) acc += segs[si++].len;
    pts.push(segs[si].at((d - acc) / segs[si].len));
  }
  return pts;
}

/**
 * Cottage borders (deterministic): lavender bushes [x, z, flowerStems] and
 * foxglove spires [x, z] along the glass walls, the back wall and flanking the
 * first metres of the path. Flowers.jsx draws the flower stems, Grass.jsx the
 * foliage (lavender mounds, foxglove leaf rosettes).
 */
export const BORDERS = (() => {
  const rand = mulberry32(4242);
  const lavender = [];
  const foxglove = [];
  for (const side of [-1, 1]) {
    for (let z = -3.2; z < 3.1; z += 0.5 + rand() * 0.2) {
      // Leave room for the bicycle on the east side, near the front.
      const bike = side === 1 && z > 0.6;
      if (!bike && rand() < 0.85) lavender.push([side * (3.05 + rand() * 0.15), z + rand() * 0.2, 30]);
      if (!bike && rand() < 0.85) {
        const n = 2 + Math.floor(rand() * 3);
        for (let i = 0; i < n; i++) foxglove.push([side * (2.66 + rand() * 0.12), z + rand() * 0.3]);
      }
    }
  }
  for (let x = -2.1; x < 2.2; x += 0.5 + rand() * 0.2) {
    lavender.push([x, -4.25 - rand() * 0.1, 26]);
    if (rand() < 0.7) foxglove.push([x + 0.2, -3.95]);
  }
  for (let z = 4.3; z < 7.4; z += 0.55) {
    lavender.push([pathX(z) - 0.95, z, 24]);
    lavender.push([pathX(z) + 0.95, z + 0.27, 24]);
  }
  return { lavender, foxglove };
})();

/** The gate: no fence within this distance of the path where it crosses. */
export const GATE_HALF_WIDTH = 0.75;
export const isInGate = (x, z) => z > FENCE.zMax - 1 && Math.abs(x - pathX(z)) < GATE_HALF_WIDTH;

/**
 * Mown-ness in [0, 1]: 1 along the path edges and around the studio, 0 in the
 * wild meadow. Smooth so mown strips blend into the long grass.
 */
export function mownAmount(x, z) {
  const p = pathDistance(x, z);
  const s = studioDistance(x, z);
  const along = 1 - smooth(0.9, 1.5, p);
  const ring = 1 - smooth(0.55, 1.1, s);
  // A mown lawn strip that wraps from the path towards the bench (right).
  const lawn = (1 - smooth(1.6, 2.6, Math.hypot((x - 4.2) * 0.8, z - 2.8))) * 0.9;
  return Math.max(along, ring, lawn);
}

/** Wildness: tall meadow patches with seed heads; drives grass height. */
export function wildness(x, z) {
  return fbm(x * 0.22 + 11, z * 0.22 - 4, 3, 21);
}

/** True where nothing can grow (gravel, plinth, stones, tree trunks, props). */
export function isBlocked(x, z) {
  if (studioDistance(x, z) < 0.36) return true;
  if (pathDistance(x, z) < PATH.halfWidth) return true;
  for (const t of TREES) if (Math.hypot(x - t.x, z - t.z) < 0.32) return true;
  return false;
}

// --- Garden-owned uniforms -----------------------------------------------------

/** Hemisphere fill (colour × intensity), copied from lighting's atmosphere each frame. */
export const uHemiSky = uniform(new Color(0.5, 0.55, 0.6));
export const uHemiGround = uniform(new Color(0.3, 0.28, 0.25));

/**
 * HOOK for the wind workstream: a local gust that pushes grass + flowers
 * radially away from a point. (x, z) = world position, w = radius (m),
 * strength (0…~1.5) in .w … packed as vec4(x, z, radius, strength).
 * Write `uGardenGust.value.set(x, z, radius, strength)` from a wind stroke.
 */
export const uGardenGust = uniform(new Vector4(0, 0, 3, 0));

/** Aerial perspective density (1/m). */
export const uGardenFog = uniform(0.0016);

// --- TSL building blocks --------------------------------------------------------

export const noiseTex = () => texture(getCloudNoiseTexture());

/** sRGB hex → linear Color (for TSL constants). */
export const lin = (hex) => new Color().setStyle(hex, "srgb");

/** sRGB hex → linear vec3 TSL constant. */
export const c3 = (hex) => {
  const c = lin(hex);
  return vec3(c.r, c.g, c.b);
};

/** World-space travelling gust field in [0, 1] at xz (vertex-stage safe). */
export const gustField = Fn(([xz]) => {
  const wd = uWindDirection.xz;
  const speed = uWindStrength.mul(3.5).add(1.2);
  const uv = xz.sub(wd.mul(uTime.mul(speed))).mul(1 / 26);
  const n = noiseTex().sample(uv).level(0);
  const big = n.r;
  const small = noiseTex().sample(uv.mul(3.1).add(vec2(0.31, 0.17))).level(0).b;
  return smoothstep(0.32, 0.78, big.mul(0.75).add(small.mul(0.25)));
});

/**
 * Wind displacement direction × amount for a plant at `xz` with per-plant
 * `seed` (0..1) and stiffness. Returns vec3(dx, dz, gust) where dx/dz is the
 * horizontal lean (radians-ish, ~0…1.1) to scale by height².
 */
export const windLean = Fn(([xz, seed, stiffness]) => {
  const wd = uWindDirection.xz;
  const g = gustField(xz);
  const phase = dot(xz, wd).mul(0.9).sub(uTime.mul(2.1)).add(seed.mul(6.283));
  const flutter = phase.sin().mul(0.5).add(phase.mul(2.3).add(seed.mul(3)).sin().mul(0.25));
  const s = uWindStrength;
  const lean = s.mul(g.mul(0.85).add(0.18)).add(flutter.mul(s.mul(0.22).add(0.05)));
  const side = vec2(wd.y.negate(), wd.x).mul(flutter.mul(0.12).mul(s.add(0.2)));
  let d = wd.mul(lean).add(side);
  // Local gust pushed by the wind workstream (see uGardenGust).
  const gp = uGardenGust;
  const toP = xz.sub(gp.xy);
  const dist = length(toP).max(1e-3);
  const push = smoothstep(gp.z, gp.z.mul(0.2), dist).mul(gp.w);
  d = d.add(toP.div(dist).mul(push));
  return vec3(d.div(stiffness), g);
});

/** Apply a lean to a point at height h (m) above the plant base, total height H. */
export const bendOffset = Fn(([lean2, h, H]) => {
  const t = clamp(h.div(H.max(1e-3)), 0, 1);
  const k = t.mul(t);
  const off = lean2.mul(k).mul(H).mul(0.7);
  const drop = dot(lean2, lean2).mul(k).mul(H).mul(0.22);
  return vec3(off.x, drop.negate(), off.y);
});

// Analytic soft shadows ----------------------------------------------------------

const keyDir = Fn(() => normalize(vec3(uKeyLightDirection.x, uKeyLightDirection.y.max(0.05), uKeyLightDirection.z)))();

/** Chord length of the ray p + t·L through an AABB (0 when missed). */
const boxChord = Fn(([p, L, bmin, bmax]) => {
  const inv = vec3(1).div(L);
  const t0 = bmin.sub(p).mul(inv);
  const t1 = bmax.sub(p).mul(inv);
  const tmin = min(t0, t1);
  const tmax = max(t0, t1);
  const tin = max(max(tmin.x, tmin.y), max(tmin.z, 0));
  const tout = min(min(tmax.x, tmax.y), tmax.z);
  return vec2(max(tout.sub(tin), 0), tin);
});

/**
 * 0 = fully shadowed … 1 = lit, from the studio (glass greenhouse: partial)
 * and the two tree crowns (dappled). `p` world position.
 */
export const analyticShadow = Fn(([p]) => {
  const L = keyDir;
  // Studio: walls up to the eaves + the gable roof as a narrower box.
  const a = boxChord(p, L, vec3(-2.2, -2.1, -3.5), vec3(2.2, 0.75, 3.5));
  const b = boxChord(p, L, vec3(-1.25, 0.75, -3.5), vec3(1.25, 1.75, 3.5));
  const chord = a.x.add(b.x);
  const soft = a.y.mul(0.04).add(0.18);
  const studio = float(1).sub(smoothstep(0, soft, chord).mul(0.55));

  // Tree crowns: distance of each crown centre to the light ray.
  let trees = float(1);
  for (const c of TREE_CANOPIES) {
    const C = vec3(c.center.x, c.center.y, c.center.z);
    const toC = C.sub(p);
    const along = dot(toC, L);
    const d = length(cross(toC, L));
    const occ = smoothstep(c.radius * 1.02, c.radius * 0.55, d).mul(smoothstep(0, 1.5, along));
    trees = trees.mul(float(1).sub(occ.mul(0.72)));
  }
  // Dapple: light leaking through the leaves, projected along the light.
  const proj = p.xz.sub(L.xz.mul(p.y.sub(GROUND_Y).div(L.y)));
  const leak = noiseTex().sample(proj.mul(0.55)).level(0).a;
  const dappled = mix(trees, float(1), smoothstep(0.62, 0.9, leak).mul(float(1).sub(trees)).mul(0.9));
  return studio.mul(dappled);
});

/** Warm interior lamp spill through the glass at night (falls off from the studio). */
export const lampSpill = Fn(([p]) => {
  const dx = max(p.x.abs().sub(STUDIO.x), 0);
  const dz = max(max(p.z.sub(STUDIO.zMax), float(STUDIO.zMin).sub(p.z)), 0);
  const d2 = dx.mul(dx).add(dz.mul(dz));
  const fall = float(1).div(d2.mul(1.4).add(1)).mul(smoothstep(4.5, 0.5, dx.add(dz)));
  return uLampColor.mul(uLampGlow.mul(fall).mul(0.35));
});

/**
 * Lambert lighting matching the studio's physical lights:
 * key = uSunColor × 3.6 (lighting's KEY_INTENSITY_REF), fill = hemisphere.
 * Returns radiance for an albedo. `trans` adds back-lit translucency (0..1).
 */
export const gardenLight = Fn(([albedo, N, p, viewDir, shadow, ao, trans]) => {
  const L = keyDir;
  const key = uSunColor.mul(3.6);
  const ndl = max(dot(N, L), 0);
  const hemi = mix(uHemiGround, uHemiSky, N.y.mul(0.5).add(0.5));
  const back = pow(max(dot(viewDir, L), 0), 3).mul(trans);
  // Wrap a little so grass on the shadow side does not go flat.
  const direct = key.mul(ndl.mul(0.85).add(0.15).add(back.mul(1.6))).mul(shadow);
  const light = direct.add(hemi.mul(ao)).add(lampSpill(p));
  return albedo.mul(light).mul(1 / Math.PI);
});

/** Aerial perspective towards the horizon colour (dims at night with the sky). */
export const aerial = Fn(([color, dist, extra]) => {
  const f = float(1).sub(exp(dist.mul(uGardenFog).mul(extra).negate()));
  return mix(color, uSkyHorizon.mul(mix(float(0.95), float(0.7), uNightFactor)), clamp(f, 0, 1));
});

/**
 * Pixel-width guard: widen thin geometry with distance so it never drops
 * below ~1 px (prevents shimmering stems/blades). Returns a scale ≥ 1.
 */
export const minWidthScale = Fn(([width, dist]) => {
  // ~1.6 px at 1080p / fov 55°: pixel size ≈ dist × 0.00097.
  return max(dist.mul(0.0016).div(width.max(1e-4)), 1);
});
