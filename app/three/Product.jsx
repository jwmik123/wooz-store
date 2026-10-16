"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { WiggleBone } from "wiggle/spring";
import * as THREE from "three";

// Colourway -> baked texture per garment.
const TEXTURES = {
  hoodie: {
    "Dark grey/Taupe": "/assets/hoodie/hoodie_darkgrey.jpg",
    "Sage Green": "/assets/hoodie/hoodie_green.jpg",
    "Light Grey": "/assets/hoodie/hoodie_grey.jpg",
    Black: "/assets/hoodie/hoodie_black.jpg",
  },
  splatter: {
    "Sky Blue": "/assets/splatter/splatter_blue.jpg",
    White: "/assets/splatter/splatter_white.jpg",
    "Foam Green": "/assets/splatter/splatter_green.jpg",
  },
  polo: {
    White: "/assets/polo/polo_white.jpg",
    Black: "/assets/polo/polo_black.jpg",
    "Ice Blue": "/assets/polo/polo_lightblue.jpg",
    Navy: "/assets/polo/polo_darkblue.jpg",
    Green: "/assets/polo/polo_green.jpg",
    "Light Grey Melange": "/assets/polo/polo_grey.jpg",
  },
  longsleeve: {
    White: "/assets/longsleeve/longsleeve_white.jpg",
    Black: "/assets/longsleeve/longsleeve_black.jpg",
    Brown: "/assets/longsleeve/longsleeve_brown.jpg",
    Green: "/assets/longsleeve/longsleeve_green.jpg",
    Blue: "/assets/longsleeve/longsleeve_blue.jpg",
  },
  totebag: { Beige: "/assets/totebag/totebag.jpg" },
};

const DEFAULT_TEXTURE = {
  hoodie: "/assets/hoodie/hoodie_black.jpg",
  splatter: "/assets/splatter/splatter_blue.jpg",
  polo: "/assets/polo/polo_black.jpg",
  longsleeve: "/assets/longsleeve/longsleeve_black.jpg",
  totebag: "/assets/totebag/totebag.jpg",
};

const WIGGLE_BONES = {
  totebag: ["Bone001", "Bone002", "Bone003", "Bone004"],
  default: ["spine001", "upper_armL", "upper_armR", "lower_armL", "lower_armR"],
};

// Framing (camera: z=4, fov 30 → ~2.14 world units visible vertically).
const FIT_HEIGHT = 1.34;
const FIT_WIDTH = 1.62;
const IDLE_SPEED = 0.28; // rad/s slow showroom turn
const IDLE_DELAY = 2.2; // s after the last interaction

export const textureFor = (handle, color) =>
  TEXTURES[handle]?.[color] || DEFAULT_TEXTURE[handle] || DEFAULT_TEXTURE.hoodie;

