"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Studio from "./Studio";
import { Stage, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";

import { useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function Experience() {
  function Rig() {
    const [vec] = useState(() => new THREE.Vector3());
    const { camera, mouse } = useThree();

    return null;
  }

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 0, 5], fov: 55 }}
    >
      <Perf position="top-left" />
      <OrbitControls
      //enableRotate={false}
      //enableZoom={false}
      //enablePan={false}
      />
      <Center>
        <Studio />
      </Center>
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[5, 5, 5]} intensity={1} />
      <Rig />
    </Canvas>
  );
}
