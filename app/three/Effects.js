"use client";
import { EffectComposer, Outline } from "@react-three/postprocessing";
import { useThree } from "@react-three/fiber";

function Effects({ hoveredItem, targetMeshes }) {
  const { size, camera } = useThree();
  camera.layers.enable(1);

  return (
    <EffectComposer
      autoClear={false}
      disableNormalPass={true}
      multisampling={4}
    >
      <Outline
        visibleEdgeColor={hoveredItem ? "white" : "green"}
        hiddenEdgeColor={hoveredItem ? "white" : "green"}
        blur
        pulseSpeed={0.5}
        width={size.width * 1.5}
        edgeStrength={10}
        selection={targetMeshes}
      />
    </EffectComposer>
  );
}
export default Effects;
