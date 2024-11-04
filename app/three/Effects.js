"use client";
import {
  EffectComposer,
  Outline,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useThree } from "@react-three/fiber";

import { useControls } from "leva";

function Effects({ blendFunction, targetMeshes }) {
  const { size, camera } = useThree();
  camera.layers.enable(1);

  return (
    <EffectComposer
      autoClear={false}
      disableNormalPass={true}
      multisampling={4}
    >
      <Outline
        visibleEdgeColor="white"
        hiddenEdgeColor="white"
        blur
        pulseSpeed={0.5}
        width={size.width * 1.5}
        edgeStrength={10}
        selection={targetMeshes}
      />
      <ToneMapping adaptive blendFunction={blendFunction} />
    </EffectComposer>
  );
}
export default Effects;
