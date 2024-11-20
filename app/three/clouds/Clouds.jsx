import React, { useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Plane } from "@react-three/drei";

const Cloud = ({ textureUrl, position, scale }) => {
  const texture = useLoader(TextureLoader, textureUrl);
  const cloudRef = useRef();

  return (
    <Plane ref={cloudRef} args={[1, 1]} position={position} scale={scale}>
      <meshBasicMaterial
        attach="material"
        map={texture}
        transparent
        opacity={0.5}
      />
    </Plane>
  );
};

const FakeClouds = () => {
  return (
    <>
      <Cloud
        textureUrl="/assets/cloud1.png"
        position={[-7, 8, -25]}
        scale={[10, 8, 8]}
      />

      <Cloud
        textureUrl="/assets/cloud1.png"
        position={[40, 25, -90]}
        scale={[40, 20, 30]}
      />
      <Cloud
        textureUrl="/assets/cloud1.png"
        position={[-1, 30, -50]}
        scale={[20, 20, 20]}
      />
    </>
  );
};

export default FakeClouds;
