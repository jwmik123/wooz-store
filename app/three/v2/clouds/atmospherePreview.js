import { Color } from "three/webgpu";
import { useFrame } from "@react-three/fiber";
import {
  uNightFactor,
  uSkyHorizon,
  uSkyZenith,
  uSunColor,
  uSunDirection,
} from "../uniforms";

/*
 * DEBUG ONLY (#debug -> Clouds -> debug -> previewAtmosphere, off by default).
 * A crude stand-in for the lighting workstream so the clouds can be judged at
 * golden hour / night before the real sky drives the shared colour uniforms.
 * When off it never touches the uniforms.
 */

const KEYS = [
  // sun elevation (y), horizon, zenith, sun colour, night
  [-0.25, [0.035, 0.05, 0.1], [0.01, 0.018, 0.045], [0.16, 0.2, 0.32], 1],
  [-0.05, [0.25, 0.2, 0.3], [0.06, 0.08, 0.18], [0.35, 0.3, 0.4], 0.6],
  [0.06, [1.0, 0.62, 0.38], [0.3, 0.38, 0.62], [1.5, 0.78, 0.42], 0],
  [0.3, [0.85, 0.85, 0.88], [0.32, 0.5, 0.85], [1.15, 1.0, 0.85], 0],
  [1.0, [0.8, 0.87, 0.95], [0.35, 0.55, 0.9], [1, 0.96, 0.9], 0],
];

const a = new Color();
const b = new Color();

function sample(y, slot, out) {
  if (y <= KEYS[0][0]) return out.setRGB(...KEYS[0][slot]);
  for (let i = 1; i < KEYS.length; i++) {
    if (y <= KEYS[i][0]) {
      const t = (y - KEYS[i - 1][0]) / (KEYS[i][0] - KEYS[i - 1][0]);
      a.setRGB(...KEYS[i - 1][slot]);
      b.setRGB(...KEYS[i][slot]);
      return out.copy(a).lerp(b, t);
    }
  }
  return out.setRGB(...KEYS[KEYS.length - 1][slot]);
}

export function useAtmospherePreview(enabled) {
  useFrame(() => {
    if (!enabled) return;
    const y = uSunDirection.value.y;
    sample(y, 1, uSkyHorizon.value);
    sample(y, 2, uSkyZenith.value);
    sample(y, 3, uSunColor.value);
    let n = KEYS[KEYS.length - 1][4];
    for (let i = 1; i < KEYS.length; i++) {
      if (y <= KEYS[i][0]) {
        const t = Math.max(0, (y - KEYS[i - 1][0]) / (KEYS[i][0] - KEYS[i - 1][0]));
        n = KEYS[i - 1][4] + (KEYS[i][4] - KEYS[i - 1][4]) * Math.min(t, 1);
        break;
      }
    }
    uNightFactor.value = n;
  }, -50);
}
