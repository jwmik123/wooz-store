"use client";

import { OrbitControls, Sky, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Canvas } from "@react-three/fiber";
import Grass from "./Grass";
import Clouds from "./clouds/Clouds";
import Studio from "./Studio";
import Smoke from "./Smoke";
import { useControls } from "leva";

export default function Experience() {
  const { showGrass } = useControls({
    showGrass: {
      value: false,
      label: "Show Grass",
    },
  });

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 0, 5], fov: 55 }}
      gl={{
        toneMapping: false,
        antialias: true,
        depth: true,
      }}
    >
      <Perf position="top-left" />
      <OrbitControls
      // enableRotate={false}
      // enableZoom={false}
      // enablePan={false}
      />
      <Center>
        <Studio />
      </Center>

      {showGrass && <Grass />}
      <Smoke />
      <Clouds />

      <Sky
        sunPosition={[-15, 10, 8]}
        turbidity={5}
        rayleigh={0.3}
        inclination={0.4}
        azimuth={0.25}
      />
    </Canvas>
  );
}
