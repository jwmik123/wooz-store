"use client";
import * as THREE from "three";
import { OrbitControls, Sky, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Canvas } from "@react-three/fiber";
import Grass from "./Grass";
import Clouds from "./clouds/Clouds";
import Studio from "./Studio";
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

      <Clouds />
      <Sky
        sunPosition={[-4, 1, 5]} // Adjust the sun position to change the lighting angle
        turbidity={10} //Higher turbidity gives a more scattered, warm look
        rayleigh={0.3} // Adjust to control the scattering effect
        inclination={0.6} // Adjust to modify the time of day, 0.6 gives a warm tone
        azimuth={0.25}
      />
    </Canvas>
  );
}
