import { Color, MathUtils, Vector3 } from "three/webgpu";

/*
 * Sun model + time-of-day atmosphere (pure JS, no React).
 *
 * World frame (see Studio.jsx): +Y up, default camera at +Z looking -Z into the
 * open front of the studio. The glass long walls face ±X and the gable ridge
 * runs along Z. Compass:
 *
 *     +X = east   morning sun through the right-hand glass wall
 *     +Z = south  midday sun over the roof, from behind the camera
 *     -X = west   evening sun through the left-hand glass wall
 *
 * The sun path is art-directed rather than astronomical: an arc that rises in
 * the east-south-east, culminates in the south and sets west-south-west, so the
 * studio is front/side-lit all day (a real summer sun rises in the north-east
 * and would backlight the back wall every morning and evening). Timing follows
 * a Dutch late-spring day: sunrise 06:00, golden hour ≈ 18:45–20:15, sunset
 * 20:15, blue hour ≈ 20:15–21:00, full night from ≈ 21:30.
 */

export const SUN_MODEL = {
  sunrise: 6, // local clock hours
  sunset: 20.25,
  maxElevation: 55, // degrees at solar noon
  nightDepth: 35, // degrees below the horizon at solar midnight
  arcTilt: 22, // degrees the rise/set points sit towards +Z (south) from due east/west
  azimuthOffset: 0, // degrees, rotates the whole path around +Y
  moonMinElevation: 28, // the moon stays high enough to shine through the roof
  moonMaxElevation: 50,
};

const DEG = Math.PI / 180;

/**
 * Phase of the day: { day, t } where t ∈ [0, 1] runs sunrise→sunset when
 * day = true, sunset→sunrise when day = false.
 */
function dayPhase(hours, m) {
  const dayLen = m.sunset - m.sunrise;
  const h = ((((hours - m.sunrise) % 24) + 24) % 24); // hours since sunrise
  return h <= dayLen ? { day: true, t: h / dayLen } : { day: false, t: (h - dayLen) / (24 - dayLen) };
}

/** Direction on an east→south→west arc for phase t ∈ [0,1] and elevation (rad). */
function arcDirection(t, elevation, m, target) {
  const a0 = m.arcTilt * DEG;
  const az = MathUtils.lerp(a0, Math.PI - a0, t) + m.azimuthOffset * DEG; // 0 = +X, π/2 = +Z
  const c = Math.cos(elevation);
  return target.set(Math.cos(az) * c, Math.sin(elevation), Math.sin(az) * c);
}

/**
 * World-space unit vector pointing FROM the scene TOWARDS the sun for a local
 * clock time (fractional hours). y < 0 when the sun is below the horizon.
 */
export function sunDirectionFromHours(hours, target = new Vector3(), model = SUN_MODEL) {
  const { day, t } = dayPhase(hours, model);
  if (day) return arcDirection(t, Math.sin(Math.PI * t) * model.maxElevation * DEG, model, target);
  // Below the horizon the sun keeps travelling west → north → east.
  const a0 = model.arcTilt * DEG;
  const az = MathUtils.lerp(Math.PI - a0, 2 * Math.PI + a0, t) + model.azimuthOffset * DEG;
  const el = -Math.sin(Math.PI * t) * model.nightDepth * DEG;
  const c = Math.cos(el);
  return target.set(Math.cos(az) * c, Math.sin(el), Math.sin(az) * c);
}

/**
 * Moon: art-directed. Crosses the same east→south→west arc during the night,
 * never lower than `moonMinElevation` so moonlight falls through the roof glass.
 */
export function moonDirectionFromHours(hours, target = new Vector3(), model = SUN_MODEL) {
  const { day, t } = dayPhase(hours, model);
  const nt = day ? (t < 0.5 ? 1 : 0) : t; // park at the rise/set point by day (invisible)
  const el = Math.max(Math.sin(Math.PI * nt) * model.moonMaxElevation, model.moonMinElevation) * DEG;
  return arcDirection(MathUtils.lerp(0.15, 0.85, nt), el, model, target);
}


// --- Colour keyframes ----------------------------------------------------------
// Keyed by sun elevation in degrees. Authored in sRGB hex (artist friendly),
// converted to linear sRGB once. Elevation-based so dawn and dusk mirror.

const srgb = (hex) => new Color().setStyle(hex, "srgb"); // → linear working space

