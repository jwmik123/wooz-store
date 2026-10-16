"use client";

import { useEffect, useMemo } from "react";
import { createGlassGeometry, createSashFrameGeometry } from "./layout";
import { createGlassMaterial, createSashMaterial } from "./glassMaterial";

const noRaycast = () => {};

/**
 * Greenhouse glazing (world space, see ./layout.js): one transparent mesh for
 * every pane (side walls + roof + the opened sash's glass) and the opened roof
 * sash's frame. Neither is raycastable (autofocus / clicks go through), the
 * glass casts no shadow and draws after the opaque scene.
 */
export default function Glass() {
  const glass = useMemo(() => ({ geometry: createGlassGeometry(), material: createGlassMaterial() }), []);
  const sash = useMemo(() => ({ geometry: createSashFrameGeometry(), material: createSashMaterial() }), []);

  useEffect(
    () => () => {
      for (const o of [glass, sash]) {
        o.geometry.dispose();
        o.material.dispose();
      }
    },
    [glass, sash],
  );

  return (
    <group name="greenhouseGlass">
      <mesh
        geometry={glass.geometry}
        material={glass.material}
        renderOrder={10}
        castShadow={false}
        receiveShadow={false}
        raycast={noRaycast}
      />
      <mesh geometry={sash.geometry} material={sash.material} castShadow receiveShadow raycast={noRaycast} />
    </group>
  );
}
