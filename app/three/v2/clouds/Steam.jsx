"use client";

import { useMemo } from "react";
import { AdditiveBlending, MeshBasicNodeMaterial } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  exp,
  float,
  normalize,
  positionLocal,
  sin,
  smoothstep,
  texture,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uSkyHorizon, uSunColor, uTime } from "../uniforms";
import { getCloudNoiseTexture } from "./noiseTexture";

/*
 * A tiny steam wisp above the coffee cup: one cylindrical billboard (rotates
 * around Y only) with a scrolling noise column. 1 draw call, a few hundred px.
 * Cup = Hotspots.jsx hitbox, studio-local [2.9, 0.75, 0.5] -> world.
 */
const CUP_TOP = [-0.5, -1.09, 1.495];
const WIDTH = 0.09;
const HEIGHT = 0.26;

function makeMaterial() {
  const noise = texture(getCloudNoiseTexture());
  const material = new MeshBasicNodeMaterial({
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    fog: false,
  });
  material.name = "coffeeSteam";

  // Cylindrical billboard: rotate the quad around world Y towards the camera.
  material.positionNode = Fn(() => {
    const toCam = normalize(cameraPosition.xz.sub(vec2(CUP_TOP[0], CUP_TOP[2])));
    const right = vec3(toCam.y, 0, toCam.x.negate());
    return right.mul(positionLocal.x).add(vec3(0, positionLocal.y, 0));
  })();

  material.colorNode = Fn(() => {
    const p = uv();
    const t = uTime;
    // Sinuous centre line that sways more as the steam rises.
    const sway = sin(p.y.mul(9).sub(t.mul(1.7))).mul(0.12).mul(p.y);
    const n = noise.sample(vec2(p.x.mul(0.35), p.y.mul(0.5).sub(t.mul(0.12)))).r;
    const width = float(0.07).add(p.y.mul(0.16));
    const dx = p.x.sub(0.5).sub(sway).sub(n.sub(0.5).mul(0.25)).div(width);
    const column = exp(dx.mul(dx).negate());
    const wisps = noise.sample(vec2(p.x.mul(0.8), p.y.mul(0.9).sub(t.mul(0.22)))).g;
    const fade = smoothstep(0.0, 0.12, p.y).mul(smoothstep(1.0, 0.35, p.y));
    const a = column.mul(wisps.mul(1.6).sub(0.3).max(0)).mul(fade).mul(0.22);
    const tint = uSkyHorizon.mul(0.6).add(uSunColor.mul(0.4));
    return vec4(tint.mul(a), 1);
  })();

  return material;
}

export default function Steam() {
  const material = useMemo(makeMaterial, []);
  return (
    <mesh
      name="coffeeSteam"
      position={[CUP_TOP[0], CUP_TOP[1] + HEIGHT / 2, CUP_TOP[2]]}
      material={material}
      renderOrder={5}
      raycast={() => null}
      userData={{ isCloud: true }}
    >
      <planeGeometry args={[WIDTH, HEIGHT]} />
    </mesh>
  );
}