const SKY_KEYS = [
  // elev, zenith, horizon, ground (below-horizon haze over the clouds), ambient (hemisphere intensity)
  [-90, "#050a1a", "#0e1a35", "#0a1328", 0.06],
  [-14, "#060c22", "#122042", "#0c162f", 0.06],
  [-9, "#101a46", "#283468", "#18224a", 0.08],
  [-5, "#232b68", "#76588e", "#46386a", 0.13], // blue hour → violet
  [-2, "#38488c", "#d88896", "#9c6a84", 0.2], // dusk pink
  [1, "#5670b4", "#f5a172", "#d4907e", 0.28], // sunset orange
  [5, "#6a8fcb", "#f8c897", "#e6b7a0", 0.36], // golden hour
  [12, "#6c9bd6", "#f0dcc4", "#d9d5d5", 0.44],
  [25, "#6aa2e0", "#d6e5f2", "#cad8e6", 0.52],
  [60, "#5f9ce0", "#cde0f2", "#c4d6ea", 0.58],
  [90, "#5f9ce0", "#cde0f2", "#c4d6ea", 0.58],
].map(([e, z, h, g, amb]) => ({ e, zenith: srgb(z), horizon: srgb(h), ground: srgb(g), amb }));

const SUN_KEYS = [
  // elev, colour, DirectionalLight.intensity
  [-3, "#ff5a30", 0],
  [-1, "#ff6a38", 0.6],
  [2, "#ff8a4c", 2.2],
  [6, "#ffa866", 3.2],
  [12, "#ffc085", 3.7],
  [25, "#ffdcb6", 4.1],
  [45, "#ffeedc", 4.3],
  [90, "#fff6ec", 4.4],
].map(([e, c, i]) => ({ e, color: srgb(c), intensity: i }));

const MOON_COLOR = srgb("#b9c5df"); // soft silver, not saturated blue (sits better with the warm lamps)

function sampleKeys(keys, e, fn) {
  if (e <= keys[0].e) return fn(keys[0], keys[0], 0);
  for (let i = 1; i < keys.length; i++) {
    if (e <= keys[i].e) {
      const a = keys[i - 1];
      const b = keys[i];
      const t = MathUtils.smoothstep(e, a.e, b.e);
      return fn(a, b, t);
    }
  }
  const last = keys[keys.length - 1];
  return fn(last, last, 0);
}

// --- Tunables (leva writes these) -----------------------------------------------

export const ATMOSPHERE_SETTINGS = {
  sunIntensity: 1, // multiplier on SUN_KEYS intensity
  moonIntensity: 0.22, // DirectionalLight.intensity of the moon (subtle: the lamps carry the night)
  ambientIntensity: 1, // multiplier on the hemisphere fill keyframes
  bounce: 0.7, // floor/ground bounce strength relative to the sky fill
  exposureDay: 1.2,
  exposureNight: 1.55,
  // Baked GI (studio lightmap, see ./lightmap.js)
  skyFill: 0.55, // multiplier on the sky-dome radiance lighting the sky map
  skyTint: 0.4, // 0 = neutral white sky light … 1 = full zenith/horizon colour
  sunBounce: 1.2, // multiplier on the baked sun bounce (1 = physically matched to the key light)
  lampFill: 2.2, // baked lamp light at full night
};

const LAMP_COLOR = srgb("#ffc48a");
/** Lawn bounce tint for the hemisphere ground colour (matches the GI bake's grass). */
const GRASS_BOUNCE = srgb("#9ab87a");

// --- Computed state -----------------------------------------------------------------

/**
 * Everything the lighting rig + shared uniforms need for one time of day.
 * Written by computeAtmosphere(); colours are linear sRGB.
 */
export const atmosphere = {
  hours: 12,
  sunDirection: new Vector3(0, 1, 0),
  moonDirection: new Vector3(0, 1, 0),
  /** Direction of whichever body currently lights the scene (sun by day, moon by night). */
  keyDirection: new Vector3(0, 1, 0),
  sunElevation: 0, // degrees
  keyColor: new Color(), // normalised colour of the key light
  keyIntensity: 0,
  zenith: new Color(),
  horizon: new Color(),
  ground: new Color(),
  hemiSky: new Color(),
  hemiGround: new Color(),
  hemiIntensity: 1,
  night: 0, // 0 day … 1 night
  lamps: 0, // 0 off … 1 interior lamps fully on
  exposure: 1,
  /** Baked GI fills (linear): sky-dome radiance, sun bounce, interior lamps. */
  skyFill: new Color(),
  sunBounce: new Color(),
  lampFill: new Color(),
};

