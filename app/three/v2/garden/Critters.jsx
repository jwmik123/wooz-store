"use client";

import { useEffect, useMemo } from "react";
import {
  BufferAttribute,
  DoubleSide,
  InstancedBufferAttribute,
  InstancedBufferGeometry,
  MeshBasicNodeMaterial,
  Sphere,
  Vector3,
} from "three/webgpu";
import {
  Discard,
  Fn,
  If,
  attribute,
  cameraPosition,
  cameraWorldMatrix,
  cos,
  float,
  length,
  mix,
  normalize,
  select,
  sin,
  smoothstep,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { uNightFactor, uSunColor, uTime } from "../uniforms";
import { c3, isBlocked, minWidthScale, mulberry32, terrainHeight, uHemiSky } from "./gardenCommon";

/*
 * Garden life, ONE instanced draw call:
 *  - 60 fireflies (night): glowing 1.2 cm points drifting 0.3-1.4 m above the
 *    meadow, blinking; HDR colour so the bloom pass gives them a halo.
 *  - 9 butterflies (day): two flapping wings (≈ 5 cm span) fluttering along
 *    Lissajous loops over the flower drifts.
 * Each instance is two quads; fireflies collapse the second one. Visibility is
 * driven by uNightFactor entirely on the GPU.
 */

const FIREFLIES = 60;
const BUTTERFLIES = 9;

function build(quality) {
  const rand = mulberry32(31);
  const nf = Math.round(FIREFLIES * quality);
  const nb = Math.round(BUTTERFLIES * quality);
  const a = []; // home x, y, z, type (0 firefly, 1 butterfly)
  const b = []; // seed, radius, speed, colour index
  for (let i = 0; i < nf; i++) {
    let x;
    let z;
    do {
      const ang = rand() * Math.PI * 2;
      const r = 2.8 + rand() * 9;
      x = Math.cos(ang) * r;
      z = Math.sin(ang) * r + 2;
    } while (isBlocked(x, z));
    a.push(x, terrainHeight(x, z) + 0.3 + rand() * 1.1, z, 0);
    b.push(rand(), 0.4 + rand() * 0.8, 0.3 + rand() * 0.5, 0);
  }
  const homes = [
    [-4.2, 4.5],
    [4.8, 7.2],
    [-6.5, 7.8],
    [-3.0, -0.5],
    [3.2, -1.5],
    [-1.8, 9.5],
    [2.6, 10.0],
    [6.9, 2.0],
    [-7.5, -5.5],
  ];
  for (let i = 0; i < nb; i++) {
    const [x, z] = homes[i % homes.length];
    a.push(x, terrainHeight(x, z) + 0.5 + rand() * 0.5, z, 1);
    b.push(rand(), 0.8 + rand() * 1.2, 0.5 + rand() * 0.4, i % 4);
  }
  const g = new InstancedBufferGeometry();
  // Two quads: corner xy in [-1, 1], quad id in z.
  const pos = [];
  for (let q = 0; q < 2; q++) pos.push(-1, -1, q, 1, -1, q, 1, 1, q, -1, 1, q);
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.setAttribute("iHome", new InstancedBufferAttribute(new Float32Array(a), 4));
  g.setAttribute("iPar", new InstancedBufferAttribute(new Float32Array(b), 4));
  g.instanceCount = nf + nb;
  g.boundingSphere = new Sphere(new Vector3(0, -1, 2), 20);
  return g;
}

function makeMaterial() {
  const m = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  m.name = "gardenCritters";
  const corner = attribute("position", "vec3");
  const home = attribute("iHome", "vec4");
  const par = attribute("iPar", "vec4");
  const isFly = home.w.lessThan(0.5);
  const seed = par.x;
  const t = uTime.mul(par.z).add(seed.mul(100));

  // Wander path.
  const flyPath = vec3(sin(t.mul(0.7)).add(sin(t.mul(1.9)).mul(0.3)), sin(t.mul(1.1)).mul(0.35), cos(t.mul(0.53)).add(cos(t.mul(1.7)).mul(0.3))).mul(par.y);
  const bflyPath = vec3(sin(t.mul(0.9)), sin(t.mul(3.1)).mul(0.12).add(sin(t.mul(0.6)).mul(0.2)), sin(t.mul(1.35).add(1.3))).mul(par.y);
  const pathAt = (dt) => {
    const tt = t.add(dt);
    return vec3(sin(tt.mul(0.9)), 0, sin(tt.mul(1.35).add(1.3))).mul(par.y);
  };
  const center = home.xyz.add(select(isFly, flyPath, bflyPath));

  // Visibility: fireflies at night, butterflies by day.
  const night = uNightFactor;
  const blink = smoothstep(0.35, 0.9, sin(uTime.mul(par.z.mul(3).add(1.2)).add(seed.mul(50))).mul(0.5).add(0.5));
  const vis = select(isFly, night.mul(blink.mul(0.85).add(0.15)), float(1).sub(night));

  const dist = length(center.sub(cameraPosition));
  const right = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz;
  const up = cameraWorldMatrix.mul(vec4(0, 1, 0, 0)).xyz;

  // Firefly: camera-facing dot, ≥ ~2 px.
  const flySize = float(0.006).mul(minWidthScale(float(0.012), dist)).mul(select(corner.z.lessThan(0.5).and(vis.greaterThan(0.02)), float(1), float(0)));
  const flyPos = center.add(right.mul(corner.x.mul(flySize))).add(up.mul(corner.y.mul(flySize)));

  // Butterfly: two wings hinged on the body axis (heading = path tangent).
  const fwd = normalize(pathAt(0.05).sub(pathAt(0)).add(vec3(1e-4, 0, 0)));
  const side = normalize(vec3(fwd.z.negate(), 0, fwd.x));
  const flap = sin(uTime.mul(16).add(seed.mul(20))).mul(0.85).add(0.35);
  const wingSign = select(corner.z.lessThan(0.5), float(-1), float(1));
  // Wing: corner.x along the span (0..1 from the body), corner.y along the body.
  const span = corner.x.mul(0.5).add(0.5).mul(0.028);
  const along = corner.y.mul(0.018);
  const wingDir = side.mul(wingSign.mul(cos(flap))).add(vec3(0, sin(flap), 0));
  const bScale = select(vis.greaterThan(0.02), float(1), float(0));
  const bflyPos = center.add(wingDir.mul(span.mul(bScale))).add(fwd.mul(along.mul(bScale)));

  m.positionNode = select(isFly, flyPos, bflyPos);

  const vUv = varying(corner.xy, "vCritterUv");
  const vFly = varying(select(isFly, float(1), float(0)), "vCritterFly");
  const vCol = varying(par.w, "vCritterCol");
  const vVis = varying(vis, "vCritterVis");
  const vLight = varying(uSunColor.mul(3.6 / Math.PI).add(uHemiSky.mul(1 / Math.PI)), "vCritterLight");

  m.colorNode = Fn(() => {
    const out = vec3(0).toVar();
    If(vFly.greaterThan(0.5), () => {
      const d = length(vUv);
      If(d.greaterThan(1), () => {
        Discard();
      });
      out.assign(mix(c3("#e9ff9a"), c3("#c6f06a"), d).mul(vVis.mul(14)));
    }).Else(() => {
      // Wing shape: fore + hind lobe.
      const u = vUv.x.mul(0.5).add(0.5); // 0 at body … 1 at tip
      const v = vUv.y;
      const fore = length(vec2(u.sub(0.55).mul(1.3), v.sub(0.35).mul(1.1)));
      const hind = length(vec2(u.sub(0.4).mul(1.6), v.add(0.45).mul(1.4)));
      If(fore.greaterThan(0.6).and(hind.greaterThan(0.55)), () => {
        Discard();
      });
      const ci = vCol;
      const base = select(
        ci.lessThan(0.5),
        c3("#f3e27a"),
        select(ci.lessThan(1.5), c3("#f6f3ea"), select(ci.lessThan(2.5), c3("#a9c6f0"), c3("#f4b98a")))
      );
      const edge = smoothstep(0.42, 0.6, fore).mul(smoothstep(0.38, 0.55, hind));
      const spot = smoothstep(0.08, 0.04, length(vec2(u.sub(0.65), v.sub(0.35))));
      out.assign(mix(base, base.mul(0.55), spot.add(edge.mul(0.2))).mul(vLight));
    });
    return vec4(out, 1);
  })();
  return m;
}

export default function Critters({ quality = 1 }) {
  const geometry = useMemo(() => build(quality), [quality]);
  const material = useMemo(makeMaterial, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="gardenCritters" geometry={geometry} material={material} frustumCulled={false} raycast={() => null} />;
}
