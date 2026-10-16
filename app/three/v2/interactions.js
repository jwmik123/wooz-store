import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";
import { setSignsVisible } from "./signs/signState";

export const setPointerCursor = (on) => {
  document.body.style.cursor = on ? "pointer" : "auto";
};

/**
 * Show / hide the rack signboards (signs/Signs.jsx, fade). Kept under its
 * old name: the call sites (intro, cinematic, sidebar...) predate the signs.
 */
export const setOverlayPointsVisible = (visible) => setSignsVisible(visible);

/** Open the sidebar for a collection and fly the camera to its preset. */
export function openCollection(type) {
  const collection = collectionStore.getState();
  const camera = useCameraStore.getState();

  collection.setProductHandle(type);
  collection.setCartOpen(false);
  setOverlayPointsVisible(false);
  camera.updateCameraConfig(type);
  camera.setCinematic(false);
  setTimeout(() => collectionStore.getState().setSidebarOpen(true), 100);
}
