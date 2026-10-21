"use client";

import { Component, Suspense, useEffect, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
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
import Signs from "./signs/Signs";
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
import useLoadingStore from "../../components/loader/loadingStore";
import collectionStore from "../../stores/collectionStore";
import { setPointerCursor } from "./interactions";

// ?debug timings: the 3D chunk has loaded and evaluated.
useLoadingStore.getState().mark("sceneChunk");

const isMobileUA = () =>
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );

/** Renderer or scene crashed (no GPU, lost device…) → offer the 2D site instead. */
class SceneBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error) {
    console.error("[wooz] 3D scene failed", error);
    useQualityStore.getState().setTooHeavy("error");
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * No 3D hover / clicks on the intro screen: "Step inside" is the only way in
 * (a rack / book / Moos click from there left the intro overlay up).
 */
function IntroEventGate() {
  const setEvents = useThree((s) => s.setEvents);
  const intro = collectionStore((s) => s.introScreen);
  useEffect(() => {
    setEvents({ enabled: !intro });
    if (intro) setPointerCursor(false);
  }, [intro, setEvents]);
  return null;
}

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
    <SceneBoundary>
      <Leva hidden={!debug} collapsed={false} />
      <Canvas
        style={{ width: "100%", height: "100%" }}
        camera={{ position: [0, 1, 20], fov: isMobile ? 75 : 55 }}
        dpr={dpr}
        shadows="percentage"
        gl={createSceneRenderer}
        onCreated={({ gl }) => {
          if (typeof window !== "undefined") window.__renderer = gl;
          useLoadingStore.getState().mark("renderer");
          console.info(`[wooz] renderer backend: ${getBackendName(gl)}`);
        }}
      >
        <SharedUniforms />
        <IntroEventGate />
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
          <Signs />
          <Glass />
          <Birds />
          <WindStrokes />
          <Moos isMobile={isMobile} />
        </Suspense>
        <PostPipeline />
        {debug && <Debug />}
      </Canvas>
    </SceneBoundary>
  );
}
