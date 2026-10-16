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
  abs,
  atan,
  attribute,
  cameraPosition,
  cameraWorldMatrix,
  cos,
  cross,
  dot,
  float,
  floor,
  fract,
  length,
  mix,
  normalize,
  pow,
  select,
  sin,
  smoothstep,
  varying,
  vec3,
  vec4,
} from "three/tsl";
import {
  BORDERS,
  aerial,
  analyticShadow,
  bendOffset,
  c3,
  gardenLight,
  isBlocked,
  minWidthScale,
  mownAmount,
  mulberry32,
  terrainHeight,
  wildness,
  windLean,
} from "./gardenCommon";
import { BASKET_FLOWERS } from "./Props";

/*
 * Pastel cottage-garden flowers, ONE instanced draw call.
 *
 * Every instance shares one 20-vertex geometry: a 3-segment stem ribbon
 * (camera-facing around its own axis), a disc quad (daisy-type heads) and two
 * crossed quads (spikes). Per species the unused part collapses to zero area,
 * the head pattern (petals, florets, bells) is drawn procedurally in the
 * fragment shader with an alpha cut-out.
 *
 * Species and real sizes (stem / head):
 *   0 cosmos pink    45-80 cm, Ø 6-7.5 cm, 8 notched petals
 *   1 cosmos white   45-80 cm, Ø 6-7.5 cm
 *   2 cornflower     35-60 cm, Ø 3.5-4 cm, ragged florets
 *   3 chamomile      20-40 cm, Ø 2-2.4 cm, white rays + yellow dome
 *   4 lavender       30-45 cm stems in clumps, 8-12 cm spikes
 *   5 foxglove       60-90 cm stem + 35-50 cm spire of bells (1.0-1.4 m total)
 *   6 grass seed head 45-65 cm + 8-12 cm straw panicle
 *
 * Placement: drifts (clustered Gaussian scatter) in the meadow, lavender and
 * foxglove borders along the glass walls and flanking the path.
 */

const STEM_SEGS = 3;
const VERTS = STEM_SEGS * 2 + 2 + 4 + 8; // stem ribbon + tip pair, disc, 2 spike quads

function buildFlowerGeometry() {
  // fv: part (0 stem, 1 disc, 2 spike), a, b, quad id
  const fv = [];
  const index = [];
  // Stem: levels 0..STEM_SEGS, two verts each (side -1 / 1).
  for (let l = 0; l <= STEM_SEGS; l++) {
    fv.push(0, l / STEM_SEGS, -1, 0, 0, l / STEM_SEGS, 1, 0);
  }
  for (let l = 0; l < STEM_SEGS; l++) {
    const a = l * 2;
    index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  // Disc quad (uv in [-1, 1]).
  let base = (STEM_SEGS + 1) * 2;
  fv.push(1, -1, -1, 0, 1, 1, -1, 0, 1, 1, 1, 0, 1, -1, 1, 0);
  index.push(base, base + 1, base + 2, base, base + 2, base + 3);
  // Spike: two crossed vertical quads (u in [-1, 1], v in [0, 1]).
  base += 4;
  for (let q = 0; q < 2; q++) {
    const b = base + q * 4;
    fv.push(2, -1, 0, q, 2, 1, 0, q, 2, 1, 1, q, 2, -1, 1, q);
    index.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const n = fv.length / 4;
  const g = new InstancedBufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(n * 3), 3));
  g.setAttribute("fv", new BufferAttribute(new Float32Array(fv), 4));
  g.setIndex(index);
  return g;
}

// --- Placement ---------------------------------------------------------------

const SPECIES = {
  cosmosPink: 0,
  cosmosWhite: 1,
  cornflower: 2,
  chamomile: 3,
  lavender: 4,
  foxglove: 5,
  seed: 6,
};

function gauss(rand) {
  return Math.sqrt(-2 * Math.log(1 - rand() + 1e-9)) * Math.cos(2 * Math.PI * rand());
}

