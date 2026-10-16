import { Vector3 } from "three/webgpu";
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

/**
 * What clicking a table piece does (Hotspots.jsx hit boxes + the floating
 * badges in signs/Badges.jsx): coffee cup -> cinematic reel, lookbook -> open
 * the book, totebag -> its shop panel.
 */
export function openTablePiece(key) {
  setPointerCursor(false);
  if (key === "coffee") {
    useCameraStore.getState().setCinematic(true);
  } else if (key === "lookbook") {
    if (collectionStore.getState().bookVisible) return;
    const camera = useCameraStore.getState();
    camera.setCameraPosition(new Vector3(0, -0.5, 1.9));
    camera.setCameraTarget(new Vector3(0, -5, 0));
    collectionStore.getState().setBookVisible(true);
  } else {
    openCollection(key);
  }
}
