"use client";

import React, { useRef } from "react";
import { useGLTF } from "@react-three/drei";

export default function Hoodie(props) {
  const { nodes, materials } = useGLTF("/models/hoodie-compressed.glb");
  const meshRef = useRef();

  return (
    <group {...props} dispose={null}>
      <mesh
        ref={meshRef}
        name="cloth_parent012"
        geometry={nodes.cloth_parent012.geometry}
        material={materials.bake2}
        position={[0, 1, 0]}
        scale={1}
      />
    </group>
  );
}

useGLTF.preload("/models/hoodie-compressed.glb");
