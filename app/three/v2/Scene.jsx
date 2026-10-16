"use client";

import { Suspense, useEffect, useState } from "react";
import { Canvas } from "@react-three/fiber";
import { Leva } from "leva";
import { createSceneRenderer, getBackendName } from "./renderer";
import { SharedUniforms } from "./uniforms";
import CameraRig from "./CameraRig";
import Lights from "./lighting/Lights";
import RackSpots from "./lighting/RackSpots";
import Studio, { StudioRoot } from "./Studio";
import Glass from "./glass/Glass";
import Clothes from "./Clothes";
import Hotspots from "./Hotspots";
import Birds from "./Birds";
import Clouds from "./clouds/Clouds";
import Garden from "./garden/Garden";
import PostPipeline from "./post/PostPipeline";
import WindStrokes from "./wind/WindStrokes";
import Moos from "./moos/Moos";
import Debug from "./debug/Debug";
import useDebug from "./debug/useDebug";
import QualityMonitor from "./perf/QualityMonitor";
import WarmUp from "./loading/WarmUp";
import useQualityStore, { VEILED_DPR } from "./perf/quality";

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
  // Adaptive quality (perf/quality.js): DPR is owned by the quality store.
  const dpr = useQualityStore((s) => (s.veiled ? VEILED_DPR : s.dpr));

  return (
    <>
      <Leva hidden={!debug} collapsed={false} />
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 1, 20], fov: isMobile ? 75 : 55 }}
        dpr={dpr}
        shadows="percentage"
        gl={createSceneRenderer}
        onCreated={({ gl }) => {
          if (typeof window !== "undefined") window.__renderer = gl;
          console.info(`[wooz] renderer backend: ${getBackendName(gl)}`);
        }}
      >
        <SharedUniforms />
        <QualityMonitor />
        <WarmUp />
        <CameraRig debug={debug} isMobile={isMobile} />
        <Lights />
        <RackSpots />
        <Clouds />
        <Garden isMobile={isMobile} />
        <Suspense fallback={null}>
          <StudioRoot>
            <Studio />
            <Clothes />
            <Hotspots isMobile={isMobile} />
          </StudioRoot>
          <Glass />
          <Birds />
          <WindStrokes />
          <Moos isMobile={isMobile} />
        </Suspense>
        <PostPipeline />
        {debug && <Debug />}
      </Canvas>
    </>
  );
}
