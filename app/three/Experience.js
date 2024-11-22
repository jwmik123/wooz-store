"use client";

import * as THREE from "three";
import { useRef, useEffect } from "react";
import { Center, Clouds, Cloud, StatsGl, Environment } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";

import Smoke from "./Smoke";
import StudioNew from "./StudioNew";
import Studio from "./Studio";

export default function Experience() {
  const ref = useRef();
  const { color, x, y, z, range, ...config } = useControls({
    seed: { value: 1, min: 1, max: 100, step: 1 },
    segments: { value: 20, min: 5, max: 80, step: 1 },
    volume: { value: 24, min: 0, max: 100, step: 0.1 },
    opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    fade: { value: 10, min: 0, max: 400, step: 1 },
    growth: { value: 2, min: 0, max: 20, step: 1 },
    speed: { value: 0.2, min: 0, max: 1, step: 0.01 },
    x: { value: 6, min: -100, max: 100, step: 1 },
    y: { value: -5, min: 0, max: 100, step: 1 },
    z: { value: 1, min: -100, max: 100, step: 1 },
    color: "white",
  });

  const spotLight1 = new THREE.SpotLight("white", 100);
  spotLight1.position.set(0, 20, 0);
  spotLight1.decay = 0;
  spotLight1.distance = 45;
  spotLight1.penumbra = 0.5;
  const spotLight3 = new THREE.SpotLight("white", 50);
  spotLight3.position.set(0, 0, 30);
  spotLight3.angle = 1;
  spotLight3.decay = 0;
  spotLight3.penumbra = 1;

  useEffect(() => {
    setTimeout(() => {
      document.querySelectorAll(".point").forEach((point) => {
        point.classList.add("visible");
      });
    }, 1000);
  }, []);

  return (
    <>
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 1, 20], fov: 55 }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          antialias: true,
          depth: true,
        }}
      >
        <StatsGl />
        <Center>
          <StudioNew />
        </Center>
        <Smoke />
        <group ref={ref}>
          <ambientLight intensity={0.5} />
          <primitive object={spotLight1} />
          <primitive object={spotLight3} />
          <Clouds
            material={THREE.MeshLambertMaterial}
            limit={400}
            range={range}
          >
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="#f8d7da" // pinkish/whitish color
              seed={2}
              position={[15, -10, -13]}
            />
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="#f8e1e4" // pinkish/whitish color
              seed={3}
              position={[-15, -10, -13]}
            />
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="#f8e1e4" // pinkish/whitish color
              seed={3}
              position={[15, -10, -1]}
            />
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="#f8e8eb" // pinkish/whitish color
              seed={4}
              position={[0, -5, -20]}
            />
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="pink" // pinkish/whitish color
              seed={5}
              position={[0, -5, -12]}
            />
            <Cloud
              {...config}
              bounds={[x, y, z]}
              color="pink" // pinkish/whitish color
              seed={5}
              position={[0, 0, 7]}
            />
          </Clouds>
        </group>
      </Canvas>
    </>
  );
}
