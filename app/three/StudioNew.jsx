"use client";

import { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";
import { useGLTF, OrbitControls } from "@react-three/drei";
import { useLoader, useFrame } from "@react-three/fiber";
import { Select, Selection } from "@react-three/postprocessing";
import gsap from "gsap";

import { Book } from "./Book";

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

  const bookVisible = collectionStore((state) => state.bookVisible);
  const setBookVisible = collectionStore((state) => state.setBookVisible);

  const {
    targetCameraPosition,
    targetCameraTarget,
    setCameraPosition,
    setCameraTarget,
    setCinematic,
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

    setCinematic(false);

    setTimeout(() => {
      setSidebarOpen(true);
    }, 100);
  };

  const isMobile = () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  };

  const getDeviceOffset = () => {
    if (!/iPhone/.test(navigator.userAgent)) return 0;

    const { width, height } = window.screen;
    const screenHeight = Math.max(width, height);
    const screenWidth = Math.min(width, height);
    const pixelRatio = window.devicePixelRatio;

    const isInstagramBrowser = /Instagram/.test(navigator.userAgent);
    const isLinkedInBrowser = /LinkedIn/.test(navigator.userAgent);
    const isTwitterBrowser = /Twitter/.test(navigator.userAgent);
    // const isXBrowser = /X/.test(navigator.userAgent);

    if (isInstagramBrowser || isLinkedInBrowser || isTwitterBrowser) return 0;

    // Device model check based on iOS version might be more reliable
    const iOSVersion = parseInt(
      (navigator.userAgent.match(/OS (\d+)_/i) || [])[1]
    );

    if (screenHeight === 844 && screenWidth === 390) {
      return iOSVersion >= 17 ? 70 : 0; // iOS 17+ (iPhone 15) needs offset
    }

    return screenHeight > 850 ? 70 : 0;
  };

  useFrame(({ camera }) => {
    if (orbitControlsRef.current) {
      gsap.to(orbitControlsRef.current.object.position, {
        x: targetCameraPosition.x,
        y: targetCameraPosition.y,
        z: targetCameraPosition.z,
        duration: 1.5,
      });

      if (targetCameraPosition.equals(new THREE.Vector3(0, 0, 5))) {
        gsap.to(orbitControlsRef.current.target, {
          x: mouse.x * 0.2,
          y: mouse.y * 0.1,
          z: 5,
          duration: 0.5,
        });
      }

      gsap.to(orbitControlsRef.current.target, {
        x: targetCameraTarget.x,
        y: targetCameraTarget.y,
        z: targetCameraTarget.z,
        duration: 1.5,
      });
      orbitControlsRef.current.update();
    }

    // Update points
    for (const point of points) {
      if (point.element) {
        const screenPosition = point.position.clone();
        screenPosition.project(camera);

        const viewPort = window.visualViewport;

        const translateX =
          (screenPosition.x * (viewPort.width || window.innerWidth)) / 2;
        const translateY =
          -(screenPosition.y * (viewPort.height || window.innerHeight)) / 2 +
          getDeviceOffset();

        point.element.style.transform = `translateX(${translateX}px) translateY(${translateY}px)`;
      }
    }
  });

  const [points, setPoints] = useState([]);

  useEffect(() => {
    setPoints([
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
      {
        position: new THREE.Vector3(0.6, -1.1, 1.7),
        element: document.querySelector(".point-4"),
      },
      {
        position: new THREE.Vector3(0, -1.1, 1.7),
        element: document.querySelector(".point-5"),
      },
      {
        position: new THREE.Vector3(-0.5, -1.18, 1.5),
        element: document.querySelector(".point-6"),
      },
    ]);
  }, []);

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
          <Select>
            <mesh
              position={[3.4, 0.9, -0.55]}
              onPointerOver={() => {
                handlePointerOver();
                setSelectedCollection("totebag");
              }}
              onPointerOut={() => {
                handlePointerOut();
                setSelectedCollection(null);
              }}
              onClick={() => {
                handleCollectionClick("totebag");
                setCartOpen(false);
              }}
            >
              <boxGeometry args={[0.3, 0.2, 0.3]} />
              <meshStandardMaterial color="red" visible={false} />
            </mesh>
          </Select>
          <Select>
            <mesh
              position={[2.9, 0.75, 0.5]}
              onPointerOver={() => {
                handlePointerOver();
              }}
              onPointerOut={() => {
                handlePointerOut();
              }}
              onClick={() => {
                setCameraPosition(new THREE.Vector3(-0.5, -1, 2.1));
                setCameraTarget(new THREE.Vector3(0, -1, -3));
                setCinematic(true);
              }}
            >
              <boxGeometry args={[0.1, 0.1, 0.1]} />
              <meshStandardMaterial color="red" visible={false} />
            </mesh>
          </Select>
          {!isMobile() && (
            <Select>
              <mesh
                position={[3, 0.75, 0]}
                onPointerOver={() => {
                  !bookVisible && handlePointerOver();
                }}
                onPointerOut={() => {
                  !bookVisible && handlePointerOut();
                }}
                onClick={() => {
                  if (!bookVisible) {
                    setCameraPosition(new THREE.Vector3(0, -0.5, 1.9));
                    setCameraTarget(new THREE.Vector3(0, -5, 0));
                    setBookVisible(true);
                  }
                }}
              >
                <boxGeometry args={[0.3, 0.3, 0.5]} />
                <meshStandardMaterial color="red" visible={false} />
              </mesh>
            </Select>
          )}
        </Selection>
        {!isMobile() && (
          <group
            visible={bookVisible}
            scale={0.2}
            position={[3, 0.85, 0]}
            rotation-x={-Math.PI / 2}
            rotation-y={Math.PI * 0.2}
            rotation-z={Math.PI / 2}
          >
            <Book />
          </group>
        )}
      </group>
    </>
  );
}

useGLTF.preload("/models/studio.glb");
