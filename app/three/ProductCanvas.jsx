"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { Canvas } from "@react-three/fiber";
import Product from "./Product";
import { PCFShadowMap } from "three/webgpu";
import { createRenderer } from "./v2/renderer";

// R3F turns `shadows={false}` into type = PCFSoftShadowMap, which WebGPURenderer
// no longer has (console warning); keep shadows off with a supported type.
const NO_SHADOWS = { enabled: false, type: PCFShadowMap };

/**
 * Sidebar 3D product viewer (WiggleBone garment). Client-only, lazy-loaded.
 *
 * Second WebGPU canvas on the page, so it only renders while `active`
 * (sidebar open, 3D mode, product tab visible) AND on screen
 * (IntersectionObserver). Otherwise frameloop = "never".
 */
export default function ProductCanvas({
  productHandle,
  selectedColor,
  active = true,
  onInteract,
  onReady,
  reducedMotion,
}) {
  const wrapRef = useRef(null);
  const [onScreen, setOnScreen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.matchMedia("(max-width: 767px)").matches);
    const el = wrapRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      { threshold: 0.01 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = active && onScreen;

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <Canvas
        className="wz-product-canvas !absolute inset-0"
        frameloop={running ? "always" : "never"}
        shadows={NO_SHADOWS}
        dpr={isMobile ? [1, 1.5] : [1, 1.75]}
        camera={{ position: [0, 0.18, 4], fov: 30 }}
        gl={createRenderer}
        onCreated={({ camera }) => {
          camera.lookAt(0, 0, 0);
          // give the first frames a moment before revealing
          setTimeout(() => onReady?.(), 120);
        }}
      >
        <Suspense fallback={null}>
          <Product
            productHandle={productHandle}
            selectedColor={selectedColor}
            onInteract={onInteract}
            reducedMotion={reducedMotion}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
