import { Vector3 } from "three/webgpu";
import { uniform } from "three/tsl";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
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

/** Time of day normalized: 0 = 00:00, 0.5 = 12:00, 1 = 24:00 (float). */
export const uDayProgress = uniform(0);

/**
 * World-space unit vector pointing FROM the scene TOWARDS the sun (vec3).
 * Below the horizon (y < 0) at night. Placeholder arc — the lighting workstream
 * owns `sunDirectionFromHours` and may replace the model.
 */
export const uSunDirection = uniform(new Vector3(0, 1, 0));

/** World-space unit wind direction on the XZ plane (vec3, y = 0). */
export const uWindDirection = uniform(new Vector3(1, 0, 0));

/** Wind strength, 0 = calm, ~1 = strong (float). */
export const uWindStrength = uniform(0.4);

// --- Sun model (placeholder) -------------------------------------------------
// World frame: +Y up, the default camera looks down -Z into the open side of the
// studio. The studio's windows face -X... see report / Studio.jsx for details.
// Sun rises at SUNRISE in the east (+X), peaks at noon in the south (+Z, behind
// the camera, shining into the studio) and sets at SUNSET in the west (-X).
export const SUNRISE = 6;
export const SUNSET = 20;
const MAX_ELEVATION = (60 * Math.PI) / 180;

export function sunDirectionFromHours(hours, target = new Vector3()) {
  // Day phase 0..1 between sunrise and sunset; night maps beyond that range.
  const t = (hours - SUNRISE) / (SUNSET - SUNRISE);
  const azimuth = t * Math.PI; // 0 = east (+X), PI/2 = south (+Z), PI = west (-X)
  const elevation = Math.sin(t * Math.PI) * MAX_ELEVATION;
  const c = Math.cos(elevation);
  return target
    .set(Math.cos(azimuth) * c, Math.sin(elevation), Math.sin(azimuth) * c)
    .normalize();
}

// --- Updater -----------------------------------------------------------------

const SYNC_INTERVAL = 30; // seconds between store syncs of the local clock

/** Mount once inside <Canvas>. Runs before other frame callbacks. */
export function SharedUniforms() {
  const lastSync = useRef(-Infinity);
  useFrame((state) => {
    const env = useEnvironmentStore.getState();
    const elapsed = state.clock.elapsedTime;

    const hours = env.mode === "auto" ? getLocalHours() : env.timeOfDay;
    if (env.mode === "auto" && elapsed - lastSync.current > SYNC_INTERVAL) {
      lastSync.current = elapsed;
      env.syncLocalTime();
    }

    uTime.value = elapsed;
    uDayProgress.value = hours / 24;
    sunDirectionFromHours(hours, uSunDirection.value);

    const [wx, , wz] = env.windDirection;
    uWindDirection.value.set(wx, 0, wz).normalize();
    uWindStrength.value = env.windStrength;
  }, -100);
  return null;
}
