"use client";

import React, { useState, useEffect, useRef } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
// import { ShaderMaterial, Uniform } from "three";

import { Select, Selection } from "@react-three/postprocessing";
import Effects from "./Effects";

import vertexShader from "./shaders/studio/vertexShader.glsl";
import fragmentShader from "./shaders/studio/fragmentShader.glsl";

import {
  splatterConfig,
  longSleeveConfig,
  poloConfig,
} from "./assets/clothingConfig";

import collectionStore from "../stores/collectionStore";

export default function Studio1(props) {
  const { nodes } = useGLTF("/models/studio.glb");

  const [hoveredItem, setHoveredItem] = useState({ type: null, id: null });
  const [vec] = useState(() => new THREE.Vector3());
  const [lookVec] = useState(() => new THREE.Vector3()); // Separate vector for lookAt
  const { camera, mouse } = useThree();

  const cameraPositions = {
    polo: {
      x: 0.4898568407579924,
      y: -0.6973355377258545,
      z: 0.444403827686815,
      lookAt: [5, -2, -5],
    },
    splatter: {
      x: -1,
      y: -0.8362189733581833,
      z: -1.2113942542277958,
      lookAt: [4, -1, -7],
    },
    longsleeve: {
      x: 0.21924441389375993,
      z: -0.7401673558933446,
      y: -0.20296872786811337,
      lookAt: [-1, -1, -2],
    },
  };
  const { setSidebarOpen, setSidebarClosed } = collectionStore();

  // Handles mouse over
  const handlePointerOver = (type, id) => {
    setHoveredItem({ type, id });
    document.body.style.cursor = "pointer";
  };

  const handlePointerOut = () => {
    setHoveredItem({ type: null, id: null });
    document.body.style.cursor = "auto";
  };

  const bakedFinalTexture = useLoader(THREE.TextureLoader, "/assets/baked.jpg");
  bakedFinalTexture.colorSpace = THREE.SRGBColorSpace;
  bakedFinalTexture.flipY = false;

  const studioMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uBakedDayTexture: new THREE.Uniform(bakedFinalTexture),
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  /* Camera Controls */
  const [targetPosition, setTargetPosition] = useState(null);
  const [lookAtTarget, setLookAtTarget] = useState(null); // State for lookAt target

  // Keep track of initial camera position when clicking
  const [initialPosition, setInitialPosition] = useState(null);
  const [initialLookAt, setInitialLookAt] = useState(null);

  const setSelectedCollection = collectionStore(
    (state) => state.setSelectedCollection
  );
  const setProductHandle = collectionStore((state) => state.setProductHandle);

  const handleCollectionClick = (type) => {
    const position = cameraPositions[type];
    if (position) {
      setInitialPosition(camera.position.clone()); // Set initial position
      setInitialLookAt(lookVec.clone()); // Set initial lookAt direction
      setTargetPosition(position);
      setLookAtTarget(position.lookAt); // Set lookAt target when clicked
      setSelectedCollection(type);
      setProductHandle(type);
    }
  };

  // useFrame(() => {
  //   if (targetPosition) {
  //     // Smoothly move the camera to the target position
  //     camera.position.lerp(
  //       vec.set(targetPosition.x, targetPosition.y, targetPosition.z),
  //       0.04
  //     );
  //     // Open sidebar when camera is close to target position
  //     if (camera.position.distanceTo(vec) < 0.1) {
  //       setSidebarOpen(true);
  //     }

  //     if (lookAtTarget) {
  //       // Make the camera look at the specified target (separate vector)
  //       camera.lookAt(lookVec.lerp(new THREE.Vector3(...lookAtTarget), 0.01));
  //     }
  //   } else if (setSidebarClosed) {
  //     camera.position.lerp(vec.set(0, 0, 5), 0.05);
  //   } else {
  //     // Default behavior for mouse-controlled camera movement
  //     camera.position.lerp(vec.set(mouse.x * 0.8, mouse.y * 0.1, 5), 0.05);
  //   }
  // });

  return (
    <group {...props} dispose={null}>
      <mesh
        geometry={nodes.studio.geometry}
        material={studioMaterial}
        position={[-2.076, 1.575, 0.058]}
        rotation={[Math.PI / 2, 0, -Math.PI / 2]}
        scale={1.916}
      />
      <Selection>
        <Select enabled={hoveredItem.type === "splatter"}>
          <group
            onPointerOver={() => handlePointerOver("splatter")}
            onPointerOut={handlePointerOut}
            onClick={() => handleCollectionClick("splatter")}
          >
            {splatterConfig.map(({ color, position, rotation }, index) => (
              <mesh
                key={index}
                geometry={nodes[`Splatter_${color}`].geometry}
                material={studioMaterial}
                position={position}
                rotation={rotation}
                scale={1.916}
              />
            ))}
          </group>
        </Select>
        <Effects />
      </Selection>

      <group>
        <mesh
          geometry={nodes.Longsleeve_Black.geometry}
          material={studioMaterial}
          position={[-2.076, 1.575, 0.058]}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
          scale={1.916}
        />
        <mesh
          geometry={nodes.Longsleeve_Green.geometry}
          material={studioMaterial}
          position={[-2.076, 1.575, 0.058]}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
          scale={1.916}
        />
        <mesh
          geometry={nodes.Longsleeve_White.geometry}
          material={studioMaterial}
          position={[-2.076, 1.575, 0.058]}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
          scale={1.916}
        />
        <mesh
          geometry={nodes.Longsleeve_Blue.geometry}
          material={studioMaterial}
          position={[-2.076, 1.575, 0.058]}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
          scale={1.916}
        />
        <mesh
          geometry={nodes.Longsleeve_Brown.geometry}
          material={studioMaterial}
          position={[-2.076, 1.575, 0.058]}
          rotation={[Math.PI / 2, 0, -Math.PI / 2]}
          scale={1.916}
        />
      </group>
      <group>
        <mesh
          geometry={nodes.Polo_Black.geometry}
          material={nodes.Polo_Black.material}
          position={[-0.929, -0.441, -0.912]}
          rotation={[Math.PI / 2, 0, 0.984]}
        />
        <mesh
          geometry={nodes.Polo_DarkBlue.geometry}
          material={studioMaterial}
          position={[-0.643, -0.441, -1.068]}
          rotation={[Math.PI / 2, 0, -2.256]}
        />
        <mesh
          geometry={nodes.Polo_Green.geometry}
          material={studioMaterial}
          position={[-0.49, -0.441, -1.148]}
          rotation={[Math.PI / 2, 0, 0.817]}
        />
        <mesh
          geometry={nodes.Polo_Grey.geometry}
          material={studioMaterial}
          position={[-0.334, -0.441, -1.23]}
          rotation={[Math.PI / 2, 0, 0.857]}
        />
        <mesh
          geometry={nodes.Polo_LightBlue.geometry}
          material={studioMaterial}
          position={[-0.153, -0.441, -1.325]}
          rotation={[Math.PI / 2, 0, -2.244]}
        />
        <mesh
          geometry={nodes.Polo_White.geometry}
          material={studioMaterial}
          position={[-0.786, -0.441, -0.993]}
          rotation={[Math.PI / 2, 0, 0.921]}
        />
      </group>
    </group>
  );
}

useGLTF.preload("/models/studio.glb");
