"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Studio from "./Studio";
import { Stage, Environment, Center, Sky } from "@react-three/drei";
import { Perf } from "r3f-perf";
// import Ground from "./Ground";
// import GrassComponent from "./GrassComponent";
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

import { Ground } from "./classes/ground"; // Use the Ground class from ground.js
import { Grass } from "./classes/grass"; // Use the Grass class from grass.js

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
      {/* <Environment
        files={["/hdr/1.hdr"]}
        background
        backgroundBlurriness={0.05}
        backgroundRotation={[0, Math.PI / 2, 0]}
      /> */}
      <Center>
        <Studio />
      </Center>
      <ambientLight intensity={0.5} />
      <directionalLight castShadow position={[5, 5, 5]} intensity={1} />
      <Ground /> {/* Grass floor with procedural dirt */}
      <Grass /> {/* Grass with wind and patchiness effect */}
      <Rig />
    </Canvas>
  );
}
