"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { createGlassGeometry, createSashFrameGeometry } from "./layout";
import { createGlassMaterial, createSashMaterial } from "./glassMaterial";
import { decayFog, uFog, uFogLine, wipeFog } from "./fog";
import FrontGlass from "./FrontGlass";
import { dropTime, useDropStore } from "@/lib/drop";
import { useTierSettings } from "../perf/quality";
import collectionStore from "../../../stores/collectionStore";
import useLoadingStore from "../../../components/loader/loadingStore";

const noRaycast = () => {};

// T-0 choreography (seconds after the drop): the sun dries the glass top-down,
// then the doors swing open (DropBoard flips to NOW OPEN at the same moment).
const DRY = { start: 0.3, duration: 2.4, from: 2.4, to: -2.4 };
const DOORS = { start: 1.8, duration: 1.6 };

/**
 * Pointer wipes on the fogged glass: mouse just moving over it, touch dragging.
 * The brush eases after the pointer (a soft follower), so strokes come out as
 * smooth curves instead of the raw, jittery pointer path.
 */
function useFogWiping(active) {
  const dom = useThree((s) => s.gl.domElement);
  const st = useRef({ target: null, brush: null, touching: false });

  useEffect(() => {
    if (!active) return;
    const s = st.current;
    const onMove = (e) => {
      if (e.pointerType !== "mouse" && !s.touching) return;
      s.target = { x: e.clientX, y: e.clientY };
    };
    const onDown = (e) => {
      s.touching = true;
      s.target = { x: e.clientX, y: e.clientY };
      s.brush = { ...s.target };
    };
    const onUp = (e) => {
      if (e.pointerType === "mouse" && e.type === "pointerup") return;
      s.touching = false;
      s.target = null;
      s.brush = null;
    };
    dom.addEventListener("pointermove", onMove);
    dom.addEventListener("pointerdown", onDown);
    window.addEventListener("pointerup", onUp);
    dom.addEventListener("pointerleave", onUp);
    return () => {
      dom.removeEventListener("pointermove", onMove);
      dom.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      dom.removeEventListener("pointerleave", onUp);
    };
  }, [active, dom]);

  useFrame((_, delta) => {
    const s = st.current;
    if (!active || !s.target) return;
    if (useDropStore.getState().phase !== "before" || !useLoadingStore.getState().revealed) return;
    if (!s.brush) s.brush = { ...s.target };
    const k = 1 - Math.exp(-Math.min(delta, 0.05) * 14);
    const from = s.brush;
    const to = { x: from.x + (s.target.x - from.x) * k, y: from.y + (s.target.y - from.y) * k };
    const d = Math.hypot(to.x - from.x, to.y - from.y);
    if (d < 0.5) return;
    // Stamp along the eased segment; faster strokes wipe a little harder.
    const steps = Math.min(16, Math.ceil(d / 4));
    const strength = Math.min(1, 0.35 + d / 30);
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      wipeFog(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t, strength / Math.sqrt(steps));
    }
    s.brush = to;
  });
}

/**
 * Greenhouse glazing (world space, see ./layout.js): one transparent mesh for
 * every pane (side walls + roof + the opened sash's glass) and the opened roof
 * sash's frame. Neither is raycastable (autofocus / clicks go through), the
 * glass casts no shadow and draws after the opaque scene.
 *
 * Sale drop (lib/drop.js): while the greenhouse is closed the glass is fogged
 * (./fog.js) and a temporary glass front with doors closes the open front
 * (./FrontGlass.jsx). Visitors wipe peepholes; at T-0 it dries and opens.
 */
export default function Glass() {
  const closed = useDropStore((s) => s.closed);
  const introScreen = collectionStore((s) => s.introScreen);
  const tier = useTierSettings();
  const blur = tier.bloom; // low tier: flat milky fog, no viewport copy

  const glass = useMemo(() => ({ geometry: createGlassGeometry(), material: createGlassMaterial() }), []);
  const sash = useMemo(() => ({ geometry: createSashFrameGeometry(), material: createSashMaterial() }), []);
  const [fogged, setFogged] = useState(closed);
  const fogMaterial = useMemo(() => (fogged ? createGlassMaterial({ fog: { blur } }) : null), [fogged, blur]);

  useEffect(
    () => () => {
      for (const o of [glass, sash]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
    [glass, sash],
  );
  useEffect(() => () => fogMaterial?.dispose(), [fogMaterial]);

  useFogWiping(fogged);

  const since = () => (Date.now() - dropTime()) / 1000;
  useFrame((_, dt) => {
    if (!fogged) return;
    decayFog(Math.min(dt, 0.1));
    const t = (since() - DRY.start) / DRY.duration;
    uFog.value = 1;
    uFogLine.value = t < 0 ? 9 : DRY.from + (DRY.to - DRY.from) * Math.min(1, t * (2 - t));
    // Fully dry: back to the plain glass (drops the viewport copy).
    if (t > 1.05) setFogged(false);
  });

  return (
    <group name="greenhouseGlass">
      <mesh
        geometry={glass.geometry}
        material={fogMaterial ?? glass.material}
        renderOrder={10}
        castShadow={false}
        receiveShadow={false}
        raycast={noRaycast}
      />
      <mesh geometry={sash.geometry} material={sash.material} castShadow receiveShadow raycast={noRaycast} />
      {closed && (
        <FrontGlass
          fogMaterial={fogMaterial}
          doors={() => (since() - DOORS.start) / DOORS.duration}
          visible={introScreen}
        />
      )}
    </group>
  );
}
