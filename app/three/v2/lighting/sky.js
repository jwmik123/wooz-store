import { Color, Vector3 } from "three/webgpu";
import {
  Fn,
  abs,
  dot,
  exp,
  floor,
  fract,
  hash,
  max,
  mix,
  normalize,
  positionWorldDirection,
  pow,
  sin,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import {
  uNightFactor,
  uSkyHorizon,
  uSkyZenith,
  uSunDirection,
  uTime,
} from "../uniforms";

/** Lighting-internal sky uniforms (written by <Lights />). */
export const uSkyGround = uniform(new Color(0.75, 0.8, 0.88));
export const uMoonDirection = uniform(new Vector3(0, 1, 0));
/** Raw (un-normalised) sun light colour for the disc/glow, linear. */
export const uSunGlowColor = uniform(new Color(1, 0.8, 0.6));

const STAR_SCALE = 80; // grid cells per unit direction → star density/size
const STAR_DENSITY = 0.035; // fraction of cells holding a star

/**
 * Cheap star field: hash a 3D grid over the view direction, keep a small
 * fraction of cells, draw a soft dot at a jittered position inside the cell,
 * vary brightness/size per star and let them twinkle.
 */
const stars = Fn(([dir]) => {
  const p = dir.mul(STAR_SCALE);
  const cell = floor(p);
  // hash() takes a uint: offset keeps the seed positive (|seed| < 7e5 for STAR_SCALE 80).
  const seed = cell.x.add(cell.y.mul(311)).add(cell.z.mul(7919)).add(1000000);
  const h = hash(seed);
  const jitter = vec3(hash(seed.add(1)), hash(seed.add(2)), hash(seed.add(3))).mul(0.5).add(0.25);
  const d = fract(p).sub(jitter).length();
  const k = h.sub(1 - STAR_DENSITY).div(STAR_DENSITY).max(0); // 0..1 for star cells
  const isStar = k.greaterThan(0);
  const size = k.mul(0.15).add(0.1);
  const dot_ = smoothstep(size, size.mul(0.2), d);
  const brightness = k.mul(k).mul(2.5).add(0.35);
  const twinkle = sin(uTime.mul(k.mul(2.5).add(1.2)).add(h.mul(6283))).mul(0.3).add(0.7);
  return isStar.select(dot_.mul(brightness).mul(twinkle), 0);
});

/**
 * Time-of-day sky (linear HDR, before tone mapping). Gradient from the shared
 * zenith/horizon uniforms, a horizon glow lobe towards the sun (golden hour /
 * dusk), sun disc, moon disc + stars at night. Below the horizon it fades into
 * a soft haze (`uSkyGround`) so the cloud sea reads against it.
 */
export const skyNode = Fn(() => {
  const dir = normalize(positionWorldDirection);
  const y = dir.y;

  // Base gradient: horizon band widens near the horizon (pow < 1).
  const up = max(y, 0);
  const t = pow(up, 0.45);
  const sky = mix(uSkyHorizon, uSkyZenith, t).toVar();

  // Below horizon: haze → ground tone.
  const down = smoothstep(0, -0.35, y);
  sky.assign(mix(sky, uSkyGround, down));

  // Sun-side horizon glow (Mie-ish forward lobe), strongest near the horizon.
  const sunDot = max(dot(dir, uSunDirection), 0);
  const sunAlt = uSunDirection.y;
  const glowAmount = smoothstep(-0.2, 0.0, sunAlt).mul(smoothstep(0.55, 0.05, sunAlt));
  const horizonWeight = exp(abs(y).mul(-4.5));
  const glow = pow(sunDot, 6).mul(horizonWeight).mul(glowAmount).mul(1.1);
  sky.addAssign(uSunGlowColor.mul(glow));
  // Broad soft halo around the sun at any altitude.
  sky.addAssign(uSunGlowColor.mul(pow(sunDot, 64).mul(0.35).mul(smoothstep(-0.05, 0.05, sunAlt))));

  // Sun disc (HDR so a later bloom pass can catch it).
  const disc = smoothstep(0.99985, 0.99993, sunDot).mul(smoothstep(-0.02, 0.01, sunAlt));
  sky.addAssign(uSunGlowColor.mul(disc.mul(25)));

  // Night: stars and the moon.
  const night = uNightFactor;
  const aboveHorizon = smoothstep(-0.02, 0.15, y);
  sky.addAssign(vec3(0.85, 0.9, 1.0).mul(stars(dir).mul(night).mul(aboveHorizon).mul(1.6)));

  const moonDot = max(dot(dir, uMoonDirection), 0);
  const moonDisc = smoothstep(0.99955, 0.99965, moonDot);
  const moonHalo = pow(moonDot, 300).mul(0.12).add(pow(moonDot, 18).mul(0.03));
  sky.addAssign(vec3(0.9, 0.93, 1.0).mul(moonDisc.mul(3).add(moonHalo)).mul(night));

  return sky;
})();

