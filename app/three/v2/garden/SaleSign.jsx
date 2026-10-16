"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BoxGeometry,
  CanvasTexture,
  CylinderGeometry,
  DoubleSide,
  ExtrudeGeometry,
  InstancedMesh,
  Matrix4,
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  Shape,
  SphereGeometry,
  TorusGeometry,
} from "three/webgpu";
import {
  color,
  cos,
  float,
  fract,
  instanceIndex,
  mix,
  pow,
  select,
  sin,
  texture,
  uv,
  vec3,
} from "three/tsl";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { uNightFactor, uTime } from "../uniforms";
import { terrainHeight } from "./gardenCommon";
import { useTierSettings } from "../perf/quality";

/*
 * Retro roadside marquee "Sale" arrow, standing left of the garden path and
 * pointing at the greenhouse's open front. All procedural, real metres:
 * arrow panel 2.5 m long × 1.2 m (head) / 0.8 m (body), top ≈ 3.0 m above the
 * lawn, on two 7 cm steel posts. Draw calls: panel, rim (+ bulb sockets),
 * posts, bulbs (1 InstancedMesh), 1 face + 4 depth planes for the lettering.
 */

// Placement (world), left of the path, face turned ~29° towards the intro
// camera so the arrowhead points down the path at the open front. Clear of the
// path (x ≈ 0), the "Step inside" waypoints (ENTER_VIA, x ≥ 0.5) and the intro
// title / buttons. Portrait screens are too narrow for the full-size sign beside
// the greenhouse, so there it stands a bit closer to the studio at 75 % scale.
export const SALE_SIGN = {
  landscape: { x: -2.4, z: 8.0, rotY: 0.5, top: 3.0, scale: 1 },
  portrait: { x: -1.2, z: 6.0, rotY: 0.5, top: 2.5, scale: 0.75 },
};

const isPortrait = () => typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8;

function usePlacement() {
  const [portrait, setPortrait] = useState(isPortrait);
  useEffect(() => {
    const on = () => setPortrait(isPortrait());
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, []);
  return SALE_SIGN[portrait ? "portrait" : "landscape"];
}

// Arrow outline (local, metres; centred on the body, arrowhead → +x).
const W = 2.5; // tip-to-tail
const HB = 0.4; // body half-height
const HH = 0.6; // arrowhead half-height
const HEAD = 0.66; // arrowhead length

/** Arrow outline grown outward by d (negative = inset). */
function arrowShape(d = 0) {
  const s = new Shape();
  const r = HB + d;
  const cx = -W / 2 + HB; // centre of the rounded tail
  const xh = W / 2 - HEAD - d * 0.6; // where the head flares
  const hh = HH + d * 1.5;
  const tip = W / 2 + d * 1.9;
  s.moveTo(cx, -r);
  s.lineTo(xh, -r);
  s.lineTo(xh, -hh);
  s.lineTo(tip, 0);
  s.lineTo(xh, hh);
  s.lineTo(xh, r);
  s.lineTo(cx, r);
  s.absarc(cx, 0, r, Math.PI / 2, (Math.PI * 3) / 2, false);
  return s;
}

const lin = (hex) => color(hex); // TSL colour from sRGB hex (converted to linear)

// --- Lettering --------------------------------------------------------------

const TEX_W = 1024;
const TEX_H = 512;

async function signFontFamily() {
  const v = getComputedStyle(document.documentElement).getPropertyValue("--wz-font-sign").trim();
  const family = v || "Lobster, 'Brush Script MT', cursive";
  try {
    await document.fonts.load(`240px ${family}`, "Sale");
  } catch {
    /* fall back to whatever the browser has */
  }
  return family;
}

/** Face (cream, red outline) + silhouette (white, for the depth layers). */
function drawLettering(family) {
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = TEX_W;
    c.height = TEX_H;
    const g = c.getContext("2d");
    g.font = `330px ${family}`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.lineJoin = "round";
    return [c, g];
  };
  const X = TEX_W / 2;
  const Y = TEX_H / 2 + 10;

  const [face, f] = mk();
  f.strokeStyle = "#b8352f";
  f.lineWidth = 34;
  f.strokeText("Sale", X, Y);
  const grad = f.createLinearGradient(0, Y - 120, 0, Y + 120);
  grad.addColorStop(0, "#fffaf0");
  grad.addColorStop(0.55, "#fff1d6");
  grad.addColorStop(1, "#f7dcb4");
  f.fillStyle = grad;
  f.fillText("Sale", X, Y);
  // Inner sparkle: a fine stipple only inside the letters.
  f.globalCompositeOperation = "source-atop";
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) {
    f.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.9)" : "rgba(240,190,140,0.35)";
    f.fillRect(rnd() * TEX_W, rnd() * TEX_H, 2 + rnd() * 2, 2 + rnd() * 2);
  }
  // Re-stroke a thin red inner line so the outline stays crisp over the sparkle.
  f.globalCompositeOperation = "source-over";
  f.strokeStyle = "rgba(184,53,47,0.55)";
  f.lineWidth = 4;
  f.strokeText("Sale", X, Y);

  const [sil, s] = mk();
  s.strokeStyle = "#fff";
  s.fillStyle = "#fff";
  s.lineWidth = 34;
  s.strokeText("Sale", X, Y);
  s.fillText("Sale", X, Y);

  const tex = (c) => {
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  return { face: tex(face), sil: tex(sil) };
}

