"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Studio from "./Studio";
import { Stage, Environment, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";

export default function Experience() {
  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 0, 5], fov: 55 }}
    >
      <Perf position="top-left" />

      <Environment
        files={["/hdr/1.hdr"]}
        background
        backgroundBlurriness={0.08}
        backgroundRotation={[0, Math.PI / 2, 0]}
      />
      <Center>
        <Studio />
      </Center>
    </Canvas>
  );
}
