"use client";

import * as THREE from "three";
import { useRef } from "react";
import {
  OrbitControls,
  Sky,
  Center,
  Html,
  Clouds,
  Cloud,
  StatsGl,
} from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";

import WaterComponent from "./water/Water";
import Grass from "./Grass";
import FakeClouds from "./clouds/Clouds";
import Studio from "./Studio";
import Smoke from "./Smoke";
import Overlay from "./overlay/Overlay";
import StudioNew from "./StudioNew";
import { CineonToneMapping, UnrealToneMapping } from "three";

export default function Experience() {
  const { showOption } = useControls({
    showOption: {
      value: "water",
      label: "Environment",
      options: { Water: "water", Grass: "grass" },
    },
  });
  const ref = useRef();
  const cloud0 = useRef();
  const { color, x, y, z, range, ...config } = useControls({
    seed: { value: 1, min: 1, max: 100, step: 1 },
    segments: { value: 20, min: 1, max: 80, step: 1 },
    volume: { value: 10.4, min: 0, max: 100, step: 0.1 },
    opacity: { value: 0.8, min: 0, max: 1, step: 0.01 },
    fade: { value: 10, min: 0, max: 400, step: 1 },
    growth: { value: 8, min: 0, max: 20, step: 1 },
    speed: { value: 0.1, min: 0, max: 1, step: 0.01 },
    x: { value: 6, min: 0, max: 100, step: 1 },
    y: { value: -5, min: 0, max: 100, step: 1 },
    z: { value: 1, min: 0, max: 100, step: 1 },
    color: "white",
  });

  const showWater = showOption === "water";
  const showGrass = showOption === "grass";

  const spotLight1 = new THREE.SpotLight("red", 100);
  spotLight1.position.set(0, 20, 0);
  spotLight1.decay = 0;
  spotLight1.distance = 45;
  spotLight1.penumbra = 0.5;
  const spotLight3 = new THREE.SpotLight("white", 50);
  spotLight3.position.set(0, 0, 30);
  spotLight3.angle = 1;
  spotLight3.decay = 0;
  spotLight3.penumbra = 1;
  const spotLight2 = new THREE.SpotLight("red", 50);
  spotLight2.position.set(0, 0, 40);
  spotLight2.angle = 0.15;
  spotLight2.decay = 0;
  spotLight2.penumbra = -1;

  return (
    <Canvas
      style={{ width: "100%", height: "100%" }}
      camera={{ position: [0, 0, 5], fov: 55 }}
      gl={{
        toneMapping: CineonToneMapping,
        antialias: true,
        depth: true,
      }}
    >
      <StatsGl />
      <ambientLight intensity={0.5} />

      <primitive object={spotLight1} />
      <spotLightHelper args={[spotLight1]} />

      {/* <primitive object={spotLight2} /> */}
      {/* <spotLightHelper args={[spotLight2]} /> */}

      <primitive object={spotLight3} />
      <spotLightHelper args={[spotLight3]} />
      <OrbitControls
      // enableRotate={false}
      // enableZoom={false}
      // enablePan={false}
      />
      <group ref={ref}>
        <Clouds material={THREE.MeshLambertMaterial} limit={400} range={range}>
          {/* <Cloud ref={cloud0} {...config} bounds={[x, y, z]} color={color} /> */}
          <Cloud
            {...config}
            bounds={[x, y, z]}
            color="#f8d7da" // pinkish/whitish color
            seed={2}
            position={[15, -5, -10]}
          />
          <Cloud
            {...config}
            bounds={[x, y, z]}
            color="#f8e1e4" // pinkish/whitish color
            seed={3}
            position={[-15, -5, -10]}
          />
          <Cloud
            {...config}
            bounds={[x, y, z]}
            color="#f8e1e4" // pinkish/whitish color
            seed={3}
            position={[15, -5, -1]}
          />
          <Cloud
            {...config}
            bounds={[x, y, z]}
            color="#f8e8eb" // pinkish/whitish color
            seed={4}
            position={[0, -5, -12]}
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
            position={[0, 0, 10]}
          />
          {/* <Cloud
            concentrate="outside"
            growth={100}
            color="#ffccdd"
            opacity={1.25}
            seed={0.3}
            bounds={200}
            volume={200}
          /> */}
        </Clouds>
      </group>
      <Center>
        {/* <Studio /> */}
        <StudioNew />
      </Center>
      {/* {showGrass && <Grass />} */}
      {/* OVERLAY */}
      {/* <Html
        as="div"
        position={[1.5, -0.4, -0.1]}
        distanceFactor={5}
        transform
        rotation={[0, -Math.PI / 4, 0]}
        scale={0.3}
        occlude
        className="flex items-center justify-center w-32 px-2 py-1 text-sm text-center text-black bg-white border border-white rounded-full -z-10 ripple"
      >
        New Collection
        <div className="absolute w-3 h-3 bg-green-500 rounded-full -top-1 -right-1 ripple"></div>
      </Html>
      <Html
        as="div"
        position={[2, -0.4, -0.1]}
        distanceFactor={5}
        transform
        rotation={[0, -Math.PI / 4, 0]}
        scale={0.3}
        occlude
        className="flex items-center justify-center w-32 px-2 py-1 text-sm text-center text-black bg-white border border-white rounded-full -z-10 pple"
      >
        New Collection
        <div className="absolute w-3 h-3 bg-green-500 rounded-full -top-1 -right-1 "></div>
      </Html> */}
      <Smoke />
      <FakeClouds />
      {/* {showWater && <WaterComponent />} */}
      {/* <Sky
        sunPosition={[0, 0.05, -2]}
        turbidity={10}
        rayleigh={3}
        inclination={0.6}
        azimuth={0.25}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      /> */}
    </Canvas>
  );
}
