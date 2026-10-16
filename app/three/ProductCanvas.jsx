"use client";

import { Canvas } from "@react-three/fiber";
import Product from "./Product";
import { createRenderer } from "./v2/renderer";

/** Sidebar 3D product viewer (WiggleBone garment). Client-only, lazy-loaded. */
export default function ProductCanvas({ selectedColor }) {
  return (
    <Canvas
      className="w-full h-full overflow-hidden border rounded-lg bg-primary"
      camera={{ position: [0, 0, 1.3], fov: 55 }}
      gl={createRenderer}
    >
      <Product selectedColor={selectedColor} />
    </Canvas>
  );
}
