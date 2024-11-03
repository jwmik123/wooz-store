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

const Clouds = () => {
  return (
    <>
      <Cloud
        textureUrl="/assets/cloud1.png"
        position={[-6, 8, -20]}
        scale={[8, 8, 8]}
      />
      <Cloud
        textureUrl="/assets/cloud1.png"
        position={[40, 30, -70]}
        scale={[20, 20, 20]}
      />
    </>
  );
};

export default Clouds;
