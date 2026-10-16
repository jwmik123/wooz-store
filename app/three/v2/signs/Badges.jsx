"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  CanvasTexture,
  CircleGeometry,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshBasicNodeMaterial,
  Object3D,
  SRGBColorSpace,
  Vector3,
} from "three/webgpu";
import { abs, attribute, clamp, float, positionLocal, sin, texture, uniform, uv, vec2, vec3 } from "three/tsl";
import gsap from "gsap";
import collectionStore from "../../../stores/collectionStore";
import { uTime } from "../uniforms";
import { openTablePiece, setPointerCursor } from "../interactions";
import { TABLE_SPOTS } from "./tableSpots";
import { finePointer, setSpotHover, signsVisible, uPoolOn, uSignsFade, useRackHover } from "./signState";

/*
 * Floating round glass badges above the table pieces (▶ coffee / film, book,
 * tote), gently bobbing, so it's clear they can be clicked. One InstancedMesh
 * (1 draw call) with a 3-cell canvas atlas; billboarded towards the overview
 * camera; fades with the signs (setOverlayPointsVisible).
 */

const VIEW = new Vector3(0, 0, 5);
const ICONS = ["coffee", "lookbook", "totebag"];
const noRaycast = () => null;
const uHover = uniform(-1);
const uHoverAmt = uniform(0);

