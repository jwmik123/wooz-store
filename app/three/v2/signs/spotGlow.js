import {
  abs,
  cameraPosition,
  clamp,
  color,
  dot,
  float,
  max,
  mix,
  normalWorld,
  normalize,
  positionWorld,
  pow,
  smoothstep,
  vec3,
} from "three/tsl";
import { uNightFactor } from "../uniforms";
import { SWEEP_AXIS } from "../wind/clothWind";
import {
  uSpotHoverAmt,
  uSpotHoverC,
  uSpotHoverH,
  uSpotSweepC,
  uSpotSweepH,
  uSpotSweepT,
} from "./signState";

/*
 * Table-piece highlight for the studio shell material (the coffee cup,
 * lookbook and totebag are part of the shell mesh): an emissive term masked
 * to a soft world-space box around the hovered piece (fresnel rim glow) and
 * around the idle-sweep piece (a diagonal light band gliding over it).
 * Two box uniforms, no extra draw calls.
 */

const EDGE = 0.025;

/** 1 inside the box (centre c, half size h), soft falloff over EDGE outside. */
const boxMask = (p, c, h) => {
  const d = abs(p.sub(c)).sub(h);
  return smoothstep(EDGE, 0, max(max(d.x, d.y), d.z));
};

export function spotHighlightNode() {
  const p = positionWorld;
  const viewDir = normalize(cameraPosition.sub(p));
  const facing = abs(dot(normalize(normalWorld), viewDir));
  const rim = pow(clamp(float(1).sub(facing), 0, 1), 2.5);
  const glowColor = mix(color("#fff1d6"), color("#ffcf9a"), uNightFactor);

  const hover = boxMask(p, uSpotHoverC, uSpotHoverH).mul(rim.mul(0.5).add(0.1)).mul(uSpotHoverAmt);

  const axis = vec3(SWEEP_AXIS.x, SWEEP_AXIS.y, SWEEP_AXIS.z);
  const reach = dot(abs(axis), uSpotSweepH).add(0.08);
  const s = dot(p.sub(uSpotSweepC), axis);
  const head = mix(reach.negate(), reach, uSpotSweepT);
  const band = smoothstep(0.07, 0.0, abs(s.sub(head)));
  const sweep = boxMask(p, uSpotSweepC, uSpotSweepH).mul(band).mul(rim.mul(0.6).add(0.18));

  return glowColor.mul(hover.add(sweep));
}