function useLettering() {
  const [tex, setTex] = useState(null);
  useEffect(() => {
    let alive = true;
    let made = null;
    signFontFamily().then((family) => {
      if (!alive) return;
      made = drawLettering(family);
      setTex(made);
    });
    return () => {
      alive = false;
      made?.face.dispose();
      made?.sil.dispose();
    };
  }, []);
  return tex;
}

// --- Geometry ---------------------------------------------------------------

function buildSign(bulbCount, lowPoly) {
  // Panel: glossy red, front face at z = 0.
  const panel = new ExtrudeGeometry(arrowShape(0), {
    depth: 0.08,
    bevelEnabled: true,
    bevelThickness: 0.015,
    bevelSize: 0.015,
    bevelSegments: lowPoly ? 1 : 3,
    curveSegments: lowPoly ? 10 : 20,
  });
  panel.translate(0, 0, -0.095);

  // Rim: a raised darker band around the panel (outline with the panel as hole).
  const rimShape = arrowShape(0.075);
  rimShape.holes.push(arrowShape(-0.005));
  const rim = new ExtrudeGeometry(rimShape, {
    depth: 0.13,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: lowPoly ? 1 : 2,
    curveSegments: lowPoly ? 10 : 20,
  });
  rim.translate(0, 0, -0.11);

  // Bulb positions along an inset of the outline.
  const pts = arrowShape(-0.1).getSpacedPoints(bulbCount).slice(0, bulbCount);

  // Sockets (merged into the rim, same material): small collar under each bulb.
  const sock = new CylinderGeometry(0.03, 0.034, 0.03, lowPoly ? 6 : 10);
  sock.rotateX(Math.PI / 2);
  const parts = [rim];
  for (const p of pts) parts.push(sock.clone().translate(p.x, p.y, 0.012));
  const rimMerged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  parts.forEach((g) => g.dispose());
  sock.dispose();

  return { panel, rim: rimMerged, pts };
}

