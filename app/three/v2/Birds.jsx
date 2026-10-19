import { useRef, useMemo } from "react";
import { useGraph, useFrame } from "@react-three/fiber";
import { useGLTF, useAnimations } from "@react-three/drei";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BIRD_URL } from "../../components/loader/criticalAssets";

function Bird({ timeOffset = 0, ...props }) {
  const group = useRef();
  const { scene, animations } = useGLTF(BIRD_URL);
  const clone = useMemo(() => cloneSkinned(scene), [scene]);
  const { nodes, materials } = useGraph(clone);
  const { actions } = useAnimations(animations, group);

  useFrame(({ clock }) => {
    const action = actions["Take 001"];
    action.time =
      ((clock.elapsedTime + timeOffset) % action.getClip().duration) * 2.5;
    action.play();
  });

  return (
    <group ref={group} {...props} dispose={null} scale={0.1}>
      <group name="Sketchfab_Scene">
        <primitive object={nodes._rootJoint} />
        <skinnedMesh
          name="Object_7"
          geometry={nodes.Object_7.geometry}
          material={materials.blinn2}
          skeleton={nodes.Object_7.skeleton}
        />
      </group>
    </group>
  );
}

export default function Birds() {
  const birdsRef = useRef();
  useFrame(() => {
    birdsRef.current.position.x += 0.04;
    if (birdsRef.current.position.x > 100) {
      birdsRef.current.position.x = -100;
    }
  });
  return (
    <group
      ref={birdsRef}
      rotation={[0, Math.PI / 2, 0]}
      position={[0, 10, -30]}
    >
      <Bird
        timeOffset={0}
        position={[Math.random() * 5, 0, Math.random() * 5, 0]}
      />
      <Bird
        timeOffset={0.33}
        position={[Math.random() * 5 - 2, Math.random() * 5 - 2, 0]}
      />
      <Bird
        timeOffset={0.66}
        position={[Math.random() * 5 - 1, Math.random() * 5 - 1, 0]}
      />
    </group>
  );
}

useGLTF.preload(BIRD_URL);
