"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { useLoader, useFrame, useThree } from "@react-three/fiber";
import { Select, Selection } from "@react-three/postprocessing";

import {
  splatterConfig,
  longSleeveConfig,
  poloConfig,
  hoodieConfig,
} from "./assets/clothingConfig";
import collectionStore from "../stores/collectionStore";
import useCameraStore from "../stores/cameraStore";

import vertexShader from "./shaders/studio/vertexShader.glsl";
import fragmentShader from "./shaders/studio/fragmentShader.glsl";

const NODE_NAMES = {
  longsleeve: "Longsleeve",
  polo: "Polo2",
  splatter: "Splatter",
  hoodie: "Hoodie",
};

export default function StudioNew({ showDebug, ...props }) {
  const orbitControlsRef = useRef();
  const [mouse] = useState(() => ({ x: 0, y: 0 }));

  // Get camera state and methods from camera store
  const {
    targetCameraPosition,
    targetCameraTarget,
    updateCameraConfig,
    resetCamera,
  } = useCameraStore();

  const { nodes } = useGLTF("/models/studio.glb");
  const bakedFinalTexture = useLoader(
    THREE.TextureLoader,
    "/assets/baked3.jpg"
  );
  bakedFinalTexture.colorSpace = THREE.SRGBColorSpace;
  bakedFinalTexture.flipY = false;

  const shaderMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uBakedDayTexture: { value: bakedFinalTexture },
    },
    vertexShader,
    fragmentShader,
    side: THREE.DoubleSide,
  });

  const setProductHandle = collectionStore((state) => state.setProductHandle);
  const setSelectedCollection = collectionStore(
    (state) => state.setSelectedCollection
  );
  const setSidebarOpen = collectionStore((state) => state.setSidebarOpen);
  const sidebarOpen = collectionStore((state) => state.sidebarOpen);
  const introScreen = collectionStore((state) => state.introScreen);
  const setCartOpen = collectionStore((state) => state.setCartOpen);

  useEffect(() => {
    if (!sidebarOpen && orbitControlsRef.current) {
      resetCamera(introScreen);
    }

    if (!sidebarOpen) {
      document.querySelectorAll(".point").forEach((point) => {
        point.classList.add("visible");
      });
    }
  }, [sidebarOpen, introScreen, resetCamera]);

  useEffect(() => {
    const updateMouse = (event) => {
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", updateMouse);
    return () => window.removeEventListener("mousemove", updateMouse);
  }, [mouse]);

  const handlePointerOver = () => {
    document.body.style.cursor = "pointer";
  };
  const handlePointerOut = () => {
    document.body.style.cursor = "auto";
  };

  const clothingConfigs = {
    longsleeve: longSleeveConfig,
    polo: poloConfig,
    splatter: splatterConfig,
    hoodie: hoodieConfig,
  };

  const handleCollectionClick = (type) => {
    setProductHandle(type);

    document.querySelectorAll(".point").forEach((point) => {
      point.classList.remove("visible");
    });

    if (!orbitControlsRef.current) return;

    updateCameraConfig(type);

    setTimeout(() => {
      setSidebarOpen(true);
    }, 100);
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  useFrame(({ camera }) => {
    const lerpSpeed = 0.04;
    if (orbitControlsRef.current) {
      orbitControlsRef.current.object.position.lerp(
        targetCameraPosition,
        lerpSpeed
      );
      // If the camera is in the default position, move the target towards the mouse
      if (targetCameraPosition.equals(new THREE.Vector3(0, 0, 5))) {
        orbitControlsRef.current.target.lerp(
          new THREE.Vector3(mouse.x * 0.4, mouse.y * 0.1, 5),
          0.02
        );
      }
      orbitControlsRef.current.target.lerp(targetCameraTarget, lerpSpeed);
      orbitControlsRef.current.update();
    }

    // Update points
    for (const point of points) {
      if (point.element) {
        const screenPosition = point.position.clone();
        screenPosition.project(camera);

        const translateX = (screenPosition.x * window.innerWidth) / 2;
        const translateY = -(screenPosition.y * window.innerHeight) / 2;

        // Apply dynamic offset based on viewport differences
        const viewportOffset = isMobile() ? -50 : 0;

        point.element.style.transform = `translateX(${translateX}px) translateY(${
          translateY - viewportOffset
        }px)`;
      }
    }
  });

  // Handle points for labels/annotations
  const points = useMemo(
    () => [
      {
        position: new THREE.Vector3(0, -1, -3),
        element: document.querySelector(".point-0"),
      },
      {
        position: new THREE.Vector3(-1.2, -1, -1.8),
        element: document.querySelector(".point-1"),
      },
      {
        position: new THREE.Vector3(1.1, -1, -1.8),
        element: document.querySelector(".point-2"),
      },
      {
        position: new THREE.Vector3(1.55, -1, -0.4),
        element: document.querySelector(".point-3"),
      },
    ],
    []
  );

  return (
    <>
      <OrbitControls
        ref={orbitControlsRef}
        enableZoom={showDebug}
        enablePan={showDebug}
        enableRotate={showDebug}
      />
      <group
        {...props}
        dispose={null}
        rotation={[0, -Math.PI / 2, 0]}
        layers={1}
      >
        <mesh
          name="studio"
          geometry={nodes.studio.geometry}
          material={shaderMaterial}
          position={[0, 1.5, 0]}
          castShadow
          receiveShadow
        />
        <Selection>
          {Object.entries(clothingConfigs).map(([type, config]) => (
            <Select key={type}>
              <group
                onPointerOver={() => {
                  handlePointerOver();
                  setSelectedCollection(type);
                }}
                onPointerOut={() => {
                  handlePointerOut();
                  setSelectedCollection(null);
                }}
                onClick={() => {
                  handleCollectionClick(type);
                  setCartOpen(false);
                }}
                renderOrder={type === "longsleeve" ? 1 : 0}
              >
                {config.map(({ color, position, rotation }, index) => {
                  const nodeName = `${NODE_NAMES[type]}_${color}_High002`;
                  if (!nodes[nodeName]) {
                    console.warn(`Node not found: ${nodeName}`);
                    return null;
                  }
                  return (
                    <mesh
                      key={`${type}_${color}_${index}`}
                      geometry={nodes[nodeName].geometry}
                      material={shaderMaterial}
                      position={position}
                      rotation={rotation}
                      castShadow
                      receiveShadow
                      renderOrder={type === "longsleeve" ? 1 : 0}
                    />
                  );
                })}
              </group>
            </Select>
          ))}
        </Selection>
      </group>
    </>
  );
}

useGLTF.preload("/models/studio.glb");