const _c = new Color();
const _c2 = new Color();
const WHITE = new Color(1, 1, 1);

/** Scale a colour to luminance 1 (keeps hue/saturation). */
function normalizeLum(c) {
  const lum = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
  return lum > 1e-5 ? c.multiplyScalar(1 / lum) : c.setRGB(1, 1, 1);
}

export function computeAtmosphere(hours, out = atmosphere, s = ATMOSPHERE_SETTINGS) {
  out.hours = hours;
  sunDirectionFromHours(hours, out.sunDirection);
  moonDirectionFromHours(hours, out.moonDirection);
  const elev = Math.asin(MathUtils.clamp(out.sunDirection.y, -1, 1)) / DEG;
  out.sunElevation = elev;

  // Night factor: 0 above -1°, 1 below -12° (nautical twilight).
  out.night = 1 - MathUtils.smoothstep(elev, -12, -1);
  // Lamps switch on during golden hour and are fully on by dusk.
  out.lamps = 1 - MathUtils.smoothstep(elev, -3, 10);

  let amb = 0;
  sampleKeys(SKY_KEYS, elev, (a, b, t) => {
    out.zenith.copy(a.zenith).lerp(b.zenith, t);
    out.horizon.copy(a.horizon).lerp(b.horizon, t);
    out.ground.copy(a.ground).lerp(b.ground, t);
    amb = MathUtils.lerp(a.amb, b.amb, t);
  });

  // Key light: sun above -3°, moon below. Both fade through zero between
  // -3° and -6° so the direction swap (and its shadow re-render) is invisible.
  let sunI = 0;
  sampleKeys(SUN_KEYS, elev, (a, b, t) => {
    out.keyColor.copy(a.color).lerp(b.color, t);
    sunI = MathUtils.lerp(a.intensity, b.intensity, t);
  });
  const sunUp = elev > -3;
  if (sunUp) {
    out.keyDirection.copy(out.sunDirection);
    if (out.keyDirection.y < 0.03) out.keyDirection.y = 0.03; // grazing, never from below
    out.keyDirection.normalize();
    out.keyIntensity = sunI * s.sunIntensity;
  } else {
    out.keyDirection.copy(out.moonDirection);
    out.keyColor.copy(MOON_COLOR);
    out.keyIntensity = (1 - MathUtils.smoothstep(elev, -12, -5)) * s.moonIntensity;
  }

  // Hemisphere fill. Colours are luminance-normalised; brightness lives in
  // hemiIntensity. Sky side = dome average, ground side = warm bounce of the
  // sunlit floor (falls back to the haze colour when the sun is down).
  normalizeLum(out.hemiSky.copy(out.zenith).lerp(out.horizon, 0.45)).lerp(WHITE, 0.5);
  normalizeLum(_c.copy(out.ground)).lerp(WHITE, 0.3);
  const sunBounce = sunUp ? MathUtils.smoothstep(elev, -2, 10) : 0;
  out.hemiGround.copy(_c).lerp(normalizeLum(_c2.copy(out.keyColor)), 0.65 * sunBounce);
  // Garden lawn all around: a touch of green in the up-bounce (props, Moos, garden).
  out.hemiGround.lerp(normalizeLum(_c2.copy(GRASS_BOUNCE)), 0.3 * sunBounce);
  out.hemiGround.multiplyScalar(s.bounce * (0.55 + 0.45 * sunBounce));
  out.hemiIntensity = amb * s.ambientIntensity;

  // Baked GI fills. The sky map was baked under a uniform white dome of
  // radiance 1; tint it with the current sky (zenith/horizon average) and the
  // keyframed ambient level. Sun bounce follows the key light; lamps their switch.
  normalizeLum(out.skyFill.copy(out.zenith).lerp(out.horizon, 0.5)).lerp(WHITE, 1 - s.skyTint);
  out.skyFill.multiplyScalar(amb * s.skyFill);
  out.sunBounce.copy(out.keyColor).multiplyScalar(out.keyIntensity * s.sunBounce);
  out.lampFill.copy(LAMP_COLOR).multiplyScalar(out.lamps * s.lampFill);

  // Exposure follows the light level: brightens through sunset into the night.
  out.exposure = MathUtils.lerp(s.exposureDay, s.exposureNight, 1 - MathUtils.smoothstep(elev, -10, 20));
  return out;
}
