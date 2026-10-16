import { Color, Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { computeAtmosphere } from "./lighting/atmosphere";
import useEnvironmentStore, {
  getLocalHours,
} from "../../stores/environmentStore";

/*
 * Shared TSL uniforms. Import these directly into any TSL graph:
 *
 *   import { uTime, uWindStrength } from "../uniforms";
 *   material.positionNode = positionLocal.add(sin(uTime).mul(uWindStrength) ...)
 *
 * They are written in ONE place: <SharedUniforms /> (mounted once in Scene.jsx).
 * Never assign `.value` elsewhere; change the environment store instead.
 */

/** Seconds since the canvas started (float). */
export const uTime = uniform(0);

/**
 * Time of day normalized: 0 = 00:00, 0.5 = 12:00, 1 = 24:00 (float).
 * Smoothed: eases towards the target when the debug slider is scrubbed.
 */
export const uDayProgress = uniform(0);

/**
 * World-space unit vector pointing FROM the scene TOWARDS the sun (vec3).
 * Below the horizon (y < 0) at night. Solar model in ./lighting/atmosphere.js:
 * +X = east, +Z = south (behind the default camera), -X = west.
 */
export const uSunDirection = uniform(new Vector3(0, 1, 0));

/**
 * World-space unit vector TOWARDS the current key light (vec3): equals
 * uSunDirection by day (clamped just above the horizon around sunset) and points
 * at the moon at night. The studio's single shadow-casting light uses this.
 */
export const uKeyLightDirection = uniform(new Vector3(0, 1, 0));

/** World-space unit wind direction on the XZ plane (vec3, y = 0). */
export const uWindDirection = uniform(new Vector3(1, 0, 0));

/** Wind strength, 0 = calm, ~1 = strong (float). */
export const uWindStrength = uniform(0.4);

// --- Atmosphere colours ------------------------------------------------------
// Driven by the lighting workstream (lighting/atmosphere.js), read by clouds,
// wind strokes, post etc. so everything shares one sky. Linear-sRGB colours.

/**
 * Key light colour × intensity (vec3): the sun by day, the moon by night.
 * ≈ (1, 0.97, 0.93) at midday, warm orange and dimmer at golden hour, ~0 during
 * the sun→moon hand-over (sun -3…-6° below the horizon), dim cool blue (~0.1)
 * at night. Pair with uKeyLightDirection.
 */
export const uSunColor = uniform(new Color(1, 0.96, 0.9));
/** Sky colour straight up (vec3). */
export const uSkyZenith = uniform(new Color(0.35, 0.55, 0.9));
/**
 * Sky colour at the horizon / fog colour for distant clouds (vec3).
 * Golden at sunset, pink→violet at dusk, deep blue at night.
 */
export const uSkyHorizon = uniform(new Color(0.8, 0.87, 0.95));
/** 0 = day (sun above -1°), 1 = night (sun below -12°), smooth in between (float). */
export const uNightFactor = uniform(0);

// --- Time of day → sun + atmosphere ----------------------------------------
// The sun model and colour keyframes live in ./lighting/atmosphere.js (owned by
// the lighting workstream). This updater smooths the clock (slider scrubs ease
// instead of popping), runs the debug time-lapse and writes the shared uniforms.

export { sunDirectionFromHours } from "./lighting/atmosphere";

/** Debug-only time controls (written by the lighting leva panel). */
export const timeSettings = {
  /** Run a full 24 h day in `timeLapseSeconds` (switches the store to manual). */
  timeLapse: false,
  timeLapseSeconds: 60,
  /** Ease rate for scrubbing (1/s); higher = snappier. */
  smoothing: 2.5,
};

const SYNC_INTERVAL = 30; // seconds between store syncs of the local clock
const TIME_LAPSE_STORE_SYNC = 0.25; // seconds between store writes during a time-lapse
const KEY_INTENSITY_REF = 3.6; // full-day sun intensity → uSunColor ≈ 1

/** Shortest signed difference b - a on a 24 h circle, in [-12, 12). */
const hourDelta = (a, b) => ((((b - a + 12) % 24) + 24) % 24) - 12;
const wrapHours = (h) => ((h % 24) + 24) % 24;

/** Mount once inside <Canvas>. Runs before other frame callbacks. */
export function SharedUniforms() {
  const lastSync = useRef(-Infinity);
  const hoursRef = useRef(null);

  useFrame((state, delta) => {
    const env = useEnvironmentStore.getState();
    const elapsed = state.clock.elapsedTime;
    const dt = Number.isFinite(delta) ? Math.min(Math.max(delta, 0), 0.1) : 0;

    if (env.mode === "auto" && elapsed - lastSync.current > SYNC_INTERVAL) {
      lastSync.current = elapsed;
      env.syncLocalTime();
    }

    let hours = Number.isFinite(hoursRef.current) ? hoursRef.current : null;
    if (timeSettings.timeLapse) {
      hours = wrapHours((hours ?? env.timeOfDay) + (dt * 24) / timeSettings.timeLapseSeconds);
      if (elapsed - lastSync.current > TIME_LAPSE_STORE_SYNC) {
        lastSync.current = elapsed;
        env.setTimeOfDay(hours); // keeps the debug slider in sync
      }
    } else {
      const target = env.mode === "auto" ? getLocalHours() : env.timeOfDay;
      hours =
        hours === null
          ? target
          : wrapHours(hours + hourDelta(hours, target) * (1 - Math.exp(-dt * timeSettings.smoothing)));
    }
    hoursRef.current = hours;

    uTime.value = elapsed;
    uDayProgress.value = hours / 24;

    const a = computeAtmosphere(hours);
    uSunDirection.value.copy(a.sunDirection);
    uKeyLightDirection.value.copy(a.keyDirection);
    uSunColor.value.copy(a.keyColor).multiplyScalar(a.keyIntensity / KEY_INTENSITY_REF);
    uSkyZenith.value.copy(a.zenith);
    uSkyHorizon.value.copy(a.horizon);
    uNightFactor.value = a.night;

    const [wx, , wz] = env.windDirection;
    uWindDirection.value.set(wx, 0, wz).normalize();
    uWindStrength.value = env.windStrength;
  }, -100);

  return null;
}
