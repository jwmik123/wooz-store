import { create } from "zustand";
import * as THREE from "three";
import useSoundStore from "./soundStore";
import { MOOS_HOME, MOOS_HOME_MOBILE, moosBody } from "../three/v2/moos/moosBody";

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
    target: new THREE.Vector3(0, 0, -10),
  },
  totebag: {
    position: new THREE.Vector3(1, 0, 2),
    target: new THREE.Vector3(1, -5, 0),
  },
  intro: {
    // 3/4 view from the front-right, the greenhouse as the hero (≈ 40 % of the
    // frame height, ridge just below the title), the two apple trees framing
    // it left and right and the path leading in from the bottom.
    position: new THREE.Vector3(2.2, 1.0, 13.5),
    target: new THREE.Vector3(-0.3, 0.02, 0),
  },
  // Portrait screens (fov 75): straighter on, the path runs up to the gate.
  introPortrait: {
    position: new THREE.Vector3(1.2, 0.2, 15),
    target: new THREE.Vector3(0, -0.7, 0),
  },
  // Where the intro reveal starts (loader → intro): higher, farther and tilted
  // up into the sky, so the loader's sky dissolves into the real one before the
  // crane settles down onto the garden.
  introStart: {
    position: new THREE.Vector3(5.2, 5.0, 23),
    target: new THREE.Vector3(-0.4, 3.2, 0),
  },
  introPortraitStart: {
    position: new THREE.Vector3(2.8, 4.6, 24),
    target: new THREE.Vector3(0, 2.6, 0),
  },
  // Chat with Moos (CameraRig): frame him left of centre, room for the chat
  // panel on the right. `focus` = where the depth of field focuses (his chest).
  // Authored with Moos at his home spot; moosShot() moves the shot with him
  // (he strolls around the studio, see app/three/v2/moos/locomotion.js).
  // Chat panel opens on the LEFT (next to Moos), so he sits right of centre.
  moos: {
    position: new THREE.Vector3(-0.12, -0.66, 3.55),
    target: new THREE.Vector3(-2.03, -1.05, 1.42),
    focus: new THREE.Vector3(-1.6, -0.75, 1.15),
  },
  // Phones: the chat is a bottom sheet, so Moos sits in the top third.
  moosMobile: {
    position: new THREE.Vector3(0.9, 0.1, 6.5),
    target: new THREE.Vector3(-0.82, -3.4, 1.85),
    focus: new THREE.Vector3(-0.82, -0.75, 1.85),
  },
  lookbook: {
    position: new THREE.Vector3(1, 0, 2),
    target: new THREE.Vector3(1, -5, 0),
  },
};

const isPortrait = () =>
  typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8;

/*
 * Intro choreography (CameraRig plays a `move`: one gsap tween along a
 * centripetal Catmull-Rom path through `via`, the look target eased separately).
 *   reveal  loader → intro shot: a slow crane down out of the sky.
 *   enter   "Step inside": down the garden path and through the open front.
 */
export const INTRO_MOVES = {
  reveal: { duration: 5.6, ease: "power2.inOut", lookEase: "power2.inOut" },
  enter: { duration: 3.2, ease: "power2.inOut", lookEase: "sine.inOut", lookLead: 0.18 },
};
// Garden path waypoints for the enter move (just above the path, centred on the door).
const ENTER_VIA = {
  landscape: [new THREE.Vector3(1.1, -0.05, 9.6)],
  portrait: [new THREE.Vector3(0.55, -0.2, 10.2)],
};

/*
 * Coffee-cup cinematic: a looping reel of slow shots (CameraRig plays them,
 * app/components/cinematic/CinematicOverlay.jsx draws the letterbox, the
 * dissolves and the credits). World coordinates; studio footprint
 * x ±2.16, floor y -1.87, open front at z +3.48, coffee cup ≈ (-0.5, -1.13, 1.5).
 *   from/to   { position, target } at the start / end of the shot
 *   via       optional Catmull-Rom waypoints for the camera
 *   focus     DOF subject [start, end] (a rack focus when they differ)
 *   fov       vertical fov [start, end] (landscape; portrait widens it)
 *   orbit     shot built around Moos' live position at the cut
 */
