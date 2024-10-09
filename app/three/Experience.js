"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Studio from "./Studio";
import { Stage, Environment, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
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
      <Environment
        files={["/hdr/1.hdr"]}
        background
        backgroundBlurriness={0.05}
        backgroundRotation={[0, Math.PI / 2, 0]}
        // ground={{ height: 1, radius: 10, scale: 10 }} TODO: find a solution to ground the studio on the floor.
      />
      <Center>
        <Studio />
      </Center>
      <Rig />
    </Canvas>
  );
}
