"use client";
import React, { useState } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { ShaderMaterial, Uniform } from "three";
import * as THREE from "three";
import { Select, Selection } from "@react-three/postprocessing";
import Effects from "./Effects";

import vertexShader from "./shaders/studio/vertexShader.glsl";
import fragmentShader from "./shaders/studio/fragmentShader.glsl";

import {
  splatterConfig,
  longSleeveConfig,
  poloConfig,
} from "./assets/productConfigurations";

export default function Studio(props) {
  const { nodes } = useGLTF("/models/studio.glb");
  const [hoveredItem, setHoveredItem] = useState({ type: null, id: null });

  // Handle pointer over
  const handlePointerOver = (type, id) => {
    setHoveredItem({ type, id });
    document.body.style.cursor = "pointer";
  };

  // Handle pointer out
  const handlePointerOut = () => {
    setHoveredItem({ type: null, id: null });
    document.body.style.cursor = "auto";
  };

  // Create a shader material to apply the baked texture
  const bakedFinalTexture = useLoader(THREE.TextureLoader, "/baked.jpg");
  bakedFinalTexture.colorSpace = THREE.SRGBColorSpace;
  bakedFinalTexture.flipY = false;

  const studioMaterial = new ShaderMaterial({
    uniforms: {
      uBakedDayTexture: new Uniform(bakedFinalTexture),
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  return (
    <group {...props} dispose={null} rotation={[0, -Math.PI / 2, 0]}>
      <mesh
        geometry={nodes.studio.geometry}
        material={studioMaterial}
        position={[0, 1.5, 0]}
      ></mesh>
      <Selection>
        <Select enabled={hoveredItem.type === "polo"}>
          <group
            onPointerOver={() => handlePointerOver("polo")}
            onPointerOut={handlePointerOut}
          >
            {poloConfig.map(({ color, position, rotation }, index) => (
              <mesh
                key={color}
                geometry={nodes[`Polo_${color}`].geometry}
                material={studioMaterial}
                position={position}
                rotation={rotation}
              />
            ))}
          </group>
        </Select>
        <Select enabled={hoveredItem.type === "splatter"}>
          <group
            onPointerOver={() => handlePointerOver("splatter")}
            onPointerOut={handlePointerOut}
          >
            {splatterConfig.map(({ color, position, rotation }, index) => (
              <mesh
                key={color}
                geometry={nodes[`Splatter_${color}`].geometry}
                material={studioMaterial}
                position={position}
                rotation={rotation}
              />
            ))}
          </group>
        </Select>

        <Select enabled={hoveredItem.type === "longsleeve"}>
          <group
            onPointerOver={() => handlePointerOver("longsleeve")}
            onPointerOut={handlePointerOut}
          >
            {longSleeveConfig.map(({ color, position, rotation }, index) => (
              <mesh
                key={color}
                geometry={nodes[`Longsleeve_${color}`].geometry}
                material={studioMaterial}
                position={position}
                rotation={rotation}
              />
            ))}
          </group>
        </Select>
        <Effects />
      </Selection>
    </group>
  );
}

useGLTF.preload("/models/studio.glb");