const v = (x, y, z) => new THREE.Vector3(x, y, z);
const shot = (from, fromT, to, toT, rest) => ({
  from: { position: v(...from), target: v(...fromT) },
  to: { position: v(...to), target: v(...toT) },
  ...rest,
});
export const CINEMATIC_SHOTS = [
  // Slow dolly along the racks, the clothes swaying in the draught.
  shot([1.35, -0.72, 0.9], [-0.7, -1.0, -2.6], [0.25, -0.82, -0.2], [-1.5, -1.05, -2.3], {
    focus: [v(-1.2, -0.95, -1.8), v(-1.2, -0.95, -1.8)],
    fov: [40, 36],
    duration: 8,
  }),
  // Low macro push past the coffee cup, focus racks from the cup to the room.
  shot([0.05, -1.02, 2.45], [-0.55, -1.12, 1.45], [-0.22, -1.06, 2.02], [-0.8, -1.05, 1.0], {
    focus: [v(-0.5, -1.1, 1.5), v(-0.9, -0.85, -0.6)],
    fov: [30, 27],
    duration: 7.5,
  }),
  // Crane / orbit around Moos.
  {
    orbit: { radius: 2.0, height: [-1.0, -0.35], angle: [0.35, 1.25], look: -0.7 },
    focus: "moos",
    fov: [36, 34],
    duration: 8.5,
  },
  // High above, down through the opened roof sash.
  shot([1.1, 3.9, 2.2], [0.1, -1.6, -0.2], [0.35, 3.25, 0.4], [-0.35, -1.7, -1.0], {
    focus: [v(0, -1.5, -0.5), v(-0.2, -1.6, -0.9)],
    fov: [46, 42],
    duration: 8,
  }),
  // Exterior: low through the grass and flowers towards the greenhouse.
  shot([-3.4, -1.78, 9.2], [0.1, -0.7, 0.4], [-2.3, -1.72, 7.3], [-0.3, -0.6, 0.6], {
    focus: [v(-2.9, -1.8, 8.2), v(-0.2, -0.6, 2.8)],
    fov: [36, 33],
    duration: 9,
  }),
  // Tracking shot down the garden path.
  shot([1.9, -1.3, 16], [0.2, -0.85, 0], [0.95, -1.38, 9.2], [0, -0.8, 0], {
    via: [v(1.45, -1.32, 12.6)],
    focus: [v(0.2, -0.7, 3.4), v(0.1, -0.7, 3.4)],
    fov: [44, 40],
    duration: 8,
  }),
  // Close on the glass, the sky sliding across the side wall.
  shot([3.6, 0.5, 2.4], [1.9, 1.35, -1.0], [3.1, 0.85, 0.3], [1.7, 1.6, -2.1], {
    focus: [v(2.16, 1.1, 0.6), v(2.16, 1.3, -0.6)],
    fov: [36, 32],
    duration: 7,
  }),
  // Wide crane past the apple tree, the greenhouse in its garden.
  shot([8.2, -0.9, 6.6], [-0.8, 0.2, -1.5], [7.0, 1.4, 8.6], [-0.6, 0.6, -1.8], {
    focus: [v(0, -0.5, 0.5), v(0, -0.4, 0.5)],
    fov: [48, 44],
    duration: 8.5,
  }),
];

/** Starting pose of the intro reveal (CameraRig holds it while the loader is up). */
export const getIntroStart = () =>
  CAMERA_POSITIONS[isPortrait() ? "introPortraitStart" : "introStart"];

// Keep the chat camera inside the studio side walls (x ±2.16 in world).
const MOOS_CAM_X = 1.85;
const UP = new THREE.Vector3(0, 1, 0);

/**
 * The 'moos' / 'moosMobile' shot for Moos' CURRENT position: the authored
 * shot translated with him; when that would put the camera through a side
 * wall the camera is clamped and the target swung around the camera so Moos
 * keeps the same place in the frame.
 */
export function moosShot(type) {
  const base = CAMERA_POSITIONS[type];
  const home = type === "moosMobile" ? MOOS_HOME_MOBILE : MOOS_HOME;
  const d = new THREE.Vector3(moosBody.x - home.x, 0, moosBody.z - home.z);
  const position = base.position.clone().add(d);
  const target = base.target.clone().add(d);
  const focus = base.focus.clone().add(d);
  const cx = THREE.MathUtils.clamp(position.x, -MOOS_CAM_X, MOOS_CAM_X);
  if (cx !== position.x) {
    const before = Math.atan2(moosBody.x - position.x, moosBody.z - position.z);
    const offset = target.clone().sub(position);
    position.x = cx;
    const after = Math.atan2(moosBody.x - position.x, moosBody.z - position.z);
    offset.applyAxisAngle(UP, after - before);
    target.copy(position).add(offset);
  }
  return { position, target, focus };
}

