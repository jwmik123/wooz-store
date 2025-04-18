/*
Auto-generated by: https://github.com/pmndrs/gltfjsx
Command: npx gltfjsx@6.5.3 smoke.glb -d 
*/

import React from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import vertexShader from "./shaders/smoke/vertex.glsl";
import fragmentShader from "./shaders/smoke/fragment.glsl";

export default function Smoke(props) {
  const { nodes } = useGLTF("/models/smoke.glb");
  const textureLoader = new THREE.TextureLoader();

  const perlinTexture = textureLoader.load("/assets/perlin.png");
  perlinTexture.wrapS = THREE.RepeatWrapping;
  perlinTexture.wrapT = THREE.RepeatWrapping;

  useFrame(({ clock }) => {
    smokeMaterial.uniforms.uTime.value = clock.getElapsedTime();
  });

  const smokeMaterial = new THREE.ShaderMaterial({
    vertexShader: vertexShader,
    fragmentShader: fragmentShader,
    uniforms: {
      uTime: new THREE.Uniform(0),
      uPerlinTexture: new THREE.Uniform(perlinTexture),
    },
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  return (
    <group {...props} dispose={null}>
      <mesh
        geometry={nodes.CoffeeSmoke.geometry}
        material={smokeMaterial}
        position={[-0.5, -1.0, 1.5]}
        rotation={[0, Math.PI / 2, -Math.PI / 2]}
        scale={[0.131, 0.036, 0.036]}
      />
    </group>
  );
}

useGLTF.preload("/models/smoke.glb");
