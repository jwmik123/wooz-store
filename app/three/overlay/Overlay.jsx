"use client";

import React from "react";
import { Html } from "@react-three/drei";

const Overlay = () => {
  return (
    <>
      <Html
        as="div"
        position={[1.5, -0.25, 0]}
        distanceFactor={5}
        transform
        rotation={[0, -Math.PI / 4, 0]}
        scale={0.3}
        occlude
        className="z-0 flex items-center justify-center w-32 px-2 py-1 text-sm text-center text-black bg-white border border-white rounded-full ripple"
      >
        New Collection
        <div className="absolute w-3 h-3 bg-green-500 rounded-full -top-1 -right-1 ripple"></div>
      </Html>
    </>
  );
};

export default Overlay;
