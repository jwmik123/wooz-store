import React, { useRef, useEffect } from "react";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const DebugComponent = ({
  instanceCount = 5000,
  maxInstanceCount = 25000,
  scale = 10,
  size = { x: 10, y: 8, z: 10 }, // Increased size to make flowers bigger
  sizeVariation = { x: 2, y: 4, z: 2 }, // Increased size variation to make flowers bigger
  rotation = { x: 0, y: 0, z: 0 },
}) => {
  const debugRef = useRef();
  const loaded = useRef(false);
  const { scene: flowerModel } = useGLTF("/flower_blue.glb");

  useEffect(() => {
    if (!loaded.current) {
      generateFlowers();
      loaded.current = true;
    }
  }, []);

  const generateFlowers = () => {
    const instancedFlowers = new THREE.InstancedMesh(
      flowerModel.children[0].geometry,
      flowerModel.children[0].material,
      maxInstanceCount
    );
    const dummy = new THREE.Object3D();

    let count = 0;
    for (let i = 0; i < maxInstanceCount; i++) {
      const r = 10 + Math.random() * 500;
      const theta = Math.random() * 2.0 * Math.PI;
      const p = new THREE.Vector3(r * Math.cos(theta), 0, r * Math.sin(theta));

      dummy.position.copy(p);
      dummy.rotation.set(0, 2 * Math.PI * Math.random(), 0);
      dummy.scale.set(
        sizeVariation.x * Math.random() + size.x,
        sizeVariation.y * Math.random() + size.y,
        sizeVariation.z * Math.random() + size.z
      );

      dummy.updateMatrix();
      instancedFlowers.setMatrixAt(count, dummy.matrix);
      count++;
    }

    instancedFlowers.count = instanceCount;
    instancedFlowers.instanceMatrix.needsUpdate = true;

    if (debugRef.current) {
      debugRef.current.add(instancedFlowers);
    } else {
      console.error("Debug reference is not set");
    }
  };

  return <group ref={debugRef} />;
};

export default DebugComponent;
