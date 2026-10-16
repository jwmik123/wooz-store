"use client";

import { useFrame } from "@react-three/fiber";
import { useControls } from "leva";
import { atmosphere } from "../lighting/atmosphere";
import { uGardenFog, uHemiGround, uHemiSky, updateWindPhases } from "./gardenCommon";
import Terrain from "./Terrain";
import Grass from "./Grass";
import Flowers from "./Flowers";
import Trees from "./Trees";
import Props from "./Props";
import Critters from "./Critters";
import SaleSign from "./SaleSign";
import { useTierSettings } from "../perf/quality";

/*
 * The garden around the greenhouse studio (workstream 8). Mount once inside
 * <Canvas>: <Garden isMobile={isMobile} />.
 *
 * Everything is procedural (no assets) and instanced; see each module for
 * real-world dimensions. Toggle elements / density in leva ("Garden", #debug).
 */
export default function Garden({ isMobile = false }) {
  const c = useControls(
    "Garden",
    {
      ground: true,
      hills: true,
      grass: true,
      grassFar: true,
      grassDensity: { value: 1, min: 0.1, max: 1, step: 0.05 },
      flowers: true,
      trees: true,
      props: true,
      critters: true,
      saleSign: true,
      fog: {
        value: uGardenFog.value,
        min: 0,
        max: 0.006,
        step: 0.0001,
        onChange: (v) => (uGardenFog.value = v),
      },
    },
    { collapsed: true }
  );

  // Hemisphere fill from the lighting workstream's atmosphere (read-only).
  useFrame((state) => {
    updateWindPhases(state.clock.elapsedTime);
    const a = atmosphere;
    uHemiSky.value.copy(a.hemiSky).multiplyScalar(a.hemiIntensity);
    uHemiGround.value.copy(a.hemiGround).multiplyScalar(a.hemiIntensity);
  });

  const quality = isMobile ? 0.4 : 1;
  // Adaptive quality tier (perf/quality.js) thins the grass on slower GPUs.
  const tier = useTierSettings();

  return (
    <>
      {c.ground && <Terrain hills={c.hills} />}
      {c.grass && <Grass quality={quality} density={c.grassDensity * tier.grass} far={c.grassFar} />}
      {c.flowers && <Flowers quality={isMobile ? 0.5 : 1} />}
      {c.trees && <Trees quality={isMobile ? 0.6 : 1} />}
      {c.props && <Props />}
      {c.saleSign && <SaleSign />}
      {c.critters && <Critters quality={isMobile ? 0.5 : 1} />}
    </>
  );
}
