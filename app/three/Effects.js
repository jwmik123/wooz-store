"use client";

import {
  EffectComposer,
  Outline,
  ToneMapping,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import { useThree } from "@react-three/fiber";

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
        visibleEdgeColor="green"
        hiddenEdgeColor="green"
        width={size.width * 1}
        edgeStrength={20}
        selection={targetMeshes}
      />
      <ToneMapping blendFunction={BlendFunction.MULTIPLY} />
    </EffectComposer>
  );
}
export default Effects;