function buildPosts(groundLocalY) {
  // Two square steel posts from the lawn into the back of the panel, a cross
  // brace under the body and a short vertical bracket up to the panel.
  const parts = [];
  const postH = -groundLocalY + 0.1;
  for (const x of [-0.72, 0.38]) {
    const p = new BoxGeometry(0.07, postH, 0.07);
    p.translate(x, groundLocalY + postH / 2, -0.16);
    parts.push(p);
    const foot = new BoxGeometry(0.16, 0.06, 0.16);
    foot.translate(x, groundLocalY + 0.03, -0.16);
    parts.push(foot);
  }
  const brace = new BoxGeometry(1.32, 0.05, 0.05);
  brace.translate(-0.17, -HB - 0.32, -0.16);
  parts.push(brace);
  const bracket = new BoxGeometry(0.05, 0.36, 0.05);
  bracket.translate(-0.17, -HB - 0.16, -0.16);
  parts.push(bracket);
  // Two small clamp plates where the posts meet the panel back.
  for (const x of [-0.72, 0.38]) {
    const c = new BoxGeometry(0.14, 0.5, 0.025);
    c.translate(x, 0, -0.125);
    parts.push(c);
  }
  // Ring bolt eyes on the brace (tiny detail).
  const eye = new TorusGeometry(0.03, 0.008, 4, 8);
  parts.push(eye.clone().translate(-0.17, -HB - 0.32, -0.13));
  const merged = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  parts.forEach((g) => g.dispose());
  eye.dispose();
  return merged;
}

// --- Materials --------------------------------------------------------------

function makeMaterials() {
  const panel = new MeshStandardNodeMaterial({ roughness: 0.32, metalness: 0.05 });
  panel.colorNode = lin("#c9473f");
  // At night the bulbs wash the panel in warm light (no real lights: fixed light count).
  panel.emissiveNode = lin("#c9473f").mul(uNightFactor.mul(0.22));
  panel.name = "saleSignPanel";

  const rim = new MeshStandardNodeMaterial({ roughness: 0.4, metalness: 0.45 });
  rim.colorNode = lin("#8f2f2c");
  rim.emissiveNode = lin("#8f2f2c").mul(uNightFactor.mul(0.12));
  rim.name = "saleSignRim";

  const post = new MeshStandardNodeMaterial({ roughness: 0.55, metalness: 0.6 });
  post.colorNode = lin("#2b2a2e");
  post.name = "saleSignPost";

  // Bulbs: unlit HDR emissive, alternating warm white / red, chase over uTime.
  const bulb = new MeshBasicNodeMaterial();
  bulb.name = "saleSignBulbs";
  const i = float(instanceIndex);
  const isRed = fract(i.mul(0.5)).greaterThan(0.25);
  const hue = select(isRed, vec3(1.0, 0.16, 0.12), vec3(1.0, 0.82, 0.55));
  // Marquee chase: a bright wave every 4 bulbs running toward the arrowhead.
  const wave = cos(i.mul(Math.PI / 2).sub(uTime.mul(5.5))).mul(0.5).add(0.5);
  const chase = mix(float(0.35), float(1), pow(wave, 2.5));
  const level = mix(float(2.4), float(4.2), uNightFactor);
  bulb.colorNode = hue.mul(chase).mul(level);

  return { panel, rim, post, bulb };
}

function makeLetterMaterials(tex) {
  const night = uNightFactor;
  const face = new MeshStandardNodeMaterial({
    roughness: 0.45,
    metalness: 0,
    transparent: false,
    alphaTest: 0.5,
    side: DoubleSide,
  });
  face.name = "saleSignFace";
  const t = texture(tex.face);
  face.colorNode = t;
  face.opacityNode = t.a;
  // Soft neon-ish glow on the cream face (not the red outline), a gentle shimmer
  // sweeping across, stronger at night (crosses the bloom threshold then).
  const cream = t.r.mul(t.g).mul(t.b); // ~1 on cream, ~0 on red outline
  const shimmer = sin(uv().x.mul(9).sub(uTime.mul(1.3))).mul(0.12).add(1);
  face.emissiveNode = t.rgb.mul(cream).mul(shimmer).mul(mix(float(0.35), float(1.6), night));

  const depthMats = [0, 1, 2, 3].map((k) => {
    const m = new MeshStandardNodeMaterial({ roughness: 0.5, alphaTest: 0.5, side: DoubleSide });
    m.name = `saleSignDepth${k}`;
    const s = texture(tex.sil);
    m.colorNode = mix(lin("#9a2c29"), lin("#5e1b1a"), k / 3);
    m.opacityNode = s.a;
    return m;
  });
  return { face, depthMats };
}

