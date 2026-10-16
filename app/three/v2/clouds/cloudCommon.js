import { Vector2 } from "three/webgpu";
import {
  Fn,
  abs,
  clamp,
  dot,
  exp,
  float,
  max,
  mix,
  normalize,
  pow,
  smoothstep,
  uniform,
  vec3,
} from "three/tsl";
import {
  uNightFactor,
  uSkyHorizon,
  uSkyZenith,
  uSunColor,
  uKeyLightDirection,
  uSunDirection,
} from "../uniforms";

/*
 * Shared TSL building blocks for every cloud material. All colours are linear
 * and pre-tonemapping (renderer.toneMapping is applied at the very end).
 */

/** Accumulated wind drift in world units on XZ (written by <Clouds />). */
export const uCloudDrift = uniform(new Vector2());

/** Artistic controls (leva, #debug). */
export const uCloudBrightness = uniform(0.75);
export const uCloudFogDensity = uniform(1.0);

/**
 * Key light for clouds: the lighting workstream's key light (sun by day, moon
 * by night), kept just above the horizon so cloud tops always catch some light.
 */
export const cloudLightDir = Fn(() => {
  const k = uKeyLightDirection;
  return normalize(vec3(k.x, k.y.max(0.04), k.z));
})();

/** Direct key light reaching the cloud tops (uSunColor already fades at dusk). */
export const cloudDirect = Fn(() => {
  return uSunColor.mul(uCloudBrightness);
})();

/** Sky light from the shared atmosphere colours, by world normal Y. */
export const cloudAmbient = Fn(([normalY]) => {
  const t = clamp(normalY.mul(0.5).add(0.5), 0, 1);
  // At night the sky colours are nearly black; moonlight scattered inside the
  // cloud keeps them readable (brighter than the sky behind them).
  const moonGlow = uSunColor.mul(uNightFactor).mul(mix(float(0.25), float(0.5), t));
  return mix(uSkyHorizon, uSkyZenith, t)
    .mul(mix(float(0.85), float(1.05), t))
    .add(moonGlow)
    .mul(uCloudBrightness);
});

/** Henyey-Greenstein phase, normalised so the forward peak is ~1 at g = 0.6. */
export const phaseHG = Fn(([cosTheta, g]) => {
  const g2 = g.mul(g);
  const denom = float(1).add(g2).sub(g.mul(2).mul(cosTheta)).max(1e-4);
  return float(1).sub(g2).div(pow(denom, 1.5)).mul(0.1);
});

/**
 * Silver lining strength for a view direction (camera -> fragment): strong when
 * looking towards the low sun (golden hour), ~0 at noon or when facing away.
 */
export const silverLining = Fn(([viewDir]) => {
  const L = cloudLightDir;
  const mu = dot(viewDir, L);
  const lowSun = smoothstep(0.6, 0.05, abs(uSunDirection.y));
  // Moonlit rims at night regardless of the moon's height.
  const strength = max(lowSun.mul(0.8).add(0.2), uNightFactor.mul(1.4));
  return phaseHG(mu, float(0.65)).mul(strength);
});

/**
 * Atmospheric perspective: blend towards the horizon colour with distance and,
 * for the cloud sea, with how grazing the view ray is, so the plane's edge
 * dissolves into the sky.
 */
export const horizonFog = Fn(([color, dist, startDist, density]) => {
  const d = max(dist.sub(startDist), 0).mul(density).mul(uCloudFogDensity);
  const f = float(1).sub(exp(d.mul(d).negate()));
  return mix(color, uSkyHorizon, clamp(f, 0, 1));
});

/** 1 at night, used to cool and dim the clouds a little extra under the moon. */
export const nightTint = Fn(() => {
  return mix(vec3(1), vec3(0.75, 0.82, 1.0), uNightFactor);
})();
