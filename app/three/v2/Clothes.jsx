"use client";

import { useMemo } from "react";
import { Box3, Matrix4, Vector3 } from "three/webgpu";
import { useControls } from "leva";
import collectionStore from "../../stores/collectionStore";
import { applyBakedLighting, useBakedMaterial, useStudioGLTF } from "./Studio";
import { openCollection, setPointerCursor } from "./interactions";
import useDebug from "./debug/useDebug";
import { uWindIndoor } from "./uniforms";
import { bakeWindAttribute, createClothMaterial } from "./wind/clothWind";

// GLB node name prefix -> Shopify collection handle.
// Node names look like `Polo2_Black_High.001` (sanitized to `Polo2_Black_High001`).
const TYPE_BY_PREFIX = {
  Splatter: "splatter",
  Longsleeve: "longsleeve",
  Polo2: "polo",
  Hoodie: "hoodie",
};

export function parseClothingName(name) {
  const [prefix, color] = name.split("_");
  const type = TYPE_BY_PREFIX[prefix];
  return type ? { type, color } : null;
}

/** Clothing items from the studio GLB, grouped by collection type. */
export function useClothingItems() {
  const { nodes } = useStudioGLTF();
  return useMemo(() => {
    const groups = {};
    for (const node of Object.values(nodes)) {
      if (!node.isMesh) continue;
      const parsed = parseClothingName(node.name);
      if (!parsed) continue;
      (groups[parsed.type] ??= []).push({ ...parsed, node });
    }
    return groups;
  }, [nodes]);
}

/** Debug-only: indoor draught factor for the clothes (see uWindIndoor). */
function ClothWindControls() {
  useControls("Environment", {
    windIndoor: {
      value: uWindIndoor.value,
      min: 0,
      max: 2,
      step: 0.01,
      onChange: (v) => (uWindIndoor.value = v),
    },
  });
  return null;
}

const _m = new Matrix4();

/**
 * One invisible box around a whole rack (garments + gaps between them), in the
 * group's (studio-local) frame. The garments alone are a poor click target: the
 * hoodie rack at the back is small on screen and the gaps between hanging pieces
 * (plus the mouse parallax shifting the view between pointerdown and pointerup)
 * made clicks fall through to nothing.
 */
function useRackHitBox(items) {
  return useMemo(() => {
    const box = new Box3();
    for (const { node } of items) {
      const g = node.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      _m.compose(node.position, node.quaternion, node.scale);
      box.union(g.boundingBox.clone().applyMatrix4(_m));
    }
    box.expandByScalar(0.06);
    return {
      size: box.getSize(new Vector3()).toArray(),
      center: box.getCenter(new Vector3()).toArray(),
    };
  }, [items]);
}

function RackHitBox({ items }) {
  const { size, center } = useRackHitBox(items);
  return (
    <mesh position={center} name="rackHitBox">
      <boxGeometry args={size} />
      <meshBasicMaterial visible={false} />
    </mesh>
  );
}

/**
 * Each garment is its own mesh (placed by the GLB's node transform) sharing the
 * baked studio material. `userData.{type,color}` identify it; the wind
 * workstream can swap in a per-garment NodeMaterial with a positionNode.
 */
export default function Clothes() {
  const debug = useDebug();
  const groups = useClothingItems();
  const baked = useBakedMaterial();
  // One shared wind material for all garments (per-vertex windData attribute).
  // Garments live in the same bake atlas → same lightmapped lighting (lighting/).
  const material = useMemo(
    () => applyBakedLighting(createClothMaterial(baked), baked.colorNode, baked.userData.lightmaps),
    [baked]
  );
  useMemo(() => {
    for (const items of Object.values(groups))
      for (const { node } of items)
        bakeWindAttribute(node.geometry, node.quaternion);
  }, [groups]);
  const setSelectedCollection = collectionStore((s) => s.setSelectedCollection);

  return (
    <>
      {debug && <ClothWindControls />}
      {Object.entries(groups).map(([type, items]) => (
        <group
          key={type}
          name={`clothes-${type}`}
          onPointerOver={(e) => {
            e.stopPropagation();
            setPointerCursor(true);
            setSelectedCollection(type);
          }}
          onPointerOut={() => {
            setPointerCursor(false);
            setSelectedCollection(null);
          }}
          onClick={(e) => {
            e.stopPropagation();
            openCollection(type);
          }}
        >
          <RackHitBox items={items} />
          {items.map(({ node, color }) => (
            <mesh
              key={node.name}
              name={node.name}
              geometry={node.geometry}
              material={material}
              position={node.position}
              quaternion={node.quaternion}
              scale={node.scale}
              userData={{ type, color }}
              castShadow
              receiveShadow
            />
          ))}
        </group>
      ))}
    </>
  );
}
