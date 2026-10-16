"use client";

import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { uWindDirection, uWindStrength } from "../uniforms";
import { uCloudBrightness, uCloudDrift, uCloudFogDensity } from "./cloudCommon";
import CloudPuffs from "./CloudPuffs";
import Steam from "./Steam";

const DRIFT_SPEED = 2.5; // world units / s at windStrength 1 (clouds are 300-900 m away)

/**
 * Sky layer for the garden: distant fair-weather cumulus above the horizon
 * (the studio is grounded now, so the cloud sea below it is gone) plus the
 * coffee steam. Everything reads the shared atmosphere uniforms; mount once
 * inside <Canvas>.
 */
export default function Clouds() {
  const { puffs, steam } = useControls(
    "Clouds",
    {
      puffs: true,
      steam: true,
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
    },
    { collapsed: true }
  );

  useFrame((_, delta) => {
    const d = uWindDirection.value;
    const k = Math.min(delta, 0.1) * uWindStrength.value * DRIFT_SPEED;
    uCloudDrift.value.x += d.x * k;
    uCloudDrift.value.y += d.z * k;
  });

  return (
    <>
      {puffs && <CloudPuffs />}
      {steam && <Steam />}
    </>
  );
}
