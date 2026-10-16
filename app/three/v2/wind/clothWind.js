import {
  BufferAttribute,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import {
  abs,
  attribute,
  cameraPosition,
  cameraViewMatrix,
  clamp,
  color,
  dot,
  faceDirection,
  float,
  length,
  mix,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  normalWorld,
  normalize,
  pow,
  positionLocal,
  sin,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import { uNightFactor, uTime, uWindDirection, uWindIndoor, uWindStrength } from "../uniforms";
import {
  uGlowAmt,
  uGlowRack,
  uSweepMax,
  uSweepMin,
  uSweepRack,
  uSweepT,
} from "../signs/signState";

/*
 * Cloth wind
 * ----------
 * Garments are separate rigid meshes without bones. A per-vertex `windData`
 * attribute (vec4) is baked once per geometry:
 *   x     = pin weight: 0 at the hanger/shoulders, 1 at the hem (eased)
 *   yzw   = hanger pivot in the mesh's local space (centroid of the top slice)
 * so ONE shared material serves all 18 garments. The vertex shader works in
 * world space (phase offsets derive from each garment's world pivot so
 * neighbours never move in sync) and converts the displacement back to local
 * space. The same positionNode drives the shadow pass.
 */

const _up = new Vector3();
const _q = new Quaternion();

/** Bakes the `windData` attribute onto a garment geometry (idempotent). */
export function bakeWindAttribute(geometry, quaternion) {
  if (geometry.getAttribute("windData")) return geometry;
  const pos = geometry.getAttribute("position");
  // Garment-local "up": rotate world up into the mesh's local frame.
  _up.set(0, 1, 0).applyQuaternion(_q.copy(quaternion).invert());

  const n = pos.count;
  const h = new Float32Array(n);
  let min = Infinity;
  let max = -Infinity;
  for (let i = 0; i < n; i++) {
    const d = pos.getX(i) * _up.x + pos.getY(i) * _up.y + pos.getZ(i) * _up.z;
    h[i] = d;
    if (d < min) min = d;
    if (d > max) max = d;
  }
  const range = Math.max(max - min, 1e-4);

  // Pivot: centroid of the top 12% slice (where the hanger sits).
  const pivot = new Vector3();
  let count = 0;
  for (let i = 0; i < n; i++) {
    if ((max - h[i]) / range < 0.12) {
      pivot.x += pos.getX(i);
      pivot.y += pos.getY(i);
      pivot.z += pos.getZ(i);
      count++;
    }
  }
  pivot.divideScalar(Math.max(count, 1));

  const data = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = (max - h[i]) / range; // 0 top -> 1 hem
    const free = Math.min(Math.max((t - 0.08) / 0.92, 0), 1);
    data[i * 4] = Math.pow(free, 1.6); // pinned top, accelerating towards the hem
    data[i * 4 + 1] = pivot.x;
    data[i * 4 + 2] = pivot.y;
    data[i * 4 + 3] = pivot.z;
  }
  geometry.setAttribute("windData", new BufferAttribute(data, 4));
  return geometry;
}

/** Per-vertex rack id (float) for the hover glow / idle sweep (idempotent). */
export function bakeRackId(geometry, id) {
  if (geometry.getAttribute("rackId")) return geometry;
  const n = geometry.getAttribute("position").count;
  geometry.setAttribute("rackId", new BufferAttribute(new Float32Array(n).fill(id), 1));
  return geometry;
}

/** World axis the idle light sweep travels along (diagonal, top-left -> bottom-right). */
export const SWEEP_AXIS = new Vector3(1, -0.55, 0.35).normalize();

const EPS = 0.025;

/** Creates the shared wind-driven clothes material from the baked albedo material. */
export function createClothMaterial(baked) {
  const material = new MeshStandardNodeMaterial({
    side: baked.side,
    roughness: baked.roughness,
    metalness: baked.metalness,
  });
  material.name = "clothWind";
  material.colorNode = baked.colorNode;

  const windData = attribute("windData", "vec4");
  const weight = windData.x;
  const pivotWorld = modelWorldMatrix.mul(vec4(windData.yzw, 1)).xyz;

  const dir = vec3(uWindDirection.x, 0, uWindDirection.z);
  const side = vec3(uWindDirection.z.negate(), 0, uWindDirection.x);

  // Phase of this garment along the wind direction (decorrelates neighbours).
  const travel = dot(pivotWorld, dir).mul(0.9).add(pivotWorld.y.mul(0.3));
  const idPhase = dot(pivotWorld, vec3(12.9898, 4.1414, 78.233));

  // Soft draught: calm base with an occasional slow gust (rare product of two
  // slow sines peaks) -> envelope ~0.5 .. 1.4.
  const gustWave = sin(uTime.mul(0.16).add(travel.mul(0.25))).mul(
    sin(uTime.mul(0.09).add(1.7))
  );
  const gust = float(0.5).add(smoothstep(0.35, 0.9, gustWave).mul(0.9));

  // The front of the greenhouse is open (+Z): a bit more draught there, less at the back.
  const zone = mix(0.55, 1.25, smoothstep(-3.0, 3.0, pivotWorld.z));

  // Displacement (metres, world space) of a world-space point `p`.
  const displace = (p, nrm) => {
    const amp = uWindStrength.mul(uWindIndoor).mul(zone).mul(weight).mul(0.14);
    const main = sin(uTime.mul(0.5).sub(travel))
      .mul(0.5)
      .add(sin(uTime.mul(0.6).sub(travel.mul(1.3)).add(1.7)).mul(0.25))
      .add(0.2); // mostly swing, little static lean — reads as movement
    const along = dir.mul(main.mul(gust).mul(amp));
    const lateral = side.mul(
      sin(uTime.mul(0.6).sub(travel.mul(0.8)).add(p.y.mul(3)).add(idPhase))
        .mul(0.35)
        .mul(amp)
    );
    // travelling ripples across the cloth, pushing along the surface normal
    const ripple = sin(
      dot(p, dir).mul(10).sub(uTime.mul(0.8)).add(p.y.mul(6)).add(idPhase)
    )
      .mul(0.35)
      .mul(amp)
      .mul(smoothstep(0.45, 1.2, gust));
    const push = nrm.mul(ripple);
    // slight twist around the hanger
    const r = p.sub(pivotWorld).mul(vec3(1, 0, 1));
    const ang = sin(uTime.mul(0.35).sub(travel)).mul(0.35).mul(gust).mul(amp);
    const twist = vec3(r.z.negate(), 0, r.x).mul(ang);
    const horiz = along.add(lateral).add(push).add(twist);
    // cloth shortens as it swings out
    const lift = length(horiz).mul(-0.18);
    return horiz.add(vec3(0, lift, 0));
  };

  const worldPos = modelWorldMatrix.mul(vec4(positionLocal, 1)).xyz;
  const nBase = normalize(normalWorld);
  const d0 = displace(worldPos, nBase);

  // local-space displacement for positionNode (also used by the shadow pass)
  material.positionNode = positionLocal.add(
    modelWorldMatrixInverse.mul(vec4(d0, 0)).xyz
  );

  // Approximate deformed normal: n' = N - J^T N, J by forward differences.
  const dx = displace(worldPos.add(vec3(EPS, 0, 0)), nBase).sub(d0).div(EPS);
  const dy = displace(worldPos.add(vec3(0, EPS, 0)), nBase).sub(d0).div(EPS);
  const dz = displace(worldPos.add(vec3(0, 0, EPS)), nBase).sub(d0).div(EPS);
  const nWorld = normalize(
    nBase.sub(vec3(dot(nBase, dx), dot(nBase, dy), dot(nBase, dz)))
  );
  // normalNode is view space; keep two-sided shading correct.
  // Evaluated per vertex and interpolated (varying), not per pixel.
  const nView = cameraViewMatrix.mul(vec4(nWorld, 0)).xyz.toVarying("windNormal");
  material.normalNode = normalize(nView).mul(faceDirection);

  // Rack highlight (add to the emissive after the baked lighting is applied,
  // see Clothes.jsx): soft fresnel rim on the hovered rack + an occasional
  // diagonal light sweep over one rack (discoverability hint when idle).
  const rackId = attribute("rackId", "float");
  const pWorld = worldPos.add(d0).toVarying("clothWorldPos");
  const viewDir = normalize(cameraPosition.sub(pWorld));
  const facing = abs(dot(normalize(nWorld.toVarying("clothWorldNormal")), viewDir));
  const rim = pow(clamp(float(1).sub(facing), 0, 1), 2.5);
  const isGlow = float(1).sub(clamp(abs(rackId.sub(uGlowRack)), 0, 1));
  // Warmer, a bit stronger at night (the scene is darker, emissive reads more).
  const glowColor = mix(color("#fff1d6"), color("#ffcf9a"), uNightFactor);
  const glow = rim.mul(0.55).add(0.05).mul(isGlow).mul(uGlowAmt);
  const isSweep = float(1).sub(clamp(abs(rackId.sub(uSweepRack)), 0, 1));
  const s = dot(pWorld, vec3(SWEEP_AXIS.x, SWEEP_AXIS.y, SWEEP_AXIS.z));
  const head = mix(uSweepMin, uSweepMax, uSweepT);
  const band = smoothstep(0.16, 0.0, abs(s.sub(head)));
  const sweep = band.mul(rim.mul(0.6).add(0.12)).mul(isSweep);
  material.userData.highlightNode = glowColor.mul(glow.add(sweep));

  return material;
}
