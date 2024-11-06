"use client";

import { OrbitControls, Sky, Center, Html } from "@react-three/drei";
import { Perf } from "r3f-perf";
import { Canvas } from "@react-three/fiber";
import { useControls } from "leva";

import WaterComponent from "./water/Water";
import Grass from "./Grass";
import Clouds from "./clouds/Clouds";
import Studio from "./Studio";
import Smoke from "./Smoke";
import Overlay from "./overlay/Overlay";
export default function Experience() {
  const { showOption } = useControls({
    showOption: {
      value: "water",
      label: "Environment",
      options: { Water: "water", Grass: "grass" },
    },
  });

  const showWater = showOption === "water";
  const showGrass = showOption === "grass";

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
      {/* <CameraControls /> */}
      {/* <Overlay /> */}

      <Center>
        <Studio />
      </Center>

      {showGrass && <Grass />}

      {/* OVERLAY */}
      <Html
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

      <Smoke />
      <Clouds />

      {showWater && <WaterComponent />}

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
