"use client";

import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { uWindDirection, uWindStrength } from "../uniforms";
import { uCloudBrightness, uCloudDrift, uCloudFogDensity } from "./cloudCommon";
import CloudSea, { uSeaCoverage, uVeilCoverage } from "./CloudSea";
import CloudPuffs from "./CloudPuffs";
import Steam from "./Steam";

const DRIFT_SPEED = 1.1; // world units / s at windStrength 1

/**
 * Sky-island cloud layer: an endless cloud sea below the studio plus a field of
 * nearby cumulus. Everything reads the shared atmosphere uniforms; mount once
 * inside <Canvas>.
 */
export default function Clouds() {
  const { sea, veil, puffs, steam } = useControls("Clouds", {
    sea: true,
    veil: true,
    puffs: true,
    steam: true,
    coverage: {
      value: uSeaCoverage.value,
      min: 0.2,
      max: 0.7,
      step: 0.01,
      onChange: (v) => (uSeaCoverage.value = v),
    },
    veilCoverage: {
      value: uVeilCoverage.value,
      min: 0.3,
      max: 0.9,
      step: 0.01,
      onChange: (v) => (uVeilCoverage.value = v),
    },
    brightness: {
      value: uCloudBrightness.value,
      min: 0.3,
      max: 2,
      step: 0.01,
      onChange: (v) => (uCloudBrightness.value = v),
    },
    fog: {
      value: uCloudFogDensity.value,
      min: 0,
      max: 3,
      step: 0.01,
      onChange: (v) => (uCloudFogDensity.value = v),
    },
  }, { collapsed: true });

  useFrame((_, delta) => {
    const d = uWindDirection.value;
    const k = Math.min(delta, 0.1) * uWindStrength.value * DRIFT_SPEED;
    uCloudDrift.value.x += d.x * k;
    uCloudDrift.value.y += d.z * k;
  });

  return (
    <>
      <CloudSea deck={sea} veil={veil} />
      {puffs && <CloudPuffs />}
      {steam && <Steam />}
    </>
  );
}
