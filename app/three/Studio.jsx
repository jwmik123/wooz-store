"use client";
import React, { useState, useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
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

import collectionStore from "../stores/collectionStore";

export default function Studio(props) {
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

  const [targetPosition, setTargetPosition] = useState(null);
  const [lookAtTarget, setLookAtTarget] = useState(null); // State for lookAt target

  // Keep track of initial camera position when clicking
  const [initialPosition, setInitialPosition] = useState(null);
  const [initialLookAt, setInitialLookAt] = useState(null);

  const setSelectedCollection = collectionStore(
    (state) => state.setSelectedCollection
  );

  const handleCollectionClick = (type) => {
    const position = cameraPositions[type];
    if (position) {
      setInitialPosition(camera.position.clone()); // Set initial position
      setInitialLookAt(lookVec.clone()); // Set initial lookAt direction
      setTargetPosition(position);
      setLookAtTarget(position.lookAt); // Set lookAt target when clicked
      setSelectedCollection(type);
    }
  };

  useFrame(() => {
    if (targetPosition) {
      // Smoothly move the camera to the target position
      camera.position.lerp(
        vec.set(targetPosition.x, targetPosition.y, targetPosition.z),
        0.01
      );

      if (lookAtTarget) {
        // Make the camera look at the specified target (separate vector)

        camera.lookAt(lookVec.lerp(new THREE.Vector3(...lookAtTarget), 0.01));
      }
    } else {
      // Default behavior for mouse-controlled camera movement
      camera.position.lerp(vec.set(mouse.x * 0.8, mouse.y * 0.1, 5), 0.05);
    }
  });

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.key === "u") {
        console.log("Current camera position:", camera.position);
      }
    };

    window.addEventListener("keypress", handleKeyPress);

    return () => {
      window.removeEventListener("keypress", handleKeyPress);
    };
  }, [camera]);

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
            onClick={() => handleCollectionClick("polo")}
          >
            {/* <mesh position={[0.053, 1, -1.486]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color="blue" />
            </mesh> */}
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
            onClick={() => handleCollectionClick("splatter")}
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
            onClick={() => handleCollectionClick("longsleeve")}
          >
            {/* <mesh position={[-0.569, 1, 1.45]}>
              <sphereGeometry args={[0.2, 16, 16]} />
              <meshStandardMaterial color="red" />
            </mesh> */}
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
