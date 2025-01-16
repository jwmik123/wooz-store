"use client";
import React, { useRef, useEffect, useState, useMemo } from "react";
import { useFrame, useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { WiggleBone } from "wiggle/spring";
import * as THREE from "three";
import collectionStore from "../stores/collectionStore";
import gsap from "gsap";

export default function Product({ selectedColor }) {
  const productHandle = collectionStore((state) => state.productHandle);
  const { scene: gltfScene, nodes } = useGLTF(`/models/${productHandle}.glb`);
  const wiggleBones = useRef([]);
  const targetRotation = useRef(new THREE.Euler());
  const currentRotation = useRef(new THREE.Euler());

  const [hovered, setHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const meshRef = useRef();
  const controlCubeRef = useRef();
  const previousMouseX = useRef(0);
  const modelSize = useRef(new THREE.Vector3());

  const hoodieColorTextureMap = {
    "Dark grey/Taupe": "/assets/hoodie/hoodie_darkgrey.jpg",
    "Sage Green": "/assets/hoodie/hoodie_green.jpg",
    "Light Grey Melange": "/assets/hoodie/hoodie_grey.jpg",
    Black: "/assets/hoodie/hoodie_black.jpg",
  };

  const splatterColorTextureMap = {
    Blue: "/assets/splatter/splatter_blue.jpg",
    White: "/assets/splatter/splatter_white.jpg",
    Green: "/assets/splatter/splatter_green.jpg",
  };

  const poloColorTextureMap = {
    White: "/assets/polo/polo_white.jpg",
    Black: "/assets/polo/polo_black.jpg",
    "Ice Blue": "/assets/polo/polo_lightblue.jpg",
    Navy: "/assets/polo/polo_darkblue.jpg",
    Green: "/assets/polo/polo_green.jpg",
    "Light Grey Melange": "/assets/polo/polo_grey.jpg",
  };

  const longsleeveColorTextureMap = {
    White: "/assets/longsleeve/longsleeve_white.jpg",
    Black: "/assets/longsleeve/longsleeve_black.jpg",
    Brown: "/assets/longsleeve/longsleeve_brown.jpg",
    Green: "/assets/longsleeve/longsleeve_green.jpg",
    Blue: "/assets/longsleeve/longsleeve_blue.jpg",
  };

  const totebagColorTextureMap = {
    Beige: "/assets/totebag/totebag.jpg",
  };

  const [textureUrl, setTextureUrl] = useState("/assets/transparent_image.png");

  useEffect(() => {
    if (productHandle === "hoodie") {
      setTimeout(() => {
        setTextureUrl(
          hoodieColorTextureMap[selectedColor] ||
            "/assets/hoodie/hoodie_black.jpg"
        );
      }, 500);
    } else if (productHandle === "splatter") {
      setTimeout(() => {
        setTextureUrl(
          splatterColorTextureMap[selectedColor] ||
            "/assets/splatter/splatter_blue.jpg"
        );
      }, 500);
    } else if (productHandle === "polo") {
      setTimeout(() => {
        setTextureUrl(
          poloColorTextureMap[selectedColor] || "/assets/polo/polo_black.jpg"
        );
      }, 500);
    } else if (productHandle === "longsleeve") {
      setTimeout(() => {
        setTextureUrl(
          longsleeveColorTextureMap[selectedColor] ||
            "/assets/longsleeve/longsleeve_black.jpg"
        );
      }, 500);
    } else if (productHandle === "totebag") {
      setTimeout(() => {
        setTextureUrl(
          totebagColorTextureMap[selectedColor] || "/assets/totebag/totebag.jpg"
        );
      }, 500);
    }
  }, [selectedColor, productHandle]);

  useEffect(() => {
    setIsVisible(false);
    setTimeout(() => {
      setIsVisible(true);
    }, 500);
  }, [productHandle]);

  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    setIsMobileView(
      /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      )
    );
  }, []);

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

    let bones;
    if (productHandle === "totebag") {
      bones = [
        nodes["Bone001"],
        nodes["Bone002"],
        nodes["Bone003"],
        nodes["Bone004"],
      ];
    } else {
      bones = [
        nodes["spine001"],
        nodes["upper_armL"],
        nodes["upper_armR"],
        nodes["lower_armL"],
        nodes["lower_armR"],
      ];
    }
    if (productHandle === "totebag") {
      wiggleBones.current = bones.map(
        (bone) => new WiggleBone(bone, { stiffness: 200, damping: 20 })
      );
    } else {
      wiggleBones.current = bones.map(
        (bone) => new WiggleBone(bone, { stiffness: 200, damping: 20 })
      );
    }

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

  useFrame(() => {
    if (!isSimulating) return;

    wiggleBones.current.forEach((wb) => {
      if (wb && wb.update) wb.update();
    });

    if (nodes.root && controlCubeRef.current) {
      if (productHandle === "totebag") {
        nodes.root.rotation.y = THREE.MathUtils.lerp(
          nodes.root.rotation.y,
          -controlCubeRef.current.rotation.y,
          0.1
        );
      } else {
        nodes.root.rotation.y = THREE.MathUtils.lerp(
          nodes.root.rotation.y,
          controlCubeRef.current.rotation.y,
          0.1
        );
      }
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
      const rotationSpeed = isMobileView ? 0.04 : 0.015;
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
      <directionalLight position={[1, 1, 1]} intensity={2} />
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
      <primitive
        position={[0, -1.3, 0]}
        object={gltfScene}
        ref={meshRef}
        visible={isVisible}
      />
    </group>
  );
}
useGLTF.preload("/models/hoodie.glb");
useGLTF.preload("/models/splatter.glb");
useGLTF.preload("/models/polo.glb");
useGLTF.preload("/models/longsleeve.glb");
useGLTF.preload("/models/totebag.glb");