const isMoosShot = (type) => type === "moos" || type === "moosMobile";

const useCameraStore = create((set, get) => ({
  /** Choreographed move for CameraRig ({ name, duration, ease, via, ... }), see INTRO_MOVES. */
  move: null,

  /** Loader hand-over: crane from introStart to the intro shot. `instant` for reduced motion. */
  playIntroReveal: ({ instant = false } = {}) => {
    const config = CAMERA_POSITIONS[isPortrait() ? "introPortrait" : "intro"];
    set({
      targetCameraPosition: new THREE.Vector3().copy(config.position),
      targetCameraTarget: new THREE.Vector3().copy(config.target),
      targetFocus: null,
      preset: "intro",
      move: { name: "reveal", ...INTRO_MOVES.reveal, duration: instant ? 0 : INTRO_MOVES.reveal.duration },
    });
  },

  /** "Step inside": from the intro shot through the open front to the overview. */
  playEnter: ({ instant = false } = {}) => {
    useSoundStore.getState().playSound("swoosh");
    const config = CAMERA_POSITIONS.default;
    set({
      targetCameraPosition: new THREE.Vector3().copy(config.position),
      targetCameraTarget: new THREE.Vector3().copy(config.target),
      targetFocus: null,
      preset: "default",
      move: {
        name: "enter",
        ...INTRO_MOVES.enter,
        via: ENTER_VIA[isPortrait() ? "portrait" : "landscape"],
        duration: instant ? 0 : INTRO_MOVES.enter.duration,
      },
    });
  },

  // Camera positions
  targetCameraPosition: new THREE.Vector3(),
  targetCameraTarget: new THREE.Vector3(),
  /** Explicit DOF focus point for the current shot (null = autofocus raycast). */
  targetFocus: null,
  /** Name of the last preset (updateCameraConfig / resetCamera), null after manual moves. */
  preset: null,

  // Methods
  setCameraPosition: (position) => {
    useSoundStore.getState().playSound("swoosh");
    set({
      targetCameraPosition: new THREE.Vector3().copy(position),
      targetFocus: null,
      preset: null,
    });
  },

  setCameraTarget: (target) => {
    useSoundStore.getState().playSound("swoosh");
    set({ targetCameraTarget: new THREE.Vector3().copy(target) });
  },

  /** Coffee-cup cinematic reel (CameraRig loops CINEMATIC_SHOTS while true). */
  cinematic: false,
  /** Index of the shot on screen (-1 between runs); drives the credits overlay. */
  cinematicShot: -1,
  setCinematic: (cinematic) => {
    if (cinematic === get().cinematic) return;
    if (cinematic) set({ cinematic: true, cinematicShot: -1, preset: "cinematic", targetFocus: null });
    else set({ cinematic: false, cinematicShot: -1 });
  },

  // Combined method to set both position and target
  updateCameraConfig: (type) => {
    useSoundStore.getState().playSound("swoosh");
    const config = isMoosShot(type)
      ? moosShot(type)
      : CAMERA_POSITIONS[type] || CAMERA_POSITIONS.default;
    set({
      targetCameraPosition: new THREE.Vector3().copy(config.position),
      targetCameraTarget: new THREE.Vector3().copy(config.target),
      targetFocus: config.focus ? new THREE.Vector3().copy(config.focus) : null,
      preset: CAMERA_POSITIONS[type] ? type : "default",
    });
  },

  /** Re-aim the current Moos shot at his live position (silent; CameraRig calls it when he has moved). */
  followMoos: () => {
    const { preset } = get();
    if (!isMoosShot(preset)) return;
    const config = moosShot(preset);
    set({
      targetCameraPosition: config.position,
      targetCameraTarget: config.target,
      targetFocus: config.focus,
    });
  },

  // Reset to default or intro position based on intro screen state
  resetCamera: (isIntroScreen = false) => {
    useSoundStore.getState().playSound("swoosh");
    const portrait =
      typeof window !== "undefined" && window.innerWidth / window.innerHeight < 0.8;
    const config = isIntroScreen
      ? CAMERA_POSITIONS[portrait ? "introPortrait" : "intro"]
      : CAMERA_POSITIONS.default;
    set({
      targetCameraPosition: new THREE.Vector3().copy(config.position),
      targetCameraTarget: new THREE.Vector3().copy(config.target),
      targetFocus: null,
      preset: isIntroScreen ? "intro" : "default",
    });
  },
}));

export default useCameraStore;
