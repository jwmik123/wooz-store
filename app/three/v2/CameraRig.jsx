"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { CatmullRomCurve3, Vector3 } from "three/webgpu";
import gsap from "gsap";
import collectionStore from "../../stores/collectionStore";
import useCameraStore, { getIntroStart } from "../../stores/cameraStore";
import useLoadingStore from "../../components/loader/loadingStore";
import useMoosStore from "../../stores/moosStore";
import { setOverlayPointsVisible } from "./interactions";
import { moosBody } from "./moos/moosBody";
import useCinematicReel from "./useCinematicReel";

const DEFAULT_POSITION = new Vector3(0, 0, 5);
const TWEEN = { duration: 1.5, ease: "power2.out", overwrite: true };

/**
 * Drives the camera from cameraStore (gsap tween per change, not per frame),
 * and adds a subtle mouse parallax at the default view. OrbitControls are
 * interactive only in #debug.
 */
/**
 * Where the camera rests when no rack is open: Moos while his chat is open
 * (framed with room for the panel), otherwise the overview / intro shot.
 */
function restCamera(isMobile) {
  // The loader holds the reveal's start pose; the intro choreography moves on from there.
  if (!useLoadingStore.getState().revealed) return;
  const camera = useCameraStore.getState();
  const { introScreen } = collectionStore.getState();
  const moos = !introScreen && useMoosStore.getState().open;
  const preset = moos ? (isMobile ? "moosMobile" : "moos") : introScreen ? "intro" : "default";
  // Already there (e.g. the enter move just landed on the overview): no re-tween.
  if (camera.preset === preset) return;
  if (moos) camera.updateCameraConfig(preset);
  else camera.resetCamera(introScreen);
}

export default function CameraRig({ debug, isMobile = false }) {
  const controls = useRef();
  // Start at the intro reveal's first frame (held while the loader is up).
  const position = useRef(null);
  const target = useRef(null);
  if (!position.current) {
    const start = getIntroStart();
    position.current = new Vector3().copy(start.position);
    target.current = new Vector3().copy(start.target);
  }
  const animating = useRef(true);
  const move = useRef(null);
  const mouse = useRef({ x: 0, y: 0 });
  const parallax = useRef(new Vector3());
  // Coffee-cup cinematic: loops its shots on the same position/target refs.
  useCinematicReel(position, target, animating);

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
    // Choreographed intro moves (cameraStore INTRO_MOVES): one tween drives the
    // position along a path and the look target with its own ease.
    const playMove = (m, toPosition, toTarget) => {
      gsap.killTweensOf(position.current);
      gsap.killTweensOf(target.current);
      move.current?.kill();
      move.current = null;
      if (!m.duration) {
        position.current.copy(toPosition);
        target.current.copy(toTarget);
        animating.current = false;
        return;
      }
      const path = new CatmullRomCurve3(
        [position.current.clone(), ...(m.via ?? []).map((v) => v.clone()), toPosition.clone()],
        false,
        "centripetal"
      );
      const fromTarget = target.current.clone();
      const lookEase = gsap.parseEase(m.lookEase ?? m.ease);
      const lead = 1 + (m.lookLead ?? 0);
      const s = { t: 0 };
      animating.current = true;
      const tween = gsap.to(s, {
        t: 1,
        duration: m.duration,
        ease: m.ease,
        onUpdate: () => {
          path.getPointAt(Math.min(1, s.t), position.current);
          // Look target: own ease on linear time, slightly ahead (the head turns first).
          const lt = lookEase(Math.min(1, tween.progress() * lead));
          target.current.lerpVectors(fromTarget, toTarget, lt);
        },
        onComplete: () => {
          position.current.copy(toPosition);
          target.current.copy(toTarget);
          animating.current = false;
          move.current = null;
        },
      });
      move.current = tween;
    };
    return useCameraStore.subscribe((state, prev) => {
      if (state.move !== prev.move && state.move) {
        playMove(state.move, state.targetCameraPosition, state.targetCameraTarget);
        return;
      }
      if (state.targetCameraPosition !== prev.targetCameraPosition || state.targetCameraTarget !== prev.targetCameraTarget) {
        // Any other camera request interrupts a running intro move.
        move.current?.kill();
        move.current = null;
      }
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
      // Garment tags only once inside (they clutter the intro shot).
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
  const moosAnchor = useRef({ x: null, z: null });

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

    // Moos shot: keep following him if he is still settling (he stops and
    // turns when the chat opens; the shot was aimed where he was at the click).
    const { preset, followMoos } = useCameraStore.getState();
    const anchor = moosAnchor.current;
    if (preset === "moos" || preset === "moosMobile") {
      if (anchor.x === null) {
        anchor.x = moosBody.x;
        anchor.z = moosBody.z;
      } else if (Math.hypot(moosBody.x - anchor.x, moosBody.z - anchor.z) > 0.05) {
        anchor.x = moosBody.x;
        anchor.z = moosBody.z;
        followMoos();
      }
    } else anchor.x = null;
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
