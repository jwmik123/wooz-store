"use client";

import { useMemo } from "react";
import { useLoader, useThree } from "@react-three/fiber";
import { DoubleSide, MeshStandardNodeMaterial } from "three/webgpu";
import { lights, texture } from "three/tsl";
import { getKTX2Loader, useGLTFv2 } from "./loaders";
import { studioEmissiveNode } from "./lighting/interior";
import { LIGHTMAP_AUX_URL, LIGHTMAP_SKY_URL, bakedIrradianceNode } from "./lighting/lightmap";
import { bakedLightsNode } from "./lighting/keyLight";
import useDebug from "./debug/useDebug";
import { DEFAULT_PRESET, FINISH_PRESETS, createStudioFinish } from "./studio/wallFinish";
import StudioMaterialControls from "./studio/StudioMaterialControls";
import { spotHighlightNode } from "./signs/spotGlow";

// Phones get the same mesh with a 2048² albedo (studio-mobile.glb, ~2.3 MB lighter).
const IS_PHONE =
  typeof navigator !== "undefined" && /Android|iPhone|iPod|Mobile/i.test(navigator.userAgent);
export const STUDIO_URL = IS_PHONE ? "/models/v2/studio-mobile.glb" : "/models/v2/studio.glb";

/*
 * Studio coordinate frame
 * -----------------------
 * The GLB is authored in Blender (+Y up). <StudioRoot> places it in the world the
 * same way v1 did (rotation -90° around Y, then <Center>-equivalent offset), so all
 * camera presets / hotspot positions from v1 still line up.
 *
 *   studio local (x, y, z)  ->  world (-z, y - 1.895, x - 1.405)
 *
 * World: +Y up, the default camera sits at (0, 0, 5) looking down -Z into the
 * open front of the studio. Studio footprint in world ≈ x [-2.16, 2.16],
 * y [-2.07, 2.07], z [-3.48, 3.48].
 */
export const STUDIO_ROTATION = [0, -Math.PI / 2, 0];
export const STUDIO_OFFSET = [0, -1.89472, -1.40451];

export function StudioRoot({ children }) {
  return (
    <group position={STUDIO_OFFSET}>
      <group rotation={STUDIO_ROTATION}>{children}</group>
    </group>
  );
}

export function useStudioGLTF() {
  return useGLTFv2(STUDIO_URL);
}

const bakedMaterials = new WeakMap();

/**
 * Lightmapped lighting for a material that uses the studio bake atlas UVs
 * (studio shell + garments, see lighting/lightmap.js):
 *   - real-time: only the sun/moon key light (+ its shadow map)
 *   - baked:     sky fill, sun bounce and interior lamps as emissive
 *   - the night lamp-shade glow (lighting/interior.js)
 * Call on derived materials too (e.g. the garments' wind material).
 */
export function applyBakedLighting(material, albedoNode, lightmaps) {
  material.lightsNode = bakedLightsNode;
  material.emissiveNode = albedoNode
    .mul(bakedIrradianceNode(lightmaps.sky, lightmaps.aux))
    .add(studioEmissiveNode(albedoNode));
  return material;
}

/**
 * Plain baked material: the Cycles DIFFUSE (albedo) bake as colorNode, lit by
 * the real-time key light + the baked GI lightmaps. One instance per bake
 * texture. The garments derive their material from it (raw atlas albedo); the
 * studio shell renders with getStudioShellMaterial (same + wall finish).
 */
export function getBakedMaterial(map, lightmaps) {
  let material = bakedMaterials.get(map);
  if (!material) {
    map.flipY = false; // glTF convention (GLTFLoader already sets this)
    map.anisotropy = 8;
    material = new MeshStandardNodeMaterial({
      side: DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });
    material.name = "studioBaked";
    material.colorNode = texture(map);
    applyBakedLighting(material, material.colorNode, lightmaps);
    material.userData.lightmaps = lightmaps;
    bakedMaterials.set(map, material);
  }
  return material;
}

const shellMaterials = new WeakMap();

/**
 * (Re)builds the studio shell's surface finish (studio/wallFinish.js) on the
 * shell material: finished albedo → colour + baked GI, plus bump + roughness.
 * Called again from the debug panel when the preset / view changes.
 */
export function applyStudioFinish(material, { preset = DEFAULT_PRESET, view = 0 } = {}) {
  const { albedoNode, lightmaps } = material.userData;
  const kind = FINISH_PRESETS[preset]?.kind ?? 0;
  const finish = createStudioFinish(albedoNode, { kind, view });
  material.colorNode = finish.colorNode;
  material.normalNode = finish.normalNode;
  material.roughnessNode = finish.roughnessNode;
  applyBakedLighting(material, finish.colorNode, lightmaps);
  // Hover glow / idle light sweep on the table pieces (signs/spotGlow.js).
  material.emissiveNode = material.emissiveNode.add(spotHighlightNode());
  if (view === 1) {
    material.lightsNode = lights([]);
    material.emissiveNode = finish.colorNode;
    material.colorNode = finish.colorNode.mul(0);
  }
  material.userData.finish = { preset, view };
  material.needsUpdate = true;
  return material;
}

/**
 * The material the studio shell mesh renders with: same atlas + lightmaps as
 * the baked material (which the garments derive their albedo from), with the
 * wall / timber / floor finish on top. Still one material for the whole shell.
 */
export function getStudioShellMaterial(map, lightmaps) {
  let material = shellMaterials.get(map);
  if (!material) {
    material = new MeshStandardNodeMaterial({
      side: DoubleSide,
      roughness: 0.85,
      metalness: 0,
    });
    material.name = "studioShell";
    material.userData.albedoNode = texture(map);
    material.userData.lightmaps = lightmaps;
    applyStudioFinish(material);
    shellMaterials.set(map, material);
  }
  return material;
}

/** Baked GI lightmaps (KTX2, sRGB, TEXCOORD_0 atlas). Suspends. */
export function useLightmaps() {
  const gl = useThree((s) => s.gl);
  const [sky, aux] = useLoader(getKTX2Loader(gl), [LIGHTMAP_SKY_URL, LIGHTMAP_AUX_URL]);
  return useMemo(() => {
    for (const t of [sky, aux]) t.flipY = false;
    return { sky, aux };
  }, [sky, aux]);
}

export function useBakedMaterial() {
  const { materials } = useStudioGLTF();
  const lightmaps = useLightmaps();
  const map = Object.values(materials)[0].map;
  return useMemo(() => getBakedMaterial(map, lightmaps), [map, lightmaps]);
}

/** Every mesh in the GLB that is not a clothing item is part of the studio shell. */
export const isStudioMesh = (node) => node.isMesh && node.name.toLowerCase().startsWith("studio");

export default function Studio() {
  const { nodes } = useStudioGLTF();
  const baked = useBakedMaterial();
  const material = useMemo(
    () => getStudioShellMaterial(baked.colorNode.value, baked.userData.lightmaps),
    [baked],
  );
  const debug = useDebug();
  const studio = useMemo(() => Object.values(nodes).find(isStudioMesh), [nodes]);

  return (
    <>
      {debug && <StudioMaterialControls material={material} baseline={baked} />}
      <mesh
        name="studio"
        geometry={studio.geometry}
        material={material}
        position={studio.position}
        quaternion={studio.quaternion}
        scale={studio.scale}
        castShadow
        receiveShadow
      />
    </>
  );
}
