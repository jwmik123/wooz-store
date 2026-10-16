import {
  BufferAttribute,
  MeshStandardNodeMaterial,
  Quaternion,
  Vector3,
} from "three/webgpu";
import {
  attribute,
  cameraViewMatrix,
  dot,
  faceDirection,
  float,
  length,
  modelWorldMatrix,
  modelWorldMatrixInverse,
  normalWorld,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  vec3,
  vec4,
} from "three/tsl";
import { uTime, uWindDirection, uWindStrength } from "../uniforms";

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

  // Slow gusts: 0.15..1 envelope.
  const gust = float(0.55)
    .add(
      sin(uTime.mul(0.37).add(travel.mul(0.5)))
        .mul(sin(uTime.mul(0.23).add(1.7)))
        .mul(0.45)
    )
    .max(0.15);

  // Displacement (metres, world space) of a world-space point `p`.
  const displace = (p, nrm) => {
    const amp = uWindStrength.mul(weight).mul(0.1);
    const main = sin(uTime.mul(1.3).sub(travel))
      .mul(0.5)
      .add(sin(uTime.mul(2.1).sub(travel.mul(1.3)).add(1.7)).mul(0.25))
      .add(0.65);
    const along = dir.mul(main.mul(gust).mul(amp));
    const lateral = side.mul(
      sin(uTime.mul(1.7).sub(travel.mul(0.8)).add(p.y.mul(3)).add(idPhase))
        .mul(0.35)
        .mul(amp)
    );
    // travelling ripples across the cloth, pushing along the surface normal
    const ripple = sin(
      dot(p, dir).mul(14).sub(uTime.mul(4.5)).add(p.y.mul(6)).add(idPhase)
    )
      .mul(0.5)
      .mul(amp)
      .mul(smoothstep(0.1, 0.7, gust));
    const push = nrm.mul(ripple);
    // slight twist around the hanger
    const r = p.sub(pivotWorld).mul(vec3(1, 0, 1));
    const ang = sin(uTime.mul(0.9).sub(travel)).mul(0.35).mul(gust).mul(amp);
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

  return material;
}
