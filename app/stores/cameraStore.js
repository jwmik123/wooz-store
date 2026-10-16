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
    target: new THREE.Vector3(-0.3, 0.3, 0),
  },
  // Portrait screens (fov 75): straighter on, the path runs up to the gate.
  introPortrait: {
    position: new THREE.Vector3(1.2, 0.2, 15),
    target: new THREE.Vector3(0, -0.7, 0),
  },
  // Chat with Moos (CameraRig): frame him left of centre, room for the chat
  // panel on the right. `focus` = where the depth of field focuses (his chest).
  // Authored with Moos at his home spot; moosShot() moves the shot with him
  // (he strolls around the studio, see app/three/v2/moos/locomotion.js).
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