function drawIcon(g, key, x, s) {
  const c = s / 2;
  g.save();
  g.translate(x, 0);
  // Glass disc: milky fill + bright rim.
  const grad = g.createRadialGradient(c * 0.8, c * 0.7, s * 0.05, c, c, c);
  grad.addColorStop(0, "rgba(255,255,255,0.92)");
  grad.addColorStop(1, "rgba(240,236,226,0.72)");
  g.fillStyle = grad;
  g.beginPath();
  g.arc(c, c, c - 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.95)";
  g.lineWidth = 6;
  g.stroke();
  g.fillStyle = g.strokeStyle = "#1b3327";
  g.lineWidth = s * 0.045;
  g.lineJoin = g.lineCap = "round";
  if (key === "coffee") {
    g.beginPath();
    g.moveTo(c - s * 0.1, c - s * 0.16);
    g.lineTo(c + s * 0.17, c);
    g.lineTo(c - s * 0.1, c + s * 0.16);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (key === "lookbook") {
    const w = s * 0.2;
    const h = s * 0.26;
    for (const d of [-1, 1]) {
      g.beginPath();
      g.moveTo(c, c - h / 2 + s * 0.02);
      g.quadraticCurveTo(c + d * w * 0.5, c - h / 2 - s * 0.03, c + d * w, c - h / 2);
      g.lineTo(c + d * w, c + h / 2);
      g.quadraticCurveTo(c + d * w * 0.5, c + h / 2 - s * 0.03, c, c + h / 2 + s * 0.02);
      g.closePath();
      g.stroke();
    }
  } else {
    const top = c - s * 0.06;
    g.beginPath();
    g.moveTo(c - s * 0.17, top);
    g.lineTo(c + s * 0.17, top);
    g.lineTo(c + s * 0.2, c + s * 0.2);
    g.lineTo(c - s * 0.2, c + s * 0.2);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.arc(c, top, s * 0.09, Math.PI, 0);
    g.stroke();
  }
  g.restore();
}

function createAtlas() {
  const s = 256;
  const canvas = document.createElement("canvas");
  canvas.width = s * ICONS.length;
  canvas.height = s;
  const g = canvas.getContext("2d");
  ICONS.forEach((k, i) => drawIcon(g, k, i * s, s));
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function createMaterial(atlas) {
  const m = new MeshBasicNodeMaterial({ transparent: true, depthWrite: false });
  m.name = "tableBadge";
  // positionLocal is already instance-transformed (world) here.
  const meta = attribute("badgeMeta", "vec4"); // (icon index, phase, 0, 0)
  const centre = attribute("badgeCentre", "vec3");
  const hov = float(1).sub(clamp(abs(meta.x.sub(uHover)), 0, 1)).mul(uHoverAmt);
  const bob = sin(uTime.mul(1.3).add(meta.y)).mul(0.012);
  m.positionNode = positionLocal
    .sub(centre)
    .mul(hov.mul(0.18).add(1))
    .add(centre)
    .add(vec3(0, bob, 0));
  const tex = texture(atlas, vec2(meta.x.add(uv().x).div(ICONS.length), uv().y));
  m.colorNode = tex.rgb;
  m.opacityNode = tex.a.mul(uSignsFade);
  return m;
}

export default function Badges({ isMobile = false }) {
  const keys = useMemo(() => ICONS.filter((k) => !(isMobile && k === "lookbook")), [isMobile]);
  useEffect(() => {
    uPoolOn.value.set(1, isMobile ? 0 : 1, 1); // no lookbook on phones
  }, [isMobile]);

  const mesh = useMemo(() => {
    const atlas = createAtlas();
    const geo = new CircleGeometry(1, 40);
    const meta = new Float32Array(keys.length * 4);
    const centre = new Float32Array(keys.length * 3);
    const mesh = new InstancedMesh(geo, createMaterial(atlas), keys.length);
    const o = new Object3D();
    const r = isMobile ? 0.06 : 0.045;
    keys.forEach((k, i) => {
      const s = TABLE_SPOTS[k];
      o.position.copy(s.center).add(new Vector3(0, s.half.y + 0.09 + r, 0));
      o.lookAt(VIEW);
      o.scale.setScalar(r);
      o.updateMatrix();
      mesh.setMatrixAt(i, o.matrix);
      meta.set([ICONS.indexOf(k), i * 2.1, 0, 0], i * 4);
      centre.set(o.position.toArray(), i * 3);
    });
    geo.setAttribute("badgeMeta", new InstancedBufferAttribute(meta, 4));
    geo.setAttribute("badgeCentre", new InstancedBufferAttribute(centre, 3));
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    mesh.name = "tableBadges";
    mesh.userData.atlas = atlas;
    return mesh;
  }, [keys, isMobile]);
  useEffect(
    () => () => {
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.userData.atlas.dispose();
    },
    [mesh]
  );

  const shown = useRef(null);
  useFrame(() => {
    const on = uSignsFade.value > 0.001;
    if (on !== shown.current) mesh.visible = shown.current = on;
    mesh.raycast =
      signsVisible() && uSignsFade.value > 0.4 ? InstancedMesh.prototype.raycast : noRaycast;
  });

  const hovered = useRef(null);
  const out = () => {
    if (hovered.current === "totebag") collectionStore.getState().setSelectedCollection(null);
    hovered.current = null;
    setPointerCursor(false);
    setSpotHover(null);
    useRackHover.setState({ label: null });
    gsap.to(uHoverAmt, { value: 0, duration: 0.4, ease: "power2.out", overwrite: true });
  };

  return (
    <primitive
      object={mesh}
      onPointerMove={(e) => {
        e.stopPropagation();
        const k = keys[e.instanceId];
        if (!k || k === hovered.current) return;
        hovered.current = k;
        setPointerCursor(true);
        uHover.value = ICONS.indexOf(k);
        gsap.to(uHoverAmt, { value: 1, duration: 0.35, ease: "back.out(2)", overwrite: true });
        if (k === "totebag") collectionStore.getState().setSelectedCollection("totebag");
        if (finePointer()) {
          setSpotHover(TABLE_SPOTS[k]);
          useRackHover.setState({ label: TABLE_SPOTS[k].label });
        }
      }}
      onPointerOut={out}
      onClick={(e) => {
        e.stopPropagation();
        const k = keys[e.instanceId];
        if (!k) return;
        out();
        openTablePiece(k);
      }}
    />
  );
}
