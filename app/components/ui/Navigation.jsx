import React, { useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import collectionStore from "../../stores/collectionStore";
import useCameraStore from "../../stores/cameraStore";

const PRODUCT_ORDER = ["splatter", "hoodie", "polo", "longsleeve"];

const Navigation = () => {
  const setProductHandle = collectionStore((state) => state.setProductHandle);
  const productHandle = collectionStore((state) => state.productHandle);
  const sidebarOpen = collectionStore((state) => state.sidebarOpen);
  const setSidebarOpen = collectionStore((state) => state.setSidebarOpen);

  const { updateCameraConfig } = useCameraStore();

  const currentIndex = useMemo(
    () => PRODUCT_ORDER.findIndex((product) => product === productHandle),
    [productHandle]
  );

  const handleNavigation = (direction) => {
    let newIndex;
    if (direction === "next") {
      newIndex = currentIndex < PRODUCT_ORDER.length - 1 ? currentIndex + 1 : 0;
    } else {
      newIndex = currentIndex > 0 ? currentIndex - 1 : PRODUCT_ORDER.length - 1;
    }

    const newProduct = PRODUCT_ORDER[newIndex];
    setProductHandle(newProduct);
    updateCameraConfig(newProduct);

    // If sidebar isn't open, open it after camera transition
    if (!sidebarOpen) {
      setTimeout(() => {
        setSidebarOpen(true);
      }, 500);
    }

    // Hide points during transition
    document.querySelectorAll(".point").forEach((point) => {
      point.classList.remove("visible");
    });
  };

  if (!productHandle) return null;

  return (
    <div className="fixed flex items-center w-full justify-between md:w-[150px] transform -translate-x-1/2 bottom-0 md:bottom-4 px-4 py-2 md:py-0 md:px-0 left-1/2 bg-primary md:bg-transparent">
      <button
        className="flex items-center gap-2 p-2 transition-colors bg-white rounded-lg text-primary "
        onClick={() => handleNavigation("prev")}
        aria-label="Previous product"
      >
        <ChevronLeft className="w-6 h-6" />
      </button>
      <div className="text-sm text-white">
        {currentIndex + 1} / {PRODUCT_ORDER.length}
      </div>
      <button
        className="flex items-center gap-2 p-2 transition-colors bg-white rounded-lg text-primary"
        onClick={() => handleNavigation("next")}
        aria-label="Next product"
      >
        <ChevronRight className="w-6 h-6" />
      </button>
    </div>
  );
};

export default Navigation;
