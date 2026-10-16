"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Vector3 } from "three/webgpu";
import gsap from "gsap";
import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";
import useMoosStore from "../../stores/moosStore";
import { setOverlayPointsVisible } from "./interactions";

// Overlay "pulsing dot" anchors in WORLD coordinates (.point-N elements in Overlay.jsx).
const POINTS = [
  [0, -1, -3],
  [-1.2, -1, -1.8],
  [1.1, -1, -1.8],
  [1.55, -1, -0.4],
  [0.6, -1.1, 1.7],
  [0, -1.1, 1.7],
  [-0.5, -1.18, 1.5],
].map((p) => new Vector3(...p));

const DEFAULT_POSITION = new Vector3(0, 0, 5);
const TWEEN = { duration: 1.5, ease: "power2.out", overwrite: true };

function getDeviceOffset() {
  if (!/iPhone/.test(navigator.userAgent)) return 0;
  if (/Instagram|LinkedIn|Twitter/.test(navigator.userAgent)) return 0;

  const { width, height } = window.screen;
  const screenHeight = Math.max(width, height);
  const screenWidth = Math.min(width, height);
  const iOSVersion = parseInt((navigator.userAgent.match(/OS (\d+)_/i) || [])[1]);

  if (screenHeight === 844 && screenWidth === 390) return iOSVersion >= 17 ? 70 : 0;
  return screenHeight > 850 ? 70 : 0;
}

/**
 * Drives the camera from cameraStore (gsap tween per change, not per frame),
 * adds a subtle mouse parallax at the default view, and projects the HTML
 * overlay points. OrbitControls are interactive only in #debug.
 */
/**
 * Where the camera rests when no rack is open: Moos while his chat is open
 * (framed with room for the panel), otherwise the overview / intro shot.
 */
function restCamera(isMobile) {
  const camera = useCameraStore.getState();
  const { introScreen } = collectionStore.getState();
  if (!introScreen && useMoosStore.getState().open)
    camera.updateCameraConfig(isMobile ? "moosMobile" : "moos");
  else camera.resetCamera(introScreen);
}

export default function CameraRig({ debug, isMobile = false }) {
  const controls = useRef();
  const position = useRef(new Vector3(0, 1, 20));
  const target = useRef(new Vector3());
  const animating = useRef(true);
  const mouse = useRef({ x: 0, y: 0 });
  const parallax = useRef(new Vector3());
  const points = useRef([]);

  const sidebarOpen = collectionStore((s) => s.sidebarOpen);
  const introScreen = collectionStore((s) => s.introScreen);

  // Tween towards the store targets whenever they change.
  useEffect(() => {
    const tweenTo = (from, to) => {
      animating.current = true;
      gsap.to(from, {
        x: to.x,
        y: to.y,
        z: to.z,
        ...TWEEN,
        onComplete: () => (animating.current = false),
      });
    };
    return useCameraStore.subscribe((state, prev) => {
      if (state.targetCameraPosition !== prev.targetCameraPosition)
        tweenTo(position.current, state.targetCameraPosition);
      if (state.targetCameraTarget !== prev.targetCameraTarget)
        tweenTo(target.current, state.targetCameraTarget);
    });
  }, []);

  // Back to the rest shot whenever the sidebar closes or the intro is dismissed.
  useEffect(() => {
    if (!sidebarOpen) {
      restCamera(isMobile);
      // Hotspot dots only once inside (they clutter the intro shot).
      setOverlayPointsVisible(!introScreen);
    }
  }, [sidebarOpen, introScreen, isMobile]);

  // Moos chat: dolly to him when it opens, back to the overview when it closes.
  // A rack (sidebar), the cinematic shot or the lookbook keep the camera.
  useEffect(
    () =>
      useMoosStore.subscribe((s, prev) => {
        if (s.open === prev.open) return;
        const { sidebarOpen: shop, introScreen: intro, bookVisible } =
          collectionStore.getState();
        const { preset, cinematic } = useCameraStore.getState();
        if (shop || intro || bookVisible || cinematic) return;
        if (s.open) restCamera(isMobile);
        else if (preset === "moos" || preset === "moosMobile") restCamera(isMobile);
      }),
    [isMobile]
  );

  useEffect(() => {
    const onMove = (e) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onKey = (e) => {
      if (e.key === "Escape") collectionStore.getState().setSidebarOpen(false);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    points.current = POINTS.map((p, i) => ({
      position: p,
      element: document.querySelector(`.point-${i}`),
    }));
    const t = setTimeout(
      () => setOverlayPointsVisible(!collectionStore.getState().introScreen),
      1000
    );
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, []);

  const projected = useRef(new Vector3());

  useFrame(({ camera }, delta) => {
    const c = controls.current;
    if (c && (!debug || animating.current)) {
      // Subtle parallax only at the overview position.
      const atOverview = position.current.distanceTo(DEFAULT_POSITION) < 0.01;
      const k = 1 - Math.exp(-delta * 4);
      parallax.current.lerp(
        atOverview
          ? projected.current.set(mouse.current.x * 0.2, mouse.current.y * 0.1, 0)
          : projected.current.set(0, 0, 0),
        k
      );
      camera.position.copy(position.current);
      c.target.copy(target.current).add(parallax.current);
      c.update();
    }

    const viewport = window.visualViewport;
    const w = viewport?.width || window.innerWidth;
    const h = viewport?.height || window.innerHeight;
    const offset = getDeviceOffset();
    for (const point of points.current) {
      if (!point.element) continue;
      projected.current.copy(point.position).project(camera);
      const x = (projected.current.x * w) / 2;
      const y = -(projected.current.y * h) / 2 + offset;
      point.element.style.transform = `translateX(${x}px) translateY(${y}px)`;
    }
  });

  return (
    <OrbitControls
      ref={controls}
      enableZoom={debug}
      enablePan={debug}
      enableRotate={debug}
    />
  );
}
