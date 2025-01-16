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
    position: new THREE.Vector3(0, 0, 20),
    target: new THREE.Vector3(0, 0, 0),
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

  // Methods
  setCameraPosition: (position) => {
    useSoundStore.getState().playSound("swoosh");
    set({ targetCameraPosition: new THREE.Vector3().copy(position) });
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
    });
  },
}));

export default useCameraStore;
