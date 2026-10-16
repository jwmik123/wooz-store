"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CatmullRomCurve3, Vector3 } from "three/webgpu";
import gsap from "gsap";
import collectionStore from "../../stores/collectionStore";
import useCameraStore, { CINEMATIC_SHOTS } from "../../stores/cameraStore";
import { prefersReducedMotion } from "../../components/ui/tokens";
import { focusPull } from "./post/focusOverride";
import { setOverlayPointsVisible } from "./interactions";
import { moosBody } from "./moos/moosBody";

/*
 * Coffee-cup cinematic (cameraStore.cinematic): loops CINEMATIC_SHOTS until the
 * store flag drops. Each cut is a real crossfade: the last frame of the shot is
 * snapshotted into #wz-cin-snap (CinematicOverlay) right after it renders and
 * faded out over the new shot, which plays one slow eased move along a
 * Catmull-Rom path with its own look ease, fov and focus pull. The DOF is
 * driven through focusPull (amount 1 = pinned focus, shallower blur).
 * On exit (unless something else took the camera) it dissolves back to a pose
 * just in front of the studio and eases into the overview.
 */

const XFADE = 1.6; // crossfade duration (s)
const XFADE_REDUCED = 2.2;
const MOOS_X = 1.85; // keep the orbit inside the side walls
const _fwd = new Vector3();
const _d = new Vector3();
const rackEase = gsap.parseEase("power2.inOut");

const portrait = () => window.innerWidth / window.innerHeight < 0.8;
const snapEl = () => document.getElementById("wz-cin-snap");

/** Resolve a shot to concrete from/to poses, path and focus points (orbit uses Moos' live spot). */
function resolveShot(s) {
  if (!s.orbit) {
    return {
      from: s.from,
      to: s.to,
      via: s.via ?? [],
      focus: s.focus,
    };
  }
  const o = s.orbit;
  const c = new Vector3(moosBody.x, 0, moosBody.z);
  const at = (a, h) =>
    new Vector3(
      Math.min(MOOS_X, Math.max(-MOOS_X, c.x + Math.sin(a) * o.radius)),
      h,
      c.z + Math.cos(a) * o.radius
    );
  const look = new Vector3(c.x, o.look, c.z);
  const chest = new Vector3(c.x, -0.75, c.z);
  const mid = (o.angle[0] + o.angle[1]) / 2;
  return {
    from: { position: at(o.angle[0], o.height[0]), target: look.clone() },
    to: { position: at(o.angle[1], o.height[1]), target: look.clone().setY(o.look + 0.12) },
    via: [at(mid, (o.height[0] + o.height[1]) / 2)],
    focus: [chest, chest],
  };
}