function scatterFlowers(quality) {
  const rand = mulberry32(777);
  const out = [];
  // [x, y, z, rotY], [stemH, headSize, species, seed], [leanX, leanZ, tiltAz, tilt]
  const add = (x, z, species, stemH, head, leanX = 0, leanZ = 0, y = terrainHeight(x, z)) => {
    const tilt = species <= 3 ? 0.35 + rand() * 0.65 : 0;
    out.push(x, y, z, rand() * Math.PI * 2, stemH, head, species, rand(), leanX, leanZ, rand() * Math.PI * 2, tilt);
  };
  const keep = () => rand() < quality;

  // Lavender bushes: flower stems fan out of a ~25 cm grey-green foliage mound
  // (the mound itself is drawn by the grass system, see BORDERS).
  for (const [cx, cz, stems] of BORDERS.lavender) {
    for (let i = 0; i < stems; i++) {
      if (!keep()) continue;
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * 0.2;
      const x = cx + Math.cos(a) * r * 0.45;
      const z = cz + Math.sin(a) * r * 0.45;
      const lean = 0.08 + r * 1.3;
      add(x, z, SPECIES.lavender, 0.3 + rand() * 0.12, 0.015 + rand() * 0.005, Math.cos(a) * lean, Math.sin(a) * lean);
    }
  }
  for (const [x, z] of BORDERS.foxglove) {
    if (!keep()) continue;
    add(x, z, SPECIES.foxglove, 0.6 + rand() * 0.3, 0.075 + rand() * 0.02, (rand() - 0.5) * 0.08, (rand() - 0.5) * 0.08);
  }

  // A little bunch of cosmos in the bicycle basket.
  for (let i = 0; i < 9; i++) {
    const a = rand() * Math.PI * 2;
    const r = rand() * 0.1;
    const bx = BASKET_FLOWERS.x + Math.cos(a) * r;
    const bz = BASKET_FLOWERS.z + Math.sin(a) * r;
    add(bx, bz, i % 3 === 0 ? 1 : 0, 0.1 + rand() * 0.08, 0.06, Math.cos(a) * 0.5, Math.sin(a) * 0.5, BASKET_FLOWERS.y - 0.1);
  }

  // Meadow drifts (clustered, not uniform noise).
  const drifts = [
    // x, z, radius, count, species mix
    [-4.2, 4.5, 1.6, 90, [0, 0, 1]],
    [-6.5, 7.8, 2.2, 110, [0, 1, 1, 2]],
    [4.8, 7.2, 1.8, 90, [2, 2, 3]],
    [6.9, 2.0, 1.4, 70, [0, 1]],
    [-7.5, -5.5, 2.0, 90, [3, 3, 2]],
    [-3.8, -6.6, 1.5, 70, [0, 0, 1]],
    [3.6, -7.4, 1.7, 80, [1, 0, 2]],
    [8.0, -1.5, 1.6, 80, [2, 3]],
    [-8.4, 1.0, 1.8, 90, [1, 1, 0]],
    [2.6, 10.0, 1.4, 60, [0, 3]],
    [-2.8, 10.4, 1.6, 70, [2, 0]],
    [-1.8, 15.5, 2.0, 80, [0, 1, 3]],
    [3.0, 16.5, 2.2, 90, [2, 2, 0]],
    [-5.0, 13.5, 2.5, 80, [3, 2]],
    [6.0, 13.0, 2.5, 80, [0, 1]],
    [-12.5, -2.0, 3.0, 90, [0, 1, 2]],
    [13.0, 4.0, 3.0, 90, [2, 3]],
    [-11.0, 9.0, 3.0, 70, [0, 2]],
    [11.5, -8.0, 3.0, 70, [1, 0]],
    [0.5, -12.5, 3.5, 90, [0, 2, 3]],
    [-9.5, 14.5, 3.0, 60, [3, 0]],
    [9.0, 16.0, 3.0, 60, [2, 1]],
  ];
  for (const [dx, dz, radius, count, mix_] of drifts) {
    for (let i = 0; i < count; i++) {
      if (!keep()) continue;
      const x = dx + gauss(rand) * radius * 0.5;
      const z = dz + gauss(rand) * radius * 0.5;
      if (isBlocked(x, z) || mownAmount(x, z) > 0.4) continue;
      const s = mix_[Math.floor(rand() * mix_.length)];
      if (s <= 1) add(x, z, s, 0.45 + rand() * 0.35, 0.06 + rand() * 0.015);
      else if (s === 2) add(x, z, s, 0.35 + rand() * 0.25, 0.035 + rand() * 0.006);
      else add(x, z, s, 0.2 + rand() * 0.2, 0.02 + rand() * 0.005);
    }
  }

  // Scattered singles + grass seed heads in the wild meadow.
  for (let i = 0; i < 3600; i++) {
    const a = rand() * Math.PI * 2;
    const r = 2.5 + Math.pow(rand(), 0.8) * 22;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 3;
    if (isBlocked(x, z) || mownAmount(x, z) > 0.3) continue;
    const w = wildness(x, z);
    if (!keep()) continue;
    if (w > 0.5 && rand() < 0.75) {
      add(x, z, SPECIES.seed, 0.42 + rand() * 0.22, 0.012 + rand() * 0.006, (rand() - 0.5) * 0.3, (rand() - 0.5) * 0.3);
    } else if (rand() < 0.22) {
      const s = rand() < 0.5 ? SPECIES.cornflower : SPECIES.chamomile;
      add(x, z, s, s === 2 ? 0.35 + rand() * 0.2 : 0.2 + rand() * 0.15, s === 2 ? 0.036 : 0.021);
    }
  }

  const n = out.length / 12;
  const a = new Float32Array(n * 4);
  const b = new Float32Array(n * 4);
  const c = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) {
    a.set(out.slice(i * 12, i * 12 + 4), i * 4);
    b.set(out.slice(i * 12 + 4, i * 12 + 8), i * 4);
    c.set(out.slice(i * 12 + 8, i * 12 + 12), i * 4);
  }
  return { a, b, c, count: n };
}