// --- Component --------------------------------------------------------------

const _o = new Object3D();

export default function SaleSign() {
  const tier = useTierSettings();
  const low = !tier.bloom; // "low" tier: fewer bulbs / segments
  const bulbCount = low ? 44 : 60;

  const P = usePlacement();
  // Group origin = body centre; posts reach 10 cm below the (flat) lawn.
  const groundLocalY = -(P.top - HH * P.scale) / P.scale - 0.1;
  const centreY = terrainHeight(P.x, P.z) + P.top - HH * P.scale;

  const built = useMemo(() => buildSign(bulbCount, low), [bulbCount, low]);
  const posts = useMemo(() => buildPosts(groundLocalY), [groundLocalY]);
  const mats = useMemo(makeMaterials, []);

  const bulbs = useMemo(() => {
    const g = new SphereGeometry(0.034, low ? 6 : 10, low ? 4 : 7);
    const m = new InstancedMesh(g, mats.bulb, built.pts.length);
    built.pts.forEach((p, i) => {
      _o.position.set(p.x, p.y, 0.04);
      _o.updateMatrix();
      m.setMatrixAt(i, _o.matrix);
    });
    m.instanceMatrix.needsUpdate = true;
    m.name = "saleSignBulbs";
    m.raycast = () => null;
    m.castShadow = false;
    m.computeBoundingSphere();
    return m;
  }, [built, mats, low]);

  const tex = useLettering();
  const letterMats = useMemo(() => (tex ? makeLetterMaterials(tex) : null), [tex]);
  const plane = useMemo(() => new PlaneGeometry(1.56, 0.78), []);

  useEffect(
    () => () => {
      built.panel.dispose();
      built.rim.dispose();
    },
    [built]
  );
  useEffect(() => () => posts.dispose(), [posts]);
  useEffect(() => () => bulbs.geometry.dispose(), [bulbs]);
  useEffect(
    () => () => {
      plane.dispose();
      Object.values(mats).forEach((m) => m.dispose());
    },
    [plane, mats]
  );
  useEffect(
    () => () => {
      if (!letterMats) return;
      letterMats.face.dispose();
      letterMats.depthMats.forEach((m) => m.dispose());
    },
    [letterMats]
  );

  const noRay = () => null;
  // Lettering sits on the body, nudged left of the arrowhead.
  const TX = -0.22;
  const TY = 0.02;

  return (
    <group
      name="saleSign"
      position={[P.x, centreY, P.z]}
      rotation={[0, P.rotY, 0]}
      scale={P.scale}
    >
      <mesh geometry={built.panel} material={mats.panel} castShadow raycast={noRay} />
      <mesh geometry={built.rim} material={mats.rim} castShadow raycast={noRay} />
      <mesh geometry={posts} material={mats.post} castShadow raycast={noRay} />
      <primitive object={bulbs} />
      {letterMats && (
        <group position={[TX, TY, 0]}>
          {/* Fake extrusion: dark silhouettes stepped back and down-left. */}
          {letterMats.depthMats.map((m, k) => (
            <mesh
              key={k}
              geometry={plane}
              material={m}
              position={[-0.011 * (k + 1), -0.013 * (k + 1), 0.05 - 0.007 * (k + 1)]}
              raycast={noRay}
            />
          ))}
          <mesh geometry={plane} material={letterMats.face} position={[0, 0, 0.055]} castShadow raycast={noRay} />
        </group>
      )}
    </group>
  );
}
