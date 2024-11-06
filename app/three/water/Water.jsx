import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Water } from "three/addons/objects/Water.js";

const WaterComponent = () => {
  const waterRef = useRef();

  const waterGeometry = new THREE.PlaneGeometry(500, 500);

  const water = new Water(waterGeometry, {
    textureWidth: 512,
    textureHeight: 512,
    waterNormals: new THREE.TextureLoader().load(
      "assets/waternormals.jpg",
      function (texture) {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
      }
    ),
    sunDirection: new THREE.Vector3(),
    sunColor: 0xff0000,
    waterColor: 0x001100, // 0x001e0f
    distortionScale: 3.7,
  });

  water.rotation.x = -Math.PI / 2;

  console.log(water.material.uniforms);

  useFrame((clock) => {
    if (waterRef.current) {
      waterRef.current.material.uniforms.time.value += 0.1 / 60.0;
    }
  });

  return <primitive ref={waterRef} object={water} position={[0, -3.5, 0]} />;
};

export default WaterComponent;
