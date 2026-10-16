"use client";

import { useMemo } from "react";
import { MeshBasicNodeMaterial, NormalBlending } from "three/webgpu";
import {
  Fn,
  cameraPosition,
  clamp,
  dot,
  float,
  length,
  mix,
  normalize,
  positionWorld,
  smoothstep,
  texture,
  uniform,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { getCloudNoiseTexture } from "./noiseTexture";
import {
  cloudAmbient,
  cloudDirect,
  cloudLightDir,
  horizonFog,
  nightTint,
  silverLining,
  uCloudDrift,
} from "./cloudCommon";

/*
 * Cloud sea: two huge horizontal planes far below the studio, shaded in the
 * fragment shader from a tileable noise texture. Fake relief comes from a
 * directional derivative towards the sun (one extra lookup), the plane edge
 * dissolves into uSkyHorizon. 2 draw calls, ~9 texture taps per pixel.
 *
 *   layer 0  "deck"   opaque, dense, the endless floor of clouds
 *   layer 1  "veil"   transparent, broken, higher -> parallax over the deck
 */

export const SEA_Y = -6.2;
export const VEIL_Y = -4.3;
const SIZE = 2000;

export const uSeaCoverage = uniform(0.42);
export const uVeilCoverage = uniform(0.56);

function makeMaterial({ veil }) {
  const noise = texture(getCloudNoiseTexture());
  const scale = float(veil ? 1 / 52 : 1 / 85);
  // Each layer drifts at its own speed -> parallax even with a static camera.
  const drift = uCloudDrift.mul(veil ? 1.0 : 0.6);

  // Height field of the cloud tops: broad perlin swell + rounded worley domes
  // (the cauliflower billows). Used for both the shape and the normal.
  const base = Fn(([p]) => {
    const a = noise.sample(p).r;
    const b = noise.sample(p.mul(2.3).add(vec2(0.37, 0.11))).g;
    return a.mul(0.62).add(b.mul(b).mul(0.5));
  });

  const material = new MeshBasicNodeMaterial({
    transparent: veil,
    depthWrite: !veil,
    blending: NormalBlending,
    fog: false,
  });
  material.name = veil ? "cloudVeil" : "cloudDeck";

  material.colorNode = Fn(() => {
    const wp = positionWorld;
    const toFrag = wp.sub(cameraPosition);
    const dist = length(toFrag);
    const viewDir = toFrag.div(dist);

    // Stretch the veil along the wind a little so it reads as streaks.
    const p = wp.xz.add(drift).mul(scale).mul(veil ? vec2(0.75, 1.4) : vec2(1)).toVar();
    const L = cloudLightDir;

    // Very low frequency "weather": thicker and thinner regions, hides tiling.
    const weather = noise.sample(p.mul(0.13).add(vec2(0.5, 0.21))).r;

    const h0 = base(p).toVar();
    const detail = noise.sample(p.mul(5.1).add(vec2(0.13, 0.71))).b;
    const h = h0.add(detail.sub(0.5).mul(0.1)).toVar();

    const coverage = (veil ? uVeilCoverage : uSeaCoverage).add(weather.sub(0.5).mul(0.4));
    const density = smoothstep(coverage, coverage.add(veil ? 0.2 : 0.28), h).toVar();

    // Billow normal from the height field gradient (2 extra lookups each).
    const e = float(0.005);
    const hx = base(p.add(vec2(e, 0)));
    const hz = base(p.add(vec2(0, e)));
    const k = float(veil ? 0.5 : 0.9).div(e.mul(70));
    const n = normalize(vec3(h0.sub(hx).mul(k), 1, h0.sub(hz).mul(k)));

    const ndl = dot(n, L);
    const diffuse = clamp(ndl.mul(0.7).add(0.3), 0, 1);
    // Soft self-shadowing in the troughs between billows.
    const cavity = mix(float(0.6), float(1.0), density);

    const ambient = cloudAmbient(n.y).mul(cavity).mul(0.75);
    const direct = cloudDirect.mul(diffuse.mul(diffuse)).mul(cavity).mul(1.25);
    // Thin edges glow when looking towards a low sun.
    const thin = float(1).sub(density).mul(density).mul(4).add(0.2);
    const lining = cloudDirect.mul(silverLining(viewDir)).mul(thin).mul(2.2);

    const color = ambient.add(direct).add(lining).mul(nightTint).toVar();

    // Distance + grazing angle fog: the plane edge melts into the horizon.
    const grazing = smoothstep(0.2, 0.0, dot(viewDir, vec3(0, -1, 0)));
    const fogDist = dist.mul(grazing.add(1));
    const finalColor = horizonFog(color, fogDist, float(veil ? 12 : 18), float(0.0065));

    const alpha = veil
      ? density.mul(0.8).mul(smoothstep(900, 250, dist))
      : float(1);
    return vec4(finalColor, alpha);
  })();

  return material;
}

function Layer({ y, veil, renderOrder }) {
  const material = useMemo(() => makeMaterial({ veil }), [veil]);
  return (
    <mesh
      name={veil ? "cloudVeil" : "cloudDeck"}
      position={[0, y, 0]}
      rotation-x={-Math.PI / 2}
      scale={SIZE}
      material={material}
      renderOrder={renderOrder}
      frustumCulled={false}
      raycast={() => null}
      userData={{ isCloud: true }}
    >
      <planeGeometry args={[1, 1]} />
    </mesh>
  );
}

export default function CloudSea({ deck = true, veil = true }) {
  return (
    <>
      {deck && <Layer y={SEA_Y} veil={false} renderOrder={-2} />}
      {veil && <Layer y={VEIL_Y} veil renderOrder={1} />}
    </>
  );
}
