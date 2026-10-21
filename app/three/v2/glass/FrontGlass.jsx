"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { BoxGeometry, BufferGeometry, Float32BufferAttribute } from "three/webgpu";
import { uniform } from "three/tsl";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createGlassMaterial, createSashMaterial } from "./glassMaterial";

/*
 * Temporary glass front for the sale-drop countdown: the greenhouse's front is
 * normally open (./layout.js), so while it is "closed" a glazed gable with a
 * double door fills it (and fogs up with the rest of the glass). At T-0 the
 * doors swing out; after "Step inside" the whole front fades away, so the
 * overview (camera just outside the front) is as before.
 *
 * World metres: front plane z = 3.44, glass x ±2.04, floor y -1.87, eave 0.75,
 * ridge 1.98; doorway x ±0.55 up to y 0.45.
 */

const Z = 3.44;
const X = 2.04;
const Y0 = -1.87;
const EAVE = 0.75;
const RIDGE = 1.98;
const DOOR_X = 0.55;
const DOOR_TOP = 0.45;
const BAR = 0.045;

/** Flat polygon (fan) in the z = 0 plane, uv = (x, metres above Y0). */
function pane(points) {
  const pos = [];
  const uv = [];
  for (let i = 1; i < points.length - 1; i++)
    for (const [x, y] of [points[0], points[i], points[i + 1]]) {
      pos.push(x, y, 0);
      uv.push(x, y - Y0);
    }
  const g = new BufferGeometry();
  g.setAttribute("position", new Float32BufferAttribute(pos, 3));
  g.setAttribute("normal", new Float32BufferAttribute(Array(pos.length / 3).fill([0, 0, 1]).flat(), 3));
  g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  return g;
}

const merge = (parts) => {
  const m = mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)), false);
  parts.forEach((g) => g.dispose());
  m.computeBoundingSphere();
  return m;
};
const bar = (sx, sy, cx, cy) => new BoxGeometry(sx, sy, BAR).translate(cx, cy, 0);

function buildFixed() {
  const glass = merge([
    pane([[-X, Y0], [-DOOR_X, Y0], [-DOOR_X, EAVE], [-X, EAVE]]),
    pane([[DOOR_X, Y0], [X, Y0], [X, EAVE], [DOOR_X, EAVE]]),
    pane([[-DOOR_X, DOOR_TOP], [DOOR_X, DOOR_TOP], [DOOR_X, EAVE], [-DOOR_X, EAVE]]),
    pane([[-X, EAVE], [X, EAVE], [0, RIDGE]]),
  ]);
  const frame = merge([
    bar(BAR, EAVE - Y0, -DOOR_X - BAR / 2, (Y0 + EAVE) / 2),
    bar(BAR, EAVE - Y0, DOOR_X + BAR / 2, (Y0 + EAVE) / 2),
    bar(2 * DOOR_X + 2 * BAR, BAR, 0, DOOR_TOP + BAR / 2),
    bar(2 * X, BAR, 0, EAVE),
    // Two mullions in each side panel, like the side walls.
    ...[-1, 1].flatMap((s) => [bar(BAR * 0.7, EAVE - Y0, s * 1.05, (Y0 + EAVE) / 2), bar(BAR * 0.7, EAVE - Y0, s * 1.55, (Y0 + EAVE) / 2)]),
  ]);
  return { glass, frame };
}

/** One door leaf in hinge-local space (hinge at x = 0, leaf towards +x). */
function buildLeaf() {
  const w = DOOR_X - 0.006;
  const h = DOOR_TOP - Y0 - 0.01;
  const glass = merge([pane([[0, Y0], [w, Y0], [w, Y0 + h], [0, Y0 + h]])]);
  const frame = merge([
    bar(BAR, h, BAR / 2, Y0 + h / 2),
    bar(BAR, h, w - BAR / 2, Y0 + h / 2),
    bar(w, BAR, w / 2, Y0 + BAR / 2),
    bar(w, BAR, w / 2, Y0 + h - BAR / 2),
    bar(w, BAR * 1.6, w / 2, Y0 + 0.9),
    // Little brass handle near the meeting edge.
    new BoxGeometry(0.02, 0.16, 0.05).translate(w - 0.07, Y0 + 1.0, 0.035),
  ]);
  return { glass, frame };
}

const ease = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : 1 - Math.pow(1 - t, 3));

/**
 * @param fogMaterial  the shared fogged glass material (null once the fog is gone)
 * @param doors        () => 0…1 how far the doors have swung open
 * @param visible      false → fade out
 */
export default function FrontGlass({ fogMaterial, doors, visible }) {
  const fixed = useMemo(buildFixed, []);
  const leaf = useMemo(buildLeaf, []);
  const fade = useMemo(() => uniform(1), []);
  const mats = useMemo(() => {
    const clean = createGlassMaterial({ fade });
    const frame = createSashMaterial();
    frame.transparent = true;
    frame.opacityNode = fade;
    return { clean, frame };
  }, [fade]);
  const group = useRef();
  const left = useRef();
  const right = useRef();

  useEffect(
    () => () => {
      [fixed.glass, fixed.frame, leaf.glass, leaf.frame].forEach((g) => g.dispose());
      mats.clean.dispose();
      mats.frame.dispose();
    },
    [fixed, leaf, mats]
  );

  useFrame((_, dt) => {
    const open = ease(doors());
    // Outward swing, ~100°.
    if (left.current) left.current.rotation.y = -open * 1.75;
    if (right.current) right.current.rotation.y = open * 1.75;
    fade.value += ((visible ? 1 : 0) - fade.value) * (1 - Math.exp(-dt * 3));
    if (group.current) group.current.visible = fade.value > 0.01;
  });

  const glassMat = fogMaterial ?? mats.clean;
  const noRay = () => null;
  return (
    <group ref={group} name="greenhouseFront" position={[0, 0, Z]}>
      <mesh geometry={fixed.glass} material={glassMat} renderOrder={10} raycast={noRay} />
      <mesh geometry={fixed.frame} material={mats.frame} castShadow raycast={noRay} />
      <group ref={left} position={[-DOOR_X, 0, 0]}>
        <mesh geometry={leaf.glass} material={glassMat} renderOrder={10} raycast={noRay} />
        <mesh geometry={leaf.frame} material={mats.frame} castShadow raycast={noRay} />
      </group>
      <group ref={right} position={[DOOR_X, 0, 0]} scale={[-1, 1, 1]}>
        <mesh geometry={leaf.glass} material={glassMat} renderOrder={10} raycast={noRay} />
        <mesh geometry={leaf.frame} material={mats.frame} castShadow raycast={noRay} />
      </group>
    </group>
  );
}
