"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { uSunDirection } from "../uniforms";

// PLACEHOLDER light rig (workstream 0). The lighting workstream replaces this
// file: sun through the windows, shadows, sky, night/interior lights.
const SUN_DISTANCE = 15;

export default function Lights() {
  const sun = useRef();

  useFrame(() => {
    const d = uSunDirection.value;
    // Keep a little light at night so the store stays readable until real night lighting exists.
    sun.current.position.set(d.x, Math.max(d.y, 0.25), d.z).multiplyScalar(SUN_DISTANCE);
  });

  return (
    <>
      <hemisphereLight args={["#e8f2ff", "#c9b9a6", 1.6]} />
      <directionalLight ref={sun} color="#fff4e2" intensity={2.2} />
    </>
  );
}
