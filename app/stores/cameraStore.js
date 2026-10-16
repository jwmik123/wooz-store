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
    // Slightly raised (garden ws8) so the studio reads above the front fence.
    position: new THREE.Vector3(0, 0.7, 20),
    target: new THREE.Vector3(0, -0.35, 0),
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
    position: new THREE.Vector3(0.4, -0.4, 5.2),
    target: new THREE.Vector3(-0.82, -2.65, 1.85),
    focus: new THREE.Vector3(-0.82, -0.75, 1.85),
  },
  lookbook: {
    position: new THREE.Vector3(1, 0, 2),
    target: new THREE.Vector3(1, -5, 0),
  },
};

const useCameraStore = create((set) => ({
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
    const config = isIntroScreen
      ? CAMERA_POSITIONS.intro
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