/** Soft radial blob used as a contact shadow (no extra render pass). */
function useShadowTexture() {
  return useMemo(() => {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d");
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, "rgba(27,51,39,0.55)");
    g.addColorStop(0.45, "rgba(27,51,39,0.22)");
    g.addColorStop(1, "rgba(27,51,39,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
}

export default function Product({
  productHandle,
  selectedColor,
  onInteract,
  reducedMotion = false,
}) {
  const handle = productHandle || "hoodie";
  const { scene: gltfScene, nodes } = useGLTF(`/models/${handle}.glb`);
  const texture = useLoader(THREE.TextureLoader, textureFor(handle, selectedColor));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.flipY = false;
  texture.anisotropy = 4;

  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);

  const fitRef = useRef();
  const floatRef = useRef();
  const shadowRef = useRef();
  const shadowTex = useShadowTexture();

  const wiggleBones = useRef([]);
  const material = useRef(null);
  const ctrl = useRef({
    yaw: 0,
    velocity: 0,
    dragging: false,
    lastX: 0,
    lastT: 0,
    idleAt: 0,
    lift: 1,
  });

  // Preload the other colourways of this garment so swatch clicks never suspend.
  useEffect(() => {
    Object.values(TEXTURES[handle] || {}).forEach((url) =>
      useLoader.preload(THREE.TextureLoader, url)
    );
  }, [handle]);

  // Fit any garment into the same frame regardless of its authored scale.
  const fit = useMemo(() => {
    // Measure in the garment's own space (it may already sit in a scaled group).
    const parent = gltfScene.parent;
    if (parent) parent.remove(gltfScene);
    const yaw = nodes.root ? nodes.root.rotation.y : 0;
    if (nodes.root) nodes.root.rotation.y = 0;
    gltfScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(gltfScene);
    if (nodes.root) nodes.root.rotation.y = yaw;
    if (parent) parent.add(gltfScene);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const s = Math.min(FIT_HEIGHT / size.y, FIT_WIDTH / Math.max(size.x, size.z));
    return {
      scale: s,
      position: [-center.x * s, -center.y * s - 0.02, -center.z * s],
      bottom: -size.y * s * 0.5 - 0.02,
    };
  }, [gltfScene, nodes]);

  // One fabric material per garment, texture swapped in place.
  useEffect(() => {
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      side: THREE.DoubleSide,
      roughness: 0.92,
      metalness: 0,
    });
    material.current = mat;
    gltfScene.traverse((child) => {
      if (child.isMesh) {
        child.material = mat;
        child.frustumCulled = false;
      }
    });
    return () => mat.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltfScene]);

  useEffect(() => {
    if (material.current && material.current.map !== texture) {
      material.current.map = texture;
      material.current.needsUpdate = true;
      invalidate();
    }
  }, [texture, invalidate]);

  // WiggleBone physics — the playful jiggle when the garment moves.
  useEffect(() => {
    const names = WIGGLE_BONES[handle] || WIGGLE_BONES.default;
    wiggleBones.current = names
      .map((n) => nodes[n])
      .filter(Boolean)
      .map((bone) => new WiggleBone(bone, { stiffness: 200, damping: 20 }));
    ctrl.current.yaw = 0;
    ctrl.current.velocity = 0;
    if (nodes.root) nodes.root.rotation.y = 0;
    return () => {
      wiggleBones.current.forEach((wb) => wb?.dispose?.());
      wiggleBones.current = [];
    };
  }, [nodes, handle]);

  // A playful full turn whenever the colourway changes (not on first mount).
  const firstColor = useRef(true);
  useEffect(() => {
    if (firstColor.current) {
      firstColor.current = false;
      return;
    }
    if (!reducedMotion) ctrl.current.velocity += 9;
    ctrl.current.idleAt = performance.now() / 1000;
  }, [selectedColor, reducedMotion]);

  // Drag-to-spin with inertia, bound to the canvas element (pointer capture
  // keeps the drag alive outside the canvas). `touch-action: pan-y` on the
  // canvas lets vertical swipes still scroll the sidebar on touch devices.
  useEffect(() => {
    const el = gl.domElement;
    const c = ctrl.current;
    const now = () => performance.now() / 1000;

    const down = (e) => {
      if (e.button !== undefined && e.button !== 0) return;
      c.dragging = true;
      c.lastX = e.clientX;
      c.lastT = now();
      c.velocity = 0;
      el.setPointerCapture?.(e.pointerId);
      el.dataset.dragging = "true";
      onInteract?.();
      invalidate();
    };
    const move = (e) => {
      if (!c.dragging) return;
      const t = now();
      const dx = e.clientX - c.lastX;
      const dt = Math.max(t - c.lastT, 1 / 240);
      const rad = (dx / Math.max(el.clientWidth, 1)) * Math.PI * 1.6;
      c.yaw += rad;
      c.velocity = THREE.MathUtils.lerp(c.velocity, rad / dt, 0.5);
      c.lastX = e.clientX;
      c.lastT = t;
      invalidate();
    };
    const up = (e) => {
      if (!c.dragging) return;
      c.dragging = false;
      c.idleAt = now();
      if (now() - c.lastT > 0.08) c.velocity = 0; // held still before release
      c.velocity = THREE.MathUtils.clamp(c.velocity, -14, 14);
      el.releasePointerCapture?.(e.pointerId);
      delete el.dataset.dragging;
    };
    const key = (e) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      // Keyboard spin when the canvas is focused; don't switch collections.
      e.preventDefault();
      e.stopPropagation();
      c.velocity += e.key === "ArrowLeft" ? -5 : 5;
      c.idleAt = now();
      onInteract?.();
      invalidate();
    };

    el.style.touchAction = "pan-y";
    el.tabIndex = 0;
    el.setAttribute("role", "img");
    el.setAttribute(
      "aria-label",
      "3D product preview. Drag, or use the arrow keys, to spin it."
    );
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    el.addEventListener("keydown", key);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
      el.removeEventListener("keydown", key);
    };
  }, [gl, invalidate, onInteract]);

  const sign = handle === "totebag" ? -1 : 1;

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20);
    const c = ctrl.current;
    const t = state.clock.elapsedTime;

    if (!c.dragging) {
      c.yaw += c.velocity * dt;
      c.velocity *= Math.exp(-dt * 3.2);
      const idle = performance.now() / 1000 - c.idleAt > IDLE_DELAY;
      if (idle && !reducedMotion) c.yaw += IDLE_SPEED * dt;
    }

    if (nodes.root) {
      const k = 1 - Math.exp(-dt * 9);
      nodes.root.rotation.y += (sign * c.yaw - nodes.root.rotation.y) * k;
    }

    // Float + lift on grab.
    c.lift = THREE.MathUtils.damp(c.lift, c.dragging ? 1.045 : 1, 10, dt);
    const bob = reducedMotion ? 0 : Math.sin(t * 1.1) * 0.022;
    if (floatRef.current) {
      floatRef.current.position.y = bob;
      floatRef.current.scale.setScalar(c.lift);
    }
    if (shadowRef.current) {
      const s = 1 - bob * 4 - (c.lift - 1) * 2.5;
      shadowRef.current.scale.set(s, s, 1);
      shadowRef.current.material.opacity = 0.75 * s;
    }

    wiggleBones.current.forEach((wb) => wb?.update?.());
  });

  return (
    <group>
      {/* Soft studio: sky/ground hemisphere + warm key + cool rim + fill */}
      <hemisphereLight args={["#fffaf0", "#cdd9cf", 1.6]} />
      <directionalLight position={[-2.2, 3, 3]} intensity={2.2} color="#fff4e6" />
      <directionalLight position={[2.5, 1.5, -2.5]} intensity={1.6} color="#dbe9ff" />
      <directionalLight position={[2, -0.5, 2]} intensity={0.45} color="#ffffff" />

      <group ref={floatRef}>
        <group ref={fitRef} position={fit.position} scale={fit.scale}>
          <primitive object={gltfScene} />
        </group>
      </group>

      <mesh
        ref={shadowRef}
        position={[0, fit.bottom - 0.12, -0.45]}
        renderOrder={-1}
      >
        <planeGeometry args={[1.3, 0.2]} />
        <meshBasicMaterial
          map={shadowTex}
          transparent
          depthWrite={false}
          opacity={0.75}
        />
      </mesh>
    </group>
  );
}

Object.values(DEFAULT_TEXTURE).forEach((url) =>
  useLoader.preload(THREE.TextureLoader, url)
);
useGLTF.preload("/models/hoodie.glb");
useGLTF.preload("/models/splatter.glb");
useGLTF.preload("/models/polo.glb");
useGLTF.preload("/models/longsleeve.glb");
useGLTF.preload("/models/totebag.glb");