export default function useCinematicReel(position, target, animating) {
  const camera = useThree((s) => s.camera);
  const live = useRef(null); // { focusFrom, focusTo, fovFrom, fovTo, k }
  const baseFov = useRef(null);
  // Crossfade: a callback run right after the next frame has rendered
  // (priority 2 > the post pipeline's 1), once its pixels are frozen in #wz-cin-snap.
  const snapRequest = useRef(null);

  useFrame(({ gl }) => {
    const cb = snapRequest.current;
    if (!cb) return;
    snapRequest.current = null;
    const el = snapEl();
    if (el) {
      const src = gl.domElement;
      if (el.width !== src.width || el.height !== src.height) {
        el.width = src.width;
        el.height = src.height;
      }
      el.getContext("2d").drawImage(src, 0, 0);
      gsap.killTweensOf(el);
      el.style.opacity = "1";
    }
    cb(el);
  }, 2);

  useEffect(() => {
    const timelines = new Set();
    let index = 0;

    const stop = () => {
      timelines.forEach((t) => t.kill());
      timelines.clear();
      snapRequest.current = null;
    };

    const playShot = (first) => {
      const reduced = prefersReducedMotion();
      const n = CINEMATIC_SHOTS.length;
      const i = index % n;
      const s = CINEMATIC_SHOTS[i];
      const r = resolveShot(s);
      const wide = portrait() ? 1.32 : 1;
      const p = { t: 0 };
      const path = new CatmullRomCurve3(
        [r.from.position, ...r.via, r.to.position].map((x) => x.clone()),
        false,
        "centripetal"
      );
      const lookEase = gsap.parseEase("sine.inOut");
      const state = {
        focusFrom: r.focus[0],
        focusTo: r.focus[1],
        fovFrom: Math.min(85, s.fov[0] * wide),
        fovTo: Math.min(85, s.fov[1] * wide),
        k: 0,
      };
      const apply = () => {
        // Reduced motion: a static frame at the end pose, a slow crossfade between shots.
        const t = reduced ? 1 : p.t;
        path.getPointAt(t, position.current);
        target.current.lerpVectors(r.from.target, r.to.target, reduced ? 1 : lookEase(t));
        state.k = reduced ? 1 : t;
      };

      // Freeze the current frame, cut underneath it, fade the freeze away.
      snapRequest.current = (el) => {
        timelines.forEach((t) => t.kill());
        timelines.clear();
        animating.current = true;
        live.current = state;
        apply();
        useCameraStore.setState({ cinematicShot: i });
        if (el)
          gsap.to(el, {
            opacity: 0,
            duration: reduced ? XFADE_REDUCED : XFADE,
            ease: "sine.inOut",
          });
        const tl = gsap.timeline({ onComplete: () => timelines.delete(tl) });
        timelines.add(tl);
        tl.to(p, { t: 1, duration: s.duration, ease: "power1.inOut", onUpdate: apply });
        // Cut a beat before the move fully settles, so it never feels static.
        tl.add(() => {
          index++;
          playShot(false);
        }, ">-0.4");
      };
    };

    const enter = () => {
      index = 0;
      baseFov.current = camera.fov;
      gsap.killTweensOf(position.current);
      gsap.killTweensOf(target.current);
      setOverlayPointsVisible(false);
      gsap.to(focusPull, { amount: 1, duration: 1.2, ease: "sine.inOut", overwrite: true });
      playShot(true);
    };

    const exit = () => {
      stop();
      const store = useCameraStore.getState();
      const takenOver = store.preset !== "cinematic"; // e.g. a rack opened
      const restore = () => {
        live.current = null;
        if (baseFov.current) {
          camera.fov = baseFov.current;
          camera.updateProjectionMatrix();
        }
        gsap.to(focusPull, { amount: 0, duration: 1.4, ease: "sine.inOut", overwrite: true });
      };
      if (takenOver) {
        restore();
        const el = snapEl();
        if (el) gsap.to(el, { opacity: 0, duration: 0.5, overwrite: true });
        return;
      }
      const { introScreen } = collectionStore.getState();
      snapRequest.current = (el) => {
        restore();
        // Just in front of the open front, then the usual ease into the overview.
        position.current.set(0.5, 0.35, 7.2);
        target.current.set(0, -0.2, -6);
        useCameraStore.getState().resetCamera(introScreen);
        if (!introScreen) setOverlayPointsVisible(true);
        if (el) gsap.to(el, { opacity: 0, duration: 1.2, ease: "sine.inOut" });
      };
    };

    const unsub = useCameraStore.subscribe((s, prev) => {
      if (s.cinematic === prev.cinematic) return;
      if (s.cinematic) enter();
      else exit();
    });
    return () => {
      unsub();
      stop();
    };
  }, [camera, position, target, animating]);

  // Per frame: fov and the focus pull (focus = subject depth along the view).
  useFrame(() => {
    const s = live.current;
    if (!s) return;
    const fov = s.fovFrom + (s.fovTo - s.fovFrom) * s.k;
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
    _d.lerpVectors(s.focusFrom, s.focusTo, rackEase(s.k));
    camera.getWorldDirection(_fwd);
    focusPull.distance = Math.max(0.3, _fwd.dot(_d.sub(camera.position)));
  });
}
