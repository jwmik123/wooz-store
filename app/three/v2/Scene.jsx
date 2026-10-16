"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { createRenderer, getBackendName } from "./renderer";
import { SharedUniforms } from "./uniforms";
import CameraRig from "./CameraRig";
import Lights from "./lighting/Lights";
import Studio, { StudioRoot } from "./Studio";
import Clothes from "./Clothes";
import Hotspots from "./Hotspots";
import Birds from "./Birds";
import Debug from "./debug/Debug";
import useDebug from "./debug/useDebug";

const isMobileUA = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

/**
 * V2 scene composition. One line per feature; features talk via
 * ./uniforms.js and the zustand stores, not via each other's components.
 * Client-only: import with next/dynamic { ssr: false }.
 */
export default function Scene() {
  const debug = useDebug();
  const [isMobile] = useState(isMobileUA);

  return (
    <>
      <Leva hidden={!debug} collapsed={false} />
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 1, 20], fov: isMobile ? 75 : 55 }}
        dpr={[1, isMobile ? 1.5 : 2]}
        shadows="percentage"
        gl={createRenderer}
        onCreated={({ gl }) => {
          if (typeof window !== "undefined") window.__renderer = gl;
          console.info(`[wooz] renderer backend: ${getBackendName(gl)}`);
        }}
      >
        <SharedUniforms />
        <CameraRig debug={debug} />
        <Lights />
        <Suspense fallback={null}>
          <StudioRoot>
            <Studio />
            <Clothes />
            <Hotspots isMobile={isMobile} />
          </StudioRoot>
          <Birds />
        </Suspense>
        {debug && <Debug />}
      </Canvas>
    </>
  );
}
