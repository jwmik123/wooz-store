"use client";

import { useCallback, useEffect, useMemo } from "react";
import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";

export const PRODUCT_ORDER = ["splatter", "hoodie", "polo", "longsleeve", "totebag"];

/** Previous / next collection (moves the 3D camera + swaps the sidebar). */
export function useCollectionNav() {
  const productHandle = collectionStore((s) => s.productHandle);
  const index = useMemo(() => PRODUCT_ORDER.indexOf(productHandle), [productHandle]);

  const go = useCallback(
    (direction) => {
      const { sidebarOpen, setProductHandle, setSidebarOpen } =
        collectionStore.getState();
      const n = PRODUCT_ORDER.length;
      const next =
        direction === "next" ? (index + 1 + n) % n : (index - 1 + n) % n;
      const handle = PRODUCT_ORDER[next];
      setProductHandle(handle);
      useCameraStore.getState().updateCameraConfig(handle);
      if (!sidebarOpen) setTimeout(() => setSidebarOpen(true), 500);
      document
        .querySelectorAll(".point")
        .forEach((p) => p.classList.remove("visible"));
    },
    [index]
  );

  return { index, total: PRODUCT_ORDER.length, productHandle, go };
}

/**
 * Global keyboard shortcuts for the shop panel. The visible prev/next controls
 * live in the Sidebar header (see Sidebar.jsx).
 *  ← / →  previous / next collection (while the product panel is open)
 *  Esc    close the panel
 */
const Navigation = () => {
  const { go } = useCollectionNav();

  useEffect(() => {
    const onKey = (e) => {
      const { sidebarOpen, cartOpen, productHandle, setSidebarOpen } =
        collectionStore.getState();
      if (e.defaultPrevented) return; // e.g. the photo viewer handled it
      const tag = e.target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || e.target?.isContentEditable)
        return;
      if (e.key === "Escape") {
        setSidebarOpen(false);
        return;
      }
      if (!productHandle || (sidebarOpen && cartOpen)) return;
      if (e.key === "ArrowRight") go("next");
      else if (e.key === "ArrowLeft") go("prev");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  return null;
};

export default Navigation;
