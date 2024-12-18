"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { WiggleBone } from "wiggle/spring";
import * as THREE from "three";
import collectionStore from "../stores/collectionStore";
import gsap from "gsap";

export default function Hoodie({ selectedColor }) {
  const productHandle = collectionStore((state) => state.productHandle);
  const { scene: gltfScene, nodes } = useGLTF(`/models/${productHandle}.glb`);
  const wiggleBones = useRef([]);
  const targetRotation = useRef(new THREE.Euler());
  const currentRotation = useRef(new THREE.Euler());
  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const meshRef = useRef();
  const controlCubeRef = useRef();
  const previousMouseX = useRef(0);
  const modelSize = useRef(new THREE.Vector3());

  const hoodieColorTextureMap = {
    "Dark grey/Taupe": "/assets/hoodie_dark.jpg",
    White: "/assets/hoodie_white.jpg",
    "Sage Green": "/assets/hoodie_green.jpg",
    "Light Grey Melange": "/assets/hoodie_gray.jpg",
    Black: "/assets/hoodie_navy.jpg",
  };

  const splatterColorTextureMap = {
    Blue: "/assets/splatter_blue.png",
    White: "/assets/splatter.png",
    Green: "/assets/splatter_green.png",
  };

  const [textureUrl, setTextureUrl] = useState("/assets/transparent_image.png");

  useEffect(() => {
    if (productHandle === "hoodie") {
      setTimeout(() => {
        setTextureUrl(
          hoodieColorTextureMap[selectedColor] || "/assets/bake.png"
        );
      }, 500);
    } else if (productHandle === "splatter") {
      setTimeout(() => {
        setTextureUrl(
          splatterColorTextureMap[selectedColor] || "/assets/splatter.png"
        );
      }, 500);
    }
  }, [selectedColor, productHandle]);

  useEffect(() => {
    gsap.to(controlCubeRef.current.rotation, {
      y: controlCubeRef.current.rotation.y + Math.PI * 2,
      duration: 0.8,
      ease: "power2.inOut",
    });
  }, [selectedColor]);

  const bakedFinalTexture = useLoader(THREE.TextureLoader, textureUrl);
  bakedFinalTexture.colorSpace = THREE.SRGBColorSpace;
  bakedFinalTexture.flipY = false;

  // Initialize or cleanup physics
  useEffect(() => {
    if (!nodes) return;

    // Clear any existing bones
    wiggleBones.current.forEach((bone) => {
      if (bone && bone.dispose) bone.dispose();
    });
    wiggleBones.current = [];

    const bbox = new THREE.Box3().setFromObject(gltfScene);
    bbox.getSize(modelSize.current);

    gltfScene.traverse((child) => {
      if (child.isMesh) {
        child.material = new THREE.MeshStandardMaterial({
          map: bakedFinalTexture,
          side: THREE.DoubleSide,
          transparent: true,
        });
      }
    });

    // Create new bones
    const bones = [
      nodes["spine001"],
      nodes["upper_armL"],
      nodes["upper_armR"],
      nodes["lower_armL"],
      nodes["lower_armR"],
    ];

    wiggleBones.current = bones.map(
      (bone) => new WiggleBone(bone, { stiffness: 200, damping: 20 })
    );

    if (nodes.root) {
      currentRotation.current.copy(nodes.root.rotation);
      targetRotation.current.copy(nodes.root.rotation);
    }

    setIsSimulating(true);

    // Cleanup
    return () => {
      setIsSimulating(false);
      wiggleBones.current.forEach((bone) => {
        if (bone && bone.dispose) bone.dispose();
      });
      wiggleBones.current = [];
    };
  }, [nodes, gltfScene, bakedFinalTexture, productHandle]);

  useEffect(() => {
    document.body.style.cursor = hovered
      ? isDragging
        ? "grabbing"
        : "grab"
      : "auto";
  }, [hovered, isDragging]);

  useFrame((state, delta) => {
    if (!isSimulating) return;

    wiggleBones.current.forEach((wb) => {
      if (wb && wb.update) wb.update();
    });

    if (nodes.root && controlCubeRef.current) {
      nodes.root.rotation.y = THREE.MathUtils.lerp(
        nodes.root.rotation.y,
        controlCubeRef.current.rotation.y,
        0.1
      );
    }
  });

  const handlePointerDown = (e) => {
    e.stopPropagation();
    setIsDragging(true);
    previousMouseX.current = e.clientX;
  };

  const handlePointerMove = (e) => {
    if (isDragging && controlCubeRef.current) {
      const deltaX = e.clientX - previousMouseX.current;
      const rotationSpeed = 0.015;
      controlCubeRef.current.rotation.y += deltaX * rotationSpeed;
      previousMouseX.current = e.clientX;
    }
  };

  const handlePointerUp = () => {
    setIsDragging(false);
  };

  // Reset simulation when component remounts
  useEffect(() => {
    setIsSimulating(true);
    return () => setIsSimulating(false);
  }, []);

  return (
    <group>
      <ambientLight />
      <directionalLight position={[1, 1, 1]} intensity={4} />
      <mesh
        position={[0, -0.3, -2]}
        ref={controlCubeRef}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => {
          setHovered(false);
          setIsDragging(false);
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <sphereGeometry args={[2, 24, 24]} />
        <meshBasicMaterial visible={false} />
      </mesh>
      <primitive position={[0, -1.3, 0]} object={gltfScene} ref={meshRef} />
    </group>
  );
}
