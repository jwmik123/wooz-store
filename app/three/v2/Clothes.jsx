"use client";

import { useMemo } from "react";
import collectionStore from "../../stores/collectionStore";
import { applyBakedLighting, useBakedMaterial, useStudioGLTF } from "./Studio";
import { openCollection, setPointerCursor } from "./interactions";
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

/**
 * Each garment is its own mesh (placed by the GLB's node transform) sharing the
 * baked studio material. `userData.{type,color}` identify it; the wind
 * workstream can swap in a per-garment NodeMaterial with a positionNode.
 */
export default function Clothes() {
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
      for (const { node } of items) bakeWindAttribute(node.geometry, node.quaternion);
  }, [groups]);
  const setSelectedCollection = collectionStore((s) => s.setSelectedCollection);

  return Object.entries(groups).map(([type, items]) => (
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
  ));
}
