"use client";

import { useRef, useEffect, useState } from "react";

import * as THREE from "three";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { useLoader, useFrame } from "@react-three/fiber";
import { Select, Selection } from "@react-three/postprocessing";

import {
  splatterConfig,
  longSleeveConfig,
  poloConfig,
  hoodieConfig,
} from "./assets/clothingConfig";
import collectionStore from "../stores/collectionStore";

import vertexShader from "./shaders/studio/vertexShader.glsl";
import fragmentShader from "./shaders/studio/fragmentShader.glsl";

const CAMERA_POSITIONS = {
  longsleeve: {
    position: new THREE.Vector3(0, -0.7, 1.2),
    target: new THREE.Vector3(3.4, -1, -1.1),
  },
  polo: {
    position: new THREE.Vector3(0.15, -0.8, -0.45),
    target: new THREE.Vector3(4.6, -1, -4),
  },
  splatter: {
    position: new THREE.Vector3(-0.1, -0.6, -0.8),
    target: new THREE.Vector3(-1, -1, -2),
  },
  hoodie: {
    position: new THREE.Vector3(0.5, -0.6, -1),
    target: new THREE.Vector3(0, -1, -5),
  },
  default: {
    position: new THREE.Vector3(0, 0, 5),
    target: new THREE.Vector3(0, 0, 0),
  },
  intro: {
    position: new THREE.Vector3(0, 0, 20),
    target: new THREE.Vector3(0, 0, 0),
  },
};

const NODE_NAMES = {
  longsleeve: "Longsleeve",
  polo: "Polo2",
  splatter: "Splatter",
  hoodie: "Hoodie",
};

export default function StudioNew(props) {
  const orbitControlsRef = useRef();
  const [mouse] = useState(() => ({ x: 0, y: 0 }));
  const [targetCameraPosition, setTargetCameraPosition] = useState(
    new THREE.Vector3()
  );
  const [targetCameraTarget, setTargetCameraTarget] = useState(
    new THREE.Vector3()
  );

  const { nodes } = useGLTF("/models/studio.glb");
  const bakedFinalTexture = useLoader(
    THREE.TextureLoader,
    "/assets/bakednew.jpg"
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
  const setSidebarOpen = collectionStore((state) => state.setSidebarOpen);
  const sidebarOpen = collectionStore((state) => state.sidebarOpen);
  const introScreen = collectionStore((state) => state.introScreen);

  useEffect(() => {
    if (!sidebarOpen && orbitControlsRef.current) {
      const defaultConfig = introScreen
        ? CAMERA_POSITIONS.intro
        : CAMERA_POSITIONS.default;

      // Use a temporary Vector3 for the position and target
      const newTargetCameraPosition = new THREE.Vector3().copy(
        defaultConfig.position
      );
      const newTargetCameraTarget = new THREE.Vector3().copy(
        defaultConfig.target
      );

      setTargetCameraPosition(newTargetCameraPosition);
      setTargetCameraTarget(newTargetCameraTarget);
    }

    if (!sidebarOpen) {
      document.querySelectorAll(".point").forEach((point) => {
        point.classList.add("visible");
      });
    }
  }, [sidebarOpen, introScreen]);

  useEffect(() => {
    const updateMouse = (event) => {
      // Convert mouse coordinates to normalized device coordinates (-1 to +1)
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };

    window.addEventListener("mousemove", updateMouse);
    return () => window.removeEventListener("mousemove", updateMouse);
  }, [mouse]);

  const handlePointerOver = () => (document.body.style.cursor = "pointer");
  const handlePointerOut = () => (document.body.style.cursor = "auto");

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

    const cameraConfig = CAMERA_POSITIONS[type];
    const newTargetCameraPosition = new THREE.Vector3().copy(
      cameraConfig.position
    );
    const newTargetCameraTarget = new THREE.Vector3().copy(cameraConfig.target);

    setTargetCameraPosition(newTargetCameraPosition);
    setTargetCameraTarget(newTargetCameraTarget);

    setTimeout(() => {
      setSidebarOpen(true);
    }, 500);
  };

  useFrame(({ camera }) => {
    // Lerp camera position and target
    if (orbitControlsRef.current) {
      orbitControlsRef.current.object.position.lerp(targetCameraPosition, 0.02);
      orbitControlsRef.current.target.lerp(targetCameraTarget, 0.02);
      orbitControlsRef.current.update();
    }

    // Update points
    for (const point of points) {
      if (point.element) {
        const screenPosition = point.position.clone();
        screenPosition.project(camera);

        const translateX = (screenPosition.x * window.innerWidth) / 2;
        const translateY = -(screenPosition.y * window.innerHeight) / 2;

        point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`;
      }
    }
    // Show camera x, y, z position
    // const cameraPosition = camera.position;
    // console.log(
    //   `Camera Position - x: ${cameraPosition.x}, y: ${cameraPosition.y}, z: ${cameraPosition.z}`
    // );
  });

  // Handle points for labels/annotations
  const points = [
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
      position: new THREE.Vector3(1.4, -1, -0.4),
      element: document.querySelector(".point-3"),
    },
  ];

  return (
    <>
      <OrbitControls
        ref={orbitControlsRef}
        enableZoom={false}
        enablePan={false}
        enableRotate={false}
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
                onPointerOver={handlePointerOver}
                onPointerOut={handlePointerOut}
                onClick={() => handleCollectionClick(type)}
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
