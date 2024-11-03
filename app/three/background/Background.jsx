import React, { useRef } from "react";
import { useLoader } from "@react-three/fiber";
import { TextureLoader } from "three";
import { Plane } from "@react-three/drei";

const Background = ({ textureUrl, position, scale }) => {
  const texture = useLoader(TextureLoader, textureUrl);
  const backgroundRef = useRef();

  return (
    <Plane ref={backgroundRef} args={[1, 1]} position={position} scale={scale}>
      <meshBasicMaterial attach="material" map={texture} />
    </Plane>
  );
};

export default Background;
