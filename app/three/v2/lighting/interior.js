import { Color, Vector3 } from "three/webgpu";
import { float, length, mix, positionWorld, smoothstep, uniform, vec2 } from "three/tsl";

/*
 * Interior practical lights (world space). Positions were probed in the
 * running scene (raycast against the studio mesh, see report).
 */
export const TABLE_LAMP = {
  /** Bulb position: inside the pleated shade, on the stem axis. */
  position: new Vector3(0.34, -0.97, 1.29),
  /** Conical shade: bottom/top y and radius (world), for the emissive glow mask. */
  shadeBottom: -1.025,
  shadeTop: -0.84,
  radiusBottom: 0.155,
  radiusTop: 0.055,
  color: new Color().setStyle("#ffb46e", "srgb"),
};

/** Warm practicals over the two shelf racks against the back wall. */
export const RACK_LIGHTS = [
  { position: new Vector3(-1.25, 0.55, -2.55), color: new Color().setStyle("#ffd3a8", "srgb") },
  { position: new Vector3(1.25, 0.55, -2.55), color: new Color().setStyle("#ffd3a8", "srgb") },
];

/** 0 = lamps off, 1 = fully on (written by <Lights />). */
export const uLampGlow = uniform(0);
export const uLampPosition = uniform(TABLE_LAMP.position.clone());
export const uLampColor = uniform(TABLE_LAMP.color.clone());

/**
 * Emissive term for the shared baked studio material: makes the table-lamp
 * shade glow at night. Masked by a world-space cylinder around the shade so no
 * extra material / draw call is needed. `albedo` is the bake colour node.
 */
export function studioEmissiveNode(albedo) {
  const L = TABLE_LAMP;
  const d = positionWorld.sub(uLampPosition);
  const radial = length(vec2(d.x, d.z));
  const h = positionWorld.y.sub(L.shadeBottom).div(L.shadeTop - L.shadeBottom); // 0 bottom … 1 top
  const coneRadius = mix(float(L.radiusBottom), float(L.radiusTop), h.clamp());
  const inCone = smoothstep(coneRadius.add(0.012), coneRadius.sub(0.01), radial);
  const inHeight = smoothstep(-0.02, 0.01, h).mul(smoothstep(1.02, 0.97, h));
  const mask = inCone.mul(inHeight);
  return albedo.mul(uLampColor).mul(mask.mul(uLampGlow).mul(2.2));
}