// --- Material ------------------------------------------------------------------

function makeFlowerMaterial() {
  const m = new MeshBasicNodeMaterial({ side: DoubleSide, fog: false });
  m.name = "gardenFlowers";

  const fv = attribute("fv", "vec4");
  const iPos = attribute("iPos", "vec4");
  const iPar = attribute("iPar", "vec4");
  const iExt = attribute("iExt", "vec4");

  const part = fv.x;
  const species = iPar.z;
  const seed = iPar.w;
  const stemH = iPar.x;
  const head = iPar.y;
  const isSpike = species.greaterThan(3.5);
  // Spike length / width ratio per species: lavender 6.5, foxglove 5.5, seed 7.
  const spikeLen = head.mul(select(species.lessThan(4.5), float(6.5), select(species.lessThan(5.5), float(5.5), float(7))));
  const totalH = stemH.add(select(isSpike, spikeLen.mul(0.75), head.mul(0.2)));

  const root = iPos.xyz;
  const distCam = length(root.sub(cameraPosition));
  const lean = windLean(root.xz, seed, float(1.4));
  const restLean = iExt.xy;

  // Point on the (leaning, wind-bent) stem axis at height h.
  const axisAt = (h) => {
    const k = h.div(stemH);
    const rest = vec3(restLean.x, 0, restLean.y).mul(k.mul(k).mul(stemH));
    return root.add(vec3(0, h, 0)).add(rest).add(bendOffset(lean.xy, h, totalH));
  };

  const camRight = cameraWorldMatrix.mul(vec4(1, 0, 0, 0)).xyz;
  const side = normalize(vec3(camRight.x, 0, camRight.z));

  const pos = Fn(() => {
    const isStem = part.lessThan(0.5);
    const isDisc = part.greaterThan(0.5).and(part.lessThan(1.5));

    // Stem ribbon, camera facing around its axis.
    const t = fv.y;
    const sw = select(species.equal(5), float(0.011), float(0.0045));
    const ww = sw.mul(minWidthScale(sw, distCam)).mul(float(1).sub(t.mul(0.35)));
    const stemOff = side.mul(fv.z.mul(ww).mul(0.5));

    // Disc head, tilted towards a random azimuth.
    const az = iExt.z;
    const tilt = iExt.w;
    const n = vec3(cos(az).mul(sin(tilt)), cos(tilt), sin(az).mul(sin(tilt)));
    const u = normalize(cross(n, vec3(0.001, 0, 1)));
    const v = cross(n, u);
    const r = head.mul(0.5).mul(select(isSpike, float(0), float(1)));
    const discOff = n.mul(0.004).add(u.mul(fv.y.mul(r))).add(v.mul(fv.z.mul(r)));

    // Spike: two crossed quads around the stem top (lavender starts a bit lower).
    const ang = iPos.w.add(fv.w.mul(Math.PI / 2));
    const dir = vec3(cos(ang), 0, sin(ang));
    const spikeH = stemH.sub(spikeLen.mul(0.25)).add(fv.z.mul(spikeLen));
    const w = head.mul(0.5).mul(minWidthScale(head, distCam)).mul(select(isSpike, float(1), float(0)));
    const spikeOff = dir.mul(fv.y.mul(w));

    const h = select(isStem, t.mul(stemH), select(isDisc, stemH, spikeH));
    const off = select(isStem, stemOff, select(isDisc, discOff, spikeOff));
    return axisAt(h).add(off);
  })();

  m.positionNode = pos;

  // Per-vertex light (albedo applied per fragment).
  const vLight = varying(
    Fn(() => {
      const toV = pos.sub(cameraPosition);
      const dist = length(toV);
      const viewDir = toV.div(dist);
      const az = iExt.z;
      const tilt = iExt.w;
      const discN = vec3(cos(az).mul(sin(tilt)), cos(tilt), sin(az).mul(sin(tilt)));
      const N0 = select(part.lessThan(1.5).and(part.greaterThan(0.5)), discN, normalize(vec3(viewDir.x.negate(), 0.6, viewDir.z.negate())));
      const N = select(dot(N0, viewDir).greaterThan(0), N0.negate(), N0);
      const ao = select(part.lessThan(0.5), mix(float(0.4), float(1), fv.y), float(1));
      const shadow = analyticShadow(pos);
      return gardenLight(vec3(1), N, pos, viewDir, shadow, ao, float(0.6));
    })(),
    "vFlowerLight"
  );
  const vDist = varying(distCam, "vFlowerDist");
  const vUv = varying(fv.yz, "vFlowerUv");
  const vPart = varying(part, "vFlowerPart");
  const vSpecies = varying(species, "vFlowerSpecies");
  const vSeed = varying(seed, "vFlowerSeed");

  m.colorNode = Fn(() => {
    const sp = floor(vSpecies.add(0.5));
    const stemCol = select(sp.equal(4), c3("#7f9a76"), select(sp.equal(6), c3("#a9a46a"), c3("#5d8a45")));
    const col = stemCol.toVar();
    const uvp = vUv;

    If(vPart.greaterThan(0.5).and(vPart.lessThan(1.5)), () => {
      // Daisy-type head.
      const r = length(uvp);
      const a = atan(uvp.y, uvp.x);
      const isCosmos = sp.lessThan(1.5);
      const isCorn = sp.equal(2);
      // Petal outline per species.
      const cosmosEdge = float(0.55).add(pow(abs(cos(a.mul(4))), 0.6).mul(0.45)).sub(pow(abs(cos(a.mul(16))), 8).mul(0.06));
      const cornEdge = float(0.62).add(abs(cos(a.mul(4.5))).mul(0.28)).add(abs(sin(a.mul(27))).mul(0.1));
      const chamEdge = float(0.5).add(pow(abs(cos(a.mul(6.5))), 0.35).mul(0.5));
      const edge = select(isCosmos, cosmosEdge, select(isCorn, cornEdge, chamEdge));
      If(r.greaterThan(edge), () => {
        Discard();
      });
      const pink = mix(c3("#f2b6cf"), c3("#e793b8"), fract(vSeed.mul(5.3)));
      const petal = select(
        sp.equal(0),
        mix(c3("#c9608f"), pink, smoothstep(0.18, 0.5, r)),
        select(sp.equal(1), mix(c3("#e9d6df"), c3("#fbf6f4"), smoothstep(0.2, 0.5, r)), select(isCorn, mix(c3("#4b5fb8"), c3("#86a6ec"), smoothstep(0.15, 0.6, r)), c3("#fbf8ee")))
      );
      const centreR = select(isCosmos, float(0.2), select(isCorn, float(0.16), float(0.34)));
      const centreCol = select(isCorn, c3("#3d3f8f"), c3("#f2c84a"));
      // Petal grooves.
      const groove = float(1).sub(pow(abs(sin(a.mul(select(isCosmos, float(4), float(9))))), 30).mul(0.15));
      col.assign(mix(petal.mul(groove), centreCol, smoothstep(centreR.add(0.03), centreR, r)));
    }).ElseIf(vPart.greaterThan(1.5), () => {
      // Spike (u in [-1,1], v in [0,1]).
      const u = uvp.x;
      const v = uvp.y;
      const lav = sp.equal(4);
      const fox = sp.equal(5);
      // Width profile + whorls/bells.
      const lavW = float(0.55).sub(v.mul(0.25)).mul(sin(v.mul(34)).mul(0.25).add(0.85)).mul(smoothstep(1.0, 0.86, v));
      // Foxglove: stacked rounded bells, widest at the bottom of the spire.
      const cell = fract(v.mul(10).add(vSeed.mul(3)));
      const bells = float(1).sub(cell.mul(2).sub(1).mul(cell.mul(2).sub(1))).max(0).sqrt();
      const foxW = float(1).sub(v.mul(0.7)).mul(bells.mul(0.7).add(0.3)).mul(smoothstep(1.0, 0.88, v));
      const seedW = float(0.5).sub(v.mul(0.3)).mul(sin(v.mul(40)).mul(0.3).add(0.7)).mul(smoothstep(1.0, 0.8, v));
      const width = select(lav, lavW, select(fox, foxW, seedW));
      If(abs(u).greaterThan(width), () => {
        Discard();
      });
      // Below the head: the stem shows through (narrow).
      const lavCol = mix(c3("#8f74c9"), c3("#bba5e6"), sin(v.mul(34)).mul(0.5).add(0.5).mul(0.6).add(fract(vSeed.mul(3.1)).mul(0.4)));
      const foxBase = mix(mix(c3("#e7a6c8"), c3("#d48bbd"), fract(vSeed.mul(7.7))), c3("#f6eef2"), select(fract(vSeed.mul(11.3)).greaterThan(0.75), float(1), float(0)));
      // Bell throats: darker speckled centre, green buds at the tip.
      const throat = smoothstep(0.55, 0.0, abs(u).div(width.max(0.01))).mul(smoothstep(0.6, 0.1, cell)).mul(0.45);
      const foxCol = mix(foxBase.mul(float(1).sub(throat)), c3("#9fb87a"), smoothstep(0.78, 0.95, v));
      const seedCol = mix(c3("#c9b98a"), c3("#e3d6a8"), v);
      col.assign(select(lav, lavCol, select(fox, foxCol, seedCol)));
    });

    const lit = col.mul(vLight);
    return vec4(aerial(lit, vDist, float(1)), 1);
  })();

  return m;
}

export default function Flowers({ quality = 1 }) {
  const data = useMemo(() => scatterFlowers(quality), [quality]);
  const material = useMemo(makeFlowerMaterial, []);
  const geometry = useMemo(() => {
    const g = buildFlowerGeometry();
    g.setAttribute("iPos", new InstancedBufferAttribute(data.a, 4));
    g.setAttribute("iPar", new InstancedBufferAttribute(data.b, 4));
    g.setAttribute("iExt", new InstancedBufferAttribute(data.c, 4));
    g.instanceCount = data.count;
    g.boundingSphere = new Sphere(new Vector3(0, -2, 2), 40);
    return g;
  }, [data]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => {
    if (process.env.NODE_ENV === "development") console.info(`[garden] flowers ${data.count}`);
  }, [data]);
  return (
    <mesh
      name="gardenFlowers"
      geometry={geometry}
      material={material}
      frustumCulled={false}
      renderOrder={-1}
      raycast={() => null}
    />
  );
}
