import { create } from "zustand";
import * as THREE from "three";
import useSoundStore from "./soundStore";

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
  moos: {
    position: new THREE.Vector3(-0.12, -0.66, 3.55),
    target: new THREE.Vector3(-1.17, -1.05, 0.89),
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

/** Starting pose of the intro reveal (CameraRig holds it while the loader is up). */
export const getIntroStart = () =>
  CAMERA_POSITIONS[isPortrait() ? "introPortraitStart" : "introStart"];

const useCameraStore = create((set) => ({
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

  setCinematic: (cinematic) => {
    set({ cinematic: cinematic });
  },

  // Combined method to set both position and target
  updateCameraConfig: (type) => {
    useSoundStore.getState().playSound("swoosh");
    const config = CAMERA_POSITIONS[type] || CAMERA_POSITIONS.default;
    set({
      targetCameraPosition: new THREE.Vector3().copy(config.position),
      targetCameraTarget: new THREE.Vector3().copy(config.target),
      targetFocus: config.focus ? new THREE.Vector3().copy(config.focus) : null,
      preset: CAMERA_POSITIONS[type] ? type : "default",
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
