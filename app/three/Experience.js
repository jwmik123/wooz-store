"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Sky } from "@react-three/drei";
import Studio from "./Studio";
// import Studio1 from "./Studio1";
import StudioOld from "./StudioOld";
import { Stage, Center } from "@react-three/drei";
import { Perf } from "r3f-perf";

import { useState } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import Effects from "./Effects";
import Studio1 from "./Studio1";

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
        {/* <Studio1 /> */}
        {/* <StudioOld /> */}
        <Studio />
      </Center>
      {/* <mesh
        rotation={[-Math.PI / 2, Math.PI / 24, Math.PI / 4]}
        position={[-10, -3, 0]}
      >
        <planeGeometry args={[100, 100, 256, 256]} />
        <shaderMaterial
          attach="material"
          args={[
            {
              uniforms: {
                uTime: { value: 0 },
                uHeight: { value: 3.0 },
              },
              vertexShader: `
                uniform float uTime;
                uniform float uHeight;
                varying vec2 vUv;
                void main() {
                  vUv = uv;
                  vec3 pos = position;
                  float noise = sin(pos.x * 0.2) * cos(pos.y * 0.4);
                  pos.z += noise * uHeight;
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
                }
              `,
              fragmentShader: `
                varying vec2 vUv;
                void main() {
                  // Create a grain effect
                  // float grain = fract(sin(dot(vUv.xy, vec2(12.9898, 78.233))) * 43758.5453);
                  
                  // Create a gradient from darker green at the lower y value to lighter green at the higher y value
                  vec3 color = mix(vec3(0.0, 0.5, 0.0), vec3(0.0, 0.1, 0.0), vUv.y);
                  
                  // Add grain to the color
                  //color += grain * 0.05;
                  
                  gl_FragColor = vec4(color, 1.0);
                }
              `,
            },
          ]}
        />
      </mesh> */}
      <Sky
        sunPosition={[-4, 1, 5]} // Adjust the sun position to change the lighting angle
        turbidity={10} //Higher turbidity gives a more scattered, warm look
        rayleigh={0.3} // Adjust to control the scattering effect
        inclination={0.6} // Adjust to modify the time of day, 0.6 gives a warm tone
        azimuth={0.25}
      />
      <Rig />
    </Canvas>
  );
}
