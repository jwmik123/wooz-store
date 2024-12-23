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
    "Dark grey/Taupe": "/assets/hoodie/Hoodie_DarkGrey.jpg",
    "Sage Green": "/assets/hoodie/Hoodie_Green.jpg",
    "Light Grey Melange": "/assets/hoodie/Hoodie_Grey.jpg",
    Black: "/assets/hoodie/Hoodie_Black.jpg",
  };

  const splatterColorTextureMap = {
    Blue: "/assets/splatter/Splatter_Blue.jpg",
    White: "/assets/splatter/Splatter_White.jpg",
    Green: "/assets/splatter/Splatter_Green.jpg",
  };

  const poloColorTextureMap = {
    White: "/assets/polo/Polo_White.jpg",
    Black: "/assets/polo/Polo_Black.jpg",
    "Ice Blue": "/assets/polo/Polo_LightBlue.jpg",
    Navy: "/assets/polo/Polo_DarkBlue.jpg",
    Green: "/assets/polo/Polo_Green.jpg",
    "Light Grey Melange": "/assets/polo/Polo_Grey.jpg",
  };

  const longsleeveColorTextureMap = {
    White: "/assets/longsleeve/Longsleeve_White.jpg",
    Black: "/assets/longsleeve/Longsleeve_Black.jpg",
    Brown: "/assets/longsleeve/Longsleeve_Brown.jpg",
    Green: "/assets/longsleeve/Longsleeve_Green.jpg",
    Blue: "/assets/longsleeve/Longsleeve_Blue.jpg",
  };

  const [textureUrl, setTextureUrl] = useState("/assets/transparent_image.png");

  useEffect(() => {
    if (productHandle === "hoodie") {
      setTimeout(() => {
        setTextureUrl(
          hoodieColorTextureMap[selectedColor] ||
            "/assets/hoodie/Hoodie_DarkGrey.jpg"
        );
      }, 500);
    } else if (productHandle === "splatter") {
      setTimeout(() => {
        setTextureUrl(
          splatterColorTextureMap[selectedColor] ||
            "/assets/splatter/Splatter_White.jpg"
        );
      }, 500);
    } else if (productHandle === "polo") {
      setTimeout(() => {
        setTextureUrl(
          poloColorTextureMap[selectedColor] || "/assets/polo/Polo_White.jpg"
        );
      }, 500);
    } else if (productHandle === "longsleeve") {
      setTimeout(() => {
        setTextureUrl(
          longsleeveColorTextureMap[selectedColor] ||
            "/assets/longsleeve/Longsleeve_White.jpg"
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

    // Cleanup for remounting
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
useGLTF.preload("/models/hoodie.glb");
useGLTF.preload("/models/splatter.glb");
useGLTF.preload("/models/polo.glb");
