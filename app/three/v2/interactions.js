import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";

export const setPointerCursor = (on) => {
  document.body.style.cursor = on ? "pointer" : "auto";
};

export const setOverlayPointsVisible = (visible) => {
  document.querySelectorAll(".point").forEach((point) => {
    point.classList.toggle("visible", visible);
  });
};

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
