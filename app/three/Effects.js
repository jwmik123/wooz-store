import { EffectComposer, Outline } from "@react-three/postprocessing";

import { useThree } from "@react-three/fiber";

function Effects() {
  const { size } = useThree();
  return (
    <EffectComposer
      stencilBuffer
      disableNormalPass
      autoClear={false}
      multisampling={4}
      antialias
    >
      <Outline
        visibleEdgeColor="white"
        hiddenEdgeColor="white"
        blur
        width={size.width * 2}
        edgeStrength={10}
      />
    </EffectComposer>
  );
}
export default Effects;
